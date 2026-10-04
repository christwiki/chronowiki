/**
 * Tools for translating the content.
 *
 *   chronowiki i18n status                        how much of each language is translated, and what is out of date
 *   chronowiki i18n status de --missing           the same for one language, listing what is still to do
 *   chronowiki i18n new de events/council-of-nicaea
 *                                                 start a translation: a file with the original words in it, ready to be replaced
 *   chronowiki i18n stamp de                      after revising out-of-date translations, record that they now match
 *   chronowiki i18n stamp de events/council-of-nicaea
 *
 * A translation holds only the words of an entry (see src/i18n/overlay.ts and docs/languages.md).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { dump } from 'js-yaml';
import { loadWikiConfig } from '../src/config/load';
import { OVERLAY_COLLECTIONS, sourceHash, wordsOf, type OverlayCollection } from '../src/i18n/overlay';
import { CONTENT_ROOT, loadContent, loadPages, loadTranslations } from '../src/lib/load';
import type { RawEntry } from '../src/lib/validate';

const { locales: LOCALES, defaultLocale: DEFAULT_LOCALE } = await loadWikiConfig();

const [command, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((arg) => arg.startsWith('--')));
const args = rest.filter((arg) => !arg.startsWith('--'));

const content = loadContent();
const originals: Record<OverlayCollection, RawEntry[]> = { ...content, pages: loadPages() };
const translations = loadTranslations();
const others = LOCALES.filter((locale) => locale.code !== DEFAULT_LOCALE);

const isDraft = (entry: RawEntry) => (entry.data as { draft?: boolean } | undefined)?.draft === true;
const hashOf = (collection: OverlayCollection, entry: RawEntry) =>
  sourceHash(collection, (entry.data ?? {}) as Record<string, unknown>, entry.body);

function fail(message: string): never {
  console.error(message);
  process.exit(2);
}

function localeArg(): string {
  const code = args[0];
  if (!code || !others.some((locale) => locale.code === code)) {
    fail(`Name a language: ${others.map((locale) => locale.code).join(', ') || '(none defined yet)'}`);
  }
  return code;
}

function target(reference: string): { collection: OverlayCollection; entry: RawEntry } {
  const [collection, id] = reference.split('/');
  if (!(OVERLAY_COLLECTIONS as string[]).includes(collection)) fail(`"${collection}" is not a collection`);
  const entry = originals[collection as OverlayCollection].find((candidate) => candidate.id === id);
  if (!entry) fail(`There is no ${collection} entry "${id}"`);
  return { collection: collection as OverlayCollection, entry };
}

const pathOf = (code: string, collection: string, id: string) => join(CONTENT_ROOT, 'i18n', code, collection, `${id}.md`);

// --- status ---------------------------------------------------------------------
function status() {
  const wanted = args[0] ? [localeArg()] : others.map((locale) => locale.code);
  for (const code of wanted) {
    const locale = LOCALES.find((candidate) => candidate.code === code)!;
    console.log(`\n${locale.name} (${code}, ${locale.status})`);
    const missing: string[] = [];
    const stale: string[] = [];
    for (const collection of OVERLAY_COLLECTIONS) {
      const entries = originals[collection].filter((entry) => !isDraft(entry));
      let done = 0;
      for (const entry of entries) {
        const translation = translations.find(
          (t) => t.locale === code && t.collection === collection && t.id === entry.id,
        );
        if (!translation) {
          missing.push(`${collection}/${entry.id}`);
          continue;
        }
        done += 1;
        if ((translation.data as { source?: string } | undefined)?.source !== hashOf(collection, entry)) {
          stale.push(`${collection}/${entry.id}`);
        }
      }
      const share = entries.length === 0 ? 100 : Math.round((done / entries.length) * 100);
      console.log(`  ${collection.padEnd(8)} ${String(done).padStart(5)} of ${String(entries.length).padEnd(5)} ${String(share).padStart(3)}%`);
    }
    if (stale.length > 0) {
      console.log(`\n  Out of date (the original entry changed after the translation was made):`);
      for (const reference of stale) console.log(`    ${reference}`);
    }
    if (flags.has('--missing')) {
      console.log(`\n  Not translated yet:`);
      for (const reference of missing) console.log(`    ${reference}`);
    } else if (missing.length > 0) {
      console.log(`\n  ${missing.length} entries are not translated yet (add --missing to list them).`);
    }
  }
}

// --- new ------------------------------------------------------------------------
function create() {
  const code = localeArg();
  if (!args[1]) fail('Name the entry: <collection>/<id>, for example events/council-of-nicaea');
  const { collection, entry } = target(args[1]);
  const path = pathOf(code, collection, entry.id);
  if (existsSync(path)) fail(`${path} already exists`);
  const words = wordsOf(collection, (entry.data ?? {}) as Record<string, unknown>);
  // The hash is always quoted: one made of digits alone would otherwise be read as a number.
  const frontMatter = `source: "${hashOf(collection, entry)}"\n${dump(words, { lineWidth: -1 })}`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `---\n${frontMatter}---\n\n${entry.body.trim()}\n`);
  console.log(`Created ${path}\nIt holds the original words. Replace them with the translation; leave [[…]] references as they are.`);
}

// --- stamp ----------------------------------------------------------------------
function stamp() {
  const code = localeArg();
  const references = args.slice(1);
  let changed = 0;
  for (const translation of translations.filter((t) => t.locale === code)) {
    const reference = `${translation.collection}/${translation.id}`;
    if (references.length > 0 && !references.includes(reference)) continue;
    const { collection, entry } = target(reference);
    const hash = hashOf(collection, entry);
    const path = join(CONTENT_ROOT, translation.file);
    const text = readFileSync(path, 'utf8');
    const stamped = text.replace(/^source: .*$/m, `source: "${hash}"`);
    if (stamped === text) continue;
    writeFileSync(path, stamped);
    changed += 1;
    console.log(`  stamped ${reference}`);
  }
  console.log(`${changed} translation${changed === 1 ? '' : 's'} stamped as matching the current original.`);
}

if (command === 'status') status();
else if (command === 'new') create();
else if (command === 'stamp') stamp();
else fail('Usage: chronowiki i18n status [language] [--missing] | new <language> <collection>/<id> | stamp <language> [<collection>/<id> …]');
