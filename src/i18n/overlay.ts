/**
 * Translations of entries. A translation is an overlay: a file that holds only
 * the words of an entry in another language. Dates, places, people and the
 * sources cited stay in the original, so the facts cannot drift apart.
 *
 *   src/content/i18n/<language>/<collection>/<id>.md
 *
 * Each overlay records which version of the original it was made from
 * (`source`, a short hash). When the original changes, the hash no longer
 * matches and the translation is flagged as out of date.
 */
import { createHash } from 'node:crypto';

export type OverlayCollection = 'events' | 'people' | 'places' | 'sources' | 'threads' | 'eras' | 'pages';

export const OVERLAY_COLLECTIONS: OverlayCollection[] = ['events', 'people', 'places', 'sources', 'threads', 'eras', 'pages'];

/** The front matter of an overlay. Which fields apply depends on the collection. */
export interface OverlayData {
  /** Hash of the original's words at the time of translation. */
  source: string;
  translated?: Date;
  title?: string;
  name?: string;
  short?: string;
  summary?: string;
  role?: string;
  modern?: string;
  altNames?: string[];
  span?: string;
  dating?: string;
  dateDisplay?: string;
  bornDisplay?: string;
  diedDisplay?: string;
  writtenDisplay?: string;
  author?: string;
  cite?: string;
  language?: string;
  edition?: string;
  holding?: string;
  /** Labels of a source's further links, in the original's order. */
  links?: string[];
  /** Locators that contain words ("Session 6, canon 9"), by citation key. */
  citations?: Record<string, { at: string }>;
}

/** The fields of each kind of entry that hold words. `citations` and the body come on top. */
export const TRANSLATABLE: Record<OverlayCollection, readonly (keyof OverlayData)[]> = {
  events: ['title', 'summary', 'dating', 'dateDisplay'],
  people: ['name', 'altNames', 'role', 'summary', 'bornDisplay', 'diedDisplay'],
  places: ['name', 'altNames', 'modern', 'summary'],
  sources: ['title', 'author', 'cite', 'language', 'edition', 'holding', 'summary', 'writtenDisplay', 'links'],
  threads: ['title', 'summary'],
  eras: ['title', 'short', 'span', 'summary'],
  pages: ['title', 'summary'],
};

/**
 * Fields a translation may leave to the original: names of people and
 * institutions are often the same, a language's name is translated from the
 * messages, and locators are mostly numbers.
 */
export const OPTIONAL: readonly (keyof OverlayData)[] = ['altNames', 'author', 'cite', 'language', 'holding'];

export const HAS_CITATIONS: readonly OverlayCollection[] = ['events', 'people', 'places', 'pages'];

type Data = Record<string, any>;

/** The words of an original entry, in the overlay's own field names. */
export function wordsOf(collection: OverlayCollection, data: Data): Partial<OverlayData> {
  const words: Data = {};
  const set = (field: string, value: unknown) => {
    if (value !== undefined && value !== null && !(Array.isArray(value) && value.length === 0)) words[field] = value;
  };
  for (const field of TRANSLATABLE[collection]) {
    if (field === 'dateDisplay') set(field, data.date?.display);
    else if (field === 'bornDisplay') set(field, data.born?.display);
    else if (field === 'diedDisplay') set(field, data.died?.display);
    else if (field === 'writtenDisplay') set(field, data.written?.display);
    else if (field === 'links') set(field, (data.links as { label: string }[] | undefined)?.map((link) => link.label));
    else set(field, data[field]);
  }
  if (HAS_CITATIONS.includes(collection)) {
    const locators = Object.entries((data.citations ?? {}) as Record<string, { at?: string }>)
      .filter(([, def]) => def.at !== undefined)
      .map(([key, def]) => [key, { at: def.at }]);
    if (locators.length > 0) words.citations = Object.fromEntries(locators);
  }
  return words;
}

/** Twelve hex digits that change whenever the original's words change. */
export function sourceHash(collection: OverlayCollection, data: Data, body: string): string {
  const words = wordsOf(collection, data);
  const canonical = JSON.stringify([Object.keys(words).sort().map((key) => [key, (words as Data)[key]]), body.trim()]);
  return createHash('sha256').update(canonical).digest('hex').slice(0, 12);
}

/** The original's data with the overlay's words put in. The original is not changed. */
export function applyOverlay<T extends Data>(collection: OverlayCollection, data: T, overlay: OverlayData): T {
  const out: Data = { ...data };
  for (const field of TRANSLATABLE[collection]) {
    const value = overlay[field];
    if (value === undefined) continue;
    if (field === 'dateDisplay') out.date = { ...data.date, display: value };
    else if (field === 'bornDisplay') out.born = data.born && { ...data.born, display: value };
    else if (field === 'diedDisplay') out.died = data.died && { ...data.died, display: value };
    else if (field === 'writtenDisplay') out.written = data.written && { ...data.written, display: value };
    else if (field === 'links') {
      out.links = (data.links as { label: string; url: string }[]).map((link, index) => ({
        ...link,
        label: (value as string[])[index] ?? link.label,
      }));
    } else out[field] = value;
  }
  if (overlay.citations && data.citations) {
    out.citations = Object.fromEntries(
      Object.entries(data.citations as Record<string, Data>).map(([key, def]) => [
        key,
        overlay.citations![key] ? { ...def, at: overlay.citations![key].at } : def,
      ]),
    );
  }
  return out as T;
}
