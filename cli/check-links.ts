/**
 * Requests every external link in the content and reports the ones that fail.
 * Run before each content release; it needs the network and takes a while.
 *
 *   chronowiki check-links                 all links, using results cached for up to 7 days
 *   chronowiki check-links --no-cache      ignore the cache
 *   chronowiki check-links --only livius   only URLs containing "livius"
 *   chronowiki check-links --bible         also request one Bible-reader link per event, in every language's reader
 *
 * A site that refuses automated requests (HTTP 401, 403, 429 or 520) cannot be judged
 * from here. Those links are listed separately, to be opened by hand. A request
 * that fails before any answer arrives is tried once more with curl, if installed.
 */
import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadWikiConfig } from '../src/config/load';
import { parseBibleRef } from '../src/lib/bible';
import { CONTENT_ROOT, loadContent, loadPages, loadTranslations } from '../src/lib/load';
import { scanTokens } from '../src/lib/prose';

const CACHE_FILE = '.cache/links.json';
const CACHE_DAYS = 7;
const TIMEOUT_MS = 25_000;
const CONCURRENCY = 12;
const SAVE_EVERY = 100;
/** Answers that mean "not for scripts": the usual refusals, and 520, which some sites behind Cloudflare give to anything but a browser. */
const REFUSALS = [401, 403, 429, 520];
const HOST_SPACING_MS = 1200;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 chronowiki-link-check';

type Outcome = 'ok' | 'blocked' | 'failed';
interface Result {
  outcome: Outcome;
  detail: string;
  checked: number;
}

const LOCALES = (await loadWikiConfig()).locales;

const args = process.argv.slice(2);
const noCache = args.includes('--no-cache');
const withBible = args.includes('--bible');
const onlyIndex = args.indexOf('--only');
const only = onlyIndex === -1 ? undefined : args[onlyIndex + 1];

// --- collect ------------------------------------------------------------------
const content = loadContent();
/** URL to the files that use it. */
const uses = new Map<string, Set<string>>();
const add = (url: unknown, file: string) => {
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) return;
  uses.set(url, (uses.get(url) ?? new Set()).add(file));
};

const MARKDOWN_LINK = /\]\((https?:\/\/[^)\s]+)\)/g;

for (const entries of Object.values(content)) {
  for (const entry of entries) {
    const data = (entry.data ?? {}) as Record<string, any>;
    if (data.draft === true) continue;
    add(data.url, entry.file);
    for (const link of data.links ?? []) add(link?.url, entry.file);
    for (const def of Object.values(data.citations ?? {}) as { url?: string }[]) add(def?.url, entry.file);
    for (const text of [entry.body, data.dating ?? '']) {
      for (const match of String(text).matchAll(MARKDOWN_LINK)) add(match[1], entry.file);
    }
    if (withBible) {
      const first = scanTokens(entry.body).find((token) => token.kind === 'bible');
      if (first?.kind === 'bible') {
        try {
          // Each language sends its readers to a Bible reader of its own.
          for (const locale of LOCALES) {
            for (const link of parseBibleRef(first.ref, locale.bible).links) add(link.url, entry.file);
          }
        } catch {
          // Invalid references are the validator's business.
        }
      }
    }
  }
}

// Translations and the pages of running text can carry Markdown links of their own.
for (const entry of [...loadTranslations(), ...loadPages()]) {
  const data = (entry.data ?? {}) as Record<string, any>;
  for (const def of Object.values(data.citations ?? {}) as { url?: string }[]) add(def?.url, entry.file);
  for (const text of [entry.body, data.dating ?? '']) {
    for (const match of String(text).matchAll(MARKDOWN_LINK)) add(match[1], entry.file);
  }
}

const urls = [...uses.keys()].filter((url) => !only || url.includes(only)).sort();

/**
 * The order of work: one link from each host in turn. Requests to one host are
 * spaced out, so taking the links in alphabetical order would leave every worker
 * waiting on the same host while the others sat idle.
 */
