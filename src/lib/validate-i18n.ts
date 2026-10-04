/**
 * The rules a translation must pass. A translation is an overlay on an English
 * entry (see `src/i18n/overlay.ts`): it may change the words and nothing else.
 * Above all it must cite exactly what the original cites, so that a claim in
 * one language is backed by the same source as in every other.
 *
 * Pure, like `validate.ts`: raw content in, a list of issues out.
 */
import {
  HAS_CITATIONS,
  OPTIONAL,
  OVERLAY_COLLECTIONS,
  sourceHash,
  TRANSLATABLE,
  wordsOf,
  type OverlayCollection,
  type OverlayData,
} from '../i18n/overlay';
import { translationSchema } from '../content/schemas';
import { BibleRefError, parseBibleRef } from './bible';
import type { RawTranslation } from './load';
import { scanTokens, type LinkType } from './prose';
import type { Issue, RawContent, RawEntry } from './validate';

const LINK_COLLECTION: Record<LinkType, OverlayCollection> = {
  person: 'people',
  place: 'places',
  event: 'events',
  thread: 'threads',
  source: 'sources',
  era: 'eras',
};

const SUMMARY_MAX = 280;

interface Options {
  /** The languages the site knows, with their status. */
  locales: { code: string; status: 'live' | 'preview' }[];
  defaultLocale: string;
}

/** What a text cites: citation keys and Bible passages, each once, in a stable order. */
function citedBy(texts: (string | undefined)[]): { keys: string[]; passages: string[] } {
  const keys = new Set<string>();
  const passages = new Set<string>();
  for (const text of texts) {
    for (const token of scanTokens(text ?? '')) {
      if (token.kind === 'cite') keys.add(token.key);
      if (token.kind === 'bible') {
        try {
          passages.add(parseBibleRef(token.ref).osis);
        } catch {
          // An invalid reference is reported where it stands.
        }
      }
    }
  }
  return { keys: [...keys].sort(), passages: [...passages].sort() };
}

export function validateTranslations(
  content: RawContent,
  pages: RawEntry[],
  translations: RawTranslation[],
  options: Options,
): Issue[] {
  const issues: Issue[] = [];
  const error = (code: string, file: string, message: string) => issues.push({ level: 'error', code, file, message });
  const warning = (code: string, file: string, message: string) => issues.push({ level: 'warning', code, file, message });

  const originals: Record<OverlayCollection, Map<string, RawEntry>> = {
    events: new Map(),
    people: new Map(),
    places: new Map(),
    sources: new Map(),
    threads: new Map(),
    eras: new Map(),
    pages: new Map(pages.map((page) => [page.id, page])),
  };
  for (const collection of OVERLAY_COLLECTIONS) {
    if (collection === 'pages') continue;
    for (const entry of content[collection]) originals[collection].set(entry.id, entry);
  }
  const exists = (collection: OverlayCollection, id: string) => originals[collection].has(id);

  /** Links and Bible references must resolve; citation keys must be the original's. */
  function checkTokens(file: string, text: string, citations: Record<string, unknown>) {
    for (const token of scanTokens(text)) {
      if (token.kind === 'bible') {
        try {
          parseBibleRef(token.ref);
        } catch (e) {
          if (!(e instanceof BibleRefError)) throw e;
          error('token', file, `${token.raw}: ${e.message}. References are written in English in every language.`);
        }
      } else if (token.kind === 'cite') {
        if (!(token.key in citations)) {
          error('token', file, `${token.raw}: the original entry has no citation "${token.key}"`);
        }
      } else if (token.kind === 'link') {
        if (!exists(LINK_COLLECTION[token.type], token.id)) {
          error('ref', file, `${token.raw}: there is no ${token.type} "${token.id}"`);
        }
      } else {
        error('token', file, `${token.raw}: unknown link type "${token.type}"`);
      }
    }
  }

  const seen = new Set<string>();
  for (const translation of translations) {
    const { file, locale, id } = translation;
    const parts = file.split('/');
    if (parts.length !== 4) {
      error('i18n-path', file, 'A translation lives at i18n/<language>/<collection>/<id>.md');
      continue;
    }
    if (locale === options.defaultLocale || !options.locales.some((known) => known.code === locale)) {
      error('i18n-locale', file, `"${locale}" is not one of the site's languages (see src/i18n/locales.ts)`);
      continue;
    }
    if (!(OVERLAY_COLLECTIONS as string[]).includes(translation.collection)) {
      error('i18n-path', file, `"${translation.collection}" is not a collection`);
      continue;
    }
    const collection = translation.collection as OverlayCollection;
    const original = originals[collection].get(id);
    if (!original) {
      error('i18n-orphan', file, `There is no ${collection} entry "${id}" to translate`);
      continue;
    }
    seen.add(file);

    if (translation.parseError) {
      error('yaml', file, `The front matter is not valid YAML: ${translation.parseError}`);
      continue;
    }
    const parsed = translationSchema.safeParse(translation.data);
    if (!parsed.success) {
      for (const problem of parsed.error.issues) {
        error('schema', file, `${problem.path.join('.') || '(front matter)'}: ${problem.message}`);
      }
      continue;
    }
    const overlay = parsed.data as OverlayData;
    const data = (original.data ?? {}) as Record<string, any>;
    const words = wordsOf(collection, data) as Record<string, unknown>;

    // Only the words of this kind of entry may be translated.
    const allowed = new Set<string>(['source', 'translated', ...TRANSLATABLE[collection]]);
    if (HAS_CITATIONS.includes(collection)) allowed.add('citations');
    for (const field of Object.keys(overlay)) {
      if (!allowed.has(field)) error('i18n-field', file, `"${field}" is not a translatable field of ${collection}`);
    }

    // Every word of the original needs its translation.
    for (const field of TRANSLATABLE[collection]) {
      if (OPTIONAL.includes(field) || words[field] === undefined) continue;
      if (overlay[field] === undefined) error('i18n-missing', file, `"${field}" is not translated`);
    }
    if (original.body.trim() && !translation.body.trim()) error('i18n-missing', file, 'The text of the entry is not translated');
    if (overlay.links && overlay.links.length !== ((data.links as unknown[]) ?? []).length) {
      error('i18n-field', file, `links: the original has ${((data.links as unknown[]) ?? []).length} further links, the translation names ${overlay.links.length}`);
    }
    for (const key of Object.keys(overlay.citations ?? {})) {
      if (!(key in (data.citations ?? {}))) error('i18n-field', file, `citations.${key}: the original has no such citation`);
    }
    if (overlay.summary && overlay.summary.length > SUMMARY_MAX) {
      error('length', file, `summary: ${overlay.summary.length} characters; the limit is ${SUMMARY_MAX}`);
    }

    // The same sources behind the same claims.
    const citations = (data.citations ?? {}) as Record<string, unknown>;
    for (const text of [translation.body, overlay.dating ?? '', overlay.summary ?? '']) checkTokens(file, text, citations);
    const theirs = citedBy([original.body, data.dating]);
    const ours = citedBy([translation.body, overlay.dating]);
    for (const key of theirs.keys.filter((k) => !ours.keys.includes(k))) {
      error('i18n-citations', file, `The original cites [[cite:${key}]]; the translation does not`);
    }
    for (const key of ours.keys.filter((k) => !theirs.keys.includes(k) && k in citations)) {
      error('i18n-citations', file, `The translation cites [[cite:${key}]]; the original does not`);
    }
    for (const passage of theirs.passages.filter((p) => !ours.passages.includes(p))) {
      error('i18n-citations', file, `The original cites the Bible passage ${passage}; the translation does not`);
    }
    for (const passage of ours.passages.filter((p) => !theirs.passages.includes(p))) {
      error('i18n-citations', file, `The translation cites the Bible passage ${passage}; the original does not`);
    }

    if (overlay.source !== sourceHash(collection, data, original.body)) {
      warning(
        'i18n-stale',
        file,
        'The English entry has changed since this translation was made. Revise it, then run `npm run i18n -- stamp`.',
      );
    }
    if (data.draft === true) warning('i18n-draft', file, 'The English entry is still a draft');
  }

  // The pages themselves: their links and citations must resolve like any entry's.
  for (const page of pages) {
    if (page.parseError) {
      error('yaml', page.file, `The front matter is not valid YAML: ${page.parseError}`);
      continue;
    }
    const data = (page.data ?? {}) as Record<string, any>;
    checkTokens(page.file, page.body, (data.citations ?? {}) as Record<string, unknown>);
    for (const [key, def] of Object.entries((data.citations ?? {}) as Record<string, { source?: string }>)) {
      if (!def.source || !exists('sources', def.source)) error('ref', page.file, `citations.${key}: there is no source "${def.source}"`);
    }
  }

  return issues.sort((a, b) => a.file.localeCompare(b.file) || a.code.localeCompare(b.code));
}