function byHostInTurn(list: string[]): string[] {
  const queues = new Map<string, string[]>();
  for (const url of list) {
    const host = new URL(url).host;
    queues.set(host, [...(queues.get(host) ?? []), url]);
  }
  const order: string[] = [];
  for (let round = 0; order.length < list.length; round++) {
    for (const queue of queues.values()) if (round < queue.length) order.push(queue[round]);
  }
  return order;
}
const queue = byHostInTurn(urls);

// --- cache ----------------------------------------------------------------------
let cache: Record<string, Result> = {};
if (!noCache) {
  try {
    cache = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    // No cache yet.
  }
}
const fresh = (result: Result | undefined) =>
  result !== undefined && result.outcome === 'ok' && Date.now() - result.checked < CACHE_DAYS * 86_400_000;

// --- request --------------------------------------------------------------------
const lastRequest = new Map<string, number>();

async function politely(host: string) {
  const wait = (lastRequest.get(host) ?? 0) + HOST_SPACING_MS - Date.now();
  lastRequest.set(host, Math.max(Date.now(), (lastRequest.get(host) ?? 0) + HOST_SPACING_MS));
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}

async function request(url: string): Promise<Result> {
  const checked = Date.now();
  try {
    await politely(new URL(url).host);
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'en' },
    });
    await response.body?.cancel();
    if (response.ok) return { outcome: 'ok', detail: String(response.status), checked };
    if (REFUSALS.includes(response.status)) return { outcome: 'blocked', detail: `HTTP ${response.status}`, checked };
    return { outcome: 'failed', detail: `HTTP ${response.status}`, checked };
  } catch (error) {
    const cause = (error as { cause?: { code?: string } }).cause?.code ?? (error as Error).name;
    // Node rejects servers that send an incomplete certificate chain and gives up on
    // some slow ones, where browsers and curl get through. Ask curl before calling it broken.
    const status = await curlStatus(url);
    if (status >= 200 && status < 300) return { outcome: 'ok', detail: `${status} (curl, after ${cause})`, checked };
    if (REFUSALS.includes(status)) return { outcome: 'blocked', detail: `HTTP ${status}`, checked };
    return { outcome: 'failed', detail: status ? `HTTP ${status}` : cause, checked };
  }
}

function curlStatus(url: string): Promise<number> {
  return new Promise((resolve) => {
    execFile(
      'curl',
      ['-sL', '-o', '/dev/null', '-m', String(TIMEOUT_MS / 1000 + 10), '-A', USER_AGENT, '-w', '%{http_code}', url],
      (_error, stdout) => resolve(Number(stdout.trim()) || 0),
    );
  });
}

async function check(url: string): Promise<Result> {
  if (fresh(cache[url])) return cache[url];
  let result = await request(url);
  if (result.outcome === 'failed') result = await request(url); // one retry
  cache[url] = result;
  return result;
}

function saveCache() {
  mkdirSync(dirname(CACHE_FILE), { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 1));
}

// --- run ------------------------------------------------------------------------
console.log(`Checking ${urls.length} links (${CONCURRENCY} at a time, at most one request per host every ${HOST_SPACING_MS} ms)…`);
const results = new Map<string, Result>();
let next = 0;
let done = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < queue.length) {
      const url = queue[next++];
      results.set(url, await check(url));
      done += 1;
      if (done % 25 === 0 || done === queue.length) process.stdout.write(`  ${done}/${queue.length}\n`);
      // Save as the run goes, so that an interrupted run is not lost.
      if (done % SAVE_EVERY === 0) saveCache();
    }
  }),
);
saveCache();

function report(outcome: Outcome, heading: string) {
  const list = urls.filter((url) => results.get(url)!.outcome === outcome);
  if (list.length === 0) return 0;
  console.log(`\n${heading} (${list.length})`);
  for (const url of list) {
    console.log(`\n  ${url}\n    ${results.get(url)!.detail}`);
    for (const file of uses.get(url)!) console.log(`    used in ${CONTENT_ROOT}/${file}`);
  }
  return list.length;
}

const failed = report('failed', 'Broken links');
const blocked = report('blocked', 'Links that refuse automated requests: open these by hand');
const ok = urls.length - failed - blocked;
console.log(`\n${ok} ok, ${blocked} to check by hand, ${failed} broken.`);
process.exit(failed > 0 ? 1 : 0);
