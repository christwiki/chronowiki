/**
 * The site's data in one language, loaded once per build from the content
 * collections and joined up: events in order, lookups for people, places and
 * sources, and the groupings the pages need. Pages and components read from
 * here and never query collections themselves.
 *
 * `getSite('de')` gives the same entries as `getSite()` with their German
 * words put in wherever a translation exists. An entry without one keeps the
 * words it was written in and says so (`entry.i18n`).
 */
import { getCollection } from 'astro:content';
import type { EraData, EventData, PageData, PersonData, PlaceData, SourceData, ThreadData, TranslationData } from '../content/schemas';
import { DEFAULT_LOCALE, getLocale, i18nFor, type I18n, type LocaleDef } from '../i18n';
import { applyOverlay, sourceHash, type OverlayCollection, type OverlayData } from '../i18n/overlay';
import { parseBibleRef } from './bible';
import type { WikiDate } from './dates';
import { byEra, groupBy, leadsTo, sortEvents, type EventNode } from './graph';
import {
  citationLabel,
  renderInline,
  renderProse,
  scanTokens,
  type CitationDef,
  type LinkType,
  type ProseContext,
  type ProseResult,
} from './prose';
import { smarten } from './typography';

/** How an entry stands in the language of the site being built. */
export interface EntryI18n {
  /** The language its words are in: the site's, or English where it is not translated. */
  lang: string;
  translated: boolean;
  /** A translation made from an earlier version of the English entry. */
  stale: boolean;
}

type Localised<T> = T & { i18n: EntryI18n };

/**
 * An entry as the content collections hold it. The types are written out here
 * from the schemas, so the theme does not depend on the types Astro generates
 * inside each wiki.
 */
interface Stored<Data> {
  id: string;
  collection: string;
  body?: string;
  data: Data;
}

export type EventEntry = Localised<Stored<EventData>>;
export type PersonEntry = Localised<Stored<PersonData>>;
export type PlaceEntry = Localised<Stored<PlaceData>>;
export type SourceEntry = Localised<Stored<SourceData>>;
export type ThreadEntry = Localised<Stored<ThreadData>>;
/** Every era has a colour here: its own, or one given to it by its place in the order. */
export type EraEntry = Localised<Stored<EraData & { colour: string }>>;
export type PageEntry = Localised<Stored<PageData>>;

/** An event with everything a page needs to place it. */
export interface EventView extends EventNode {
  entry: EventEntry;
  data: EventEntry['data'];
  body: string;
  dateLabel: string;
  eraEntry: EraEntry;
  /** The event's primary place, if it has one and that place is published. */
  primaryPlace?: PlaceEntry;
}

export interface SiteData {
  /** The language of this view of the site. */
  locale: LocaleDef;
  i18n: I18n;
  /** The English view, which supplies names inside text that is not translated. */
  original?: SiteData;
  eras: EraEntry[];
  threads: ThreadEntry[];
  events: EventView[];
  eventsById: Map<string, EventView>;
  /** Titles of events that exist but are not published yet, so that links to them can render as plain text. */
  unpublishedEvents: Map<string, string>;
  people: Map<string, PersonEntry>;
  places: Map<string, PlaceEntry>;
  sources: Map<string, SourceEntry>;
  pages: Map<string, PageEntry>;
  erasById: Map<string, EraEntry>;
  threadsById: Map<string, ThreadEntry>;
  leadsTo: Map<string, string[]>;
  byEra: Map<string, EventView[]>;
  byPlace: Map<string, EventView[]>;
  byPerson: Map<string, EventView[]>;
  byThread: Map<string, EventView[]>;
  /** Source id to the events that cite it, in date order. */
  bySource: Map<string, EventView[]>;
  /** How many of the published events, people, places and sources have their words in this language. */
  coverage: { translated: number; total: number };
}

/**
 * Drafts are stubs awaiting research. They are shown while developing and
 * left out of production builds, where links to them render as plain text.
 */
export const SHOW_DRAFTS = import.meta.env.DEV || process.env.SHOW_DRAFTS === 'true';

/**
 * A broken link or citation normally stops the build. While content is being
 * written it is only logged: always in development, and in a build when
 * LENIENT_CONTENT=true.
 */
const LENIENT = import.meta.env.DEV || process.env.LENIENT_CONTENT === 'true';

export function isPublished(entry: { data: { draft?: boolean } }): boolean {
  return SHOW_DRAFTS || entry.data.draft !== true;
}

const ROUTES: Record<LinkType, string> = {
  event: 'events',
  person: 'people',
  place: 'places',
  source: 'sources',
  thread: 'threads',
  era: 'eras',
};

/** The address of an entry's page in the site's language. */
export function entryHref(site: SiteData, type: LinkType, id: string): string {
  return site.i18n.href(`/${ROUTES[type]}/${id}/`);
}

/** The `lang` attribute for an entry's words, or undefined where they are in the page's language. */
export function langOf(site: SiteData, entry: { i18n: EntryI18n }): string | undefined {
  return entry.i18n.lang === site.locale.code ? undefined : entry.i18n.lang;
}

function byId<T extends { id: string }>(entries: T[]): Map<string, T> {
  return new Map(entries.map((entry) => [entry.id, entry]));
}

// --- loading -------------------------------------------------------------------

const all = <Data,>(name: string) => getCollection(name as never) as unknown as Promise<Stored<Data>[]>;

async function loadCollections() {
  const [eras, threads, events, people, places, sources, pages, translations] = await Promise.all([
    all<EraData>('eras'),
    all<ThreadData>('threads'),
    all<EventData>('events'),
    all<PersonData>('people'),
    all<PlaceData>('places'),
    all<SourceData>('sources'),
    all<PageData>('pages'),
    all<TranslationData>('translations'),
  ]);
  return { eras, threads, events, people, places, sources, pages, translations };
}

/**
 * The hue of an era that names none. The sixteen hues run round the colour
 * circle, so the eras are spread evenly round it: four eras take the 1st, 5th,
 * 9th and 13th.
 */
const HUES = 16;
function hueFor(index: number, count: number): string {
  return `era-${1 + (Math.round((index * HUES) / Math.max(count, 1)) % HUES)}`;
}

let collections: ReturnType<typeof loadCollections> | undefined;

/** The short fields that are shown as they stand, and so get typographic quotation marks here. */
const SHOWN_FIELDS = ['title', 'name', 'short', 'summary', 'role', 'modern', 'span', 'cite', 'author', 'holding', 'edition', 'language'];

function polish<T extends Record<string, any>>(data: T, quotes: LocaleDef['quotes']): T {
  const out: Record<string, any> = { ...data };
  for (const field of SHOWN_FIELDS) if (typeof out[field] === 'string') out[field] = smarten(out[field], quotes);
  if (Array.isArray(out.altNames)) out.altNames = out.altNames.map((name: string) => smarten(name, quotes));
  if (Array.isArray(out.links)) {
    out.links = out.links.map((link: { label: string; url: string }) => ({ ...link, label: smarten(link.label, quotes) }));
  }
  return out as T;
}

async function load(code: string): Promise<SiteData> {
  collections ??= loadCollections();
  const raw = await collections;
  const locale = getLocale(code);
  const original = code === DEFAULT_LOCALE ? undefined : await getSite(DEFAULT_LOCALE);
  const sourceLocale = getLocale(DEFAULT_LOCALE);

  const overlays = new Map(
    raw.translations.filter((entry) => entry.id.startsWith(`${code}/`)).map((entry) => [entry.id.slice(code.length + 1), entry]),
  );

  /** An entry with this language's words put in, or as it stands where there is no translation. */
  function localise<T extends { id: string; data: Record<string, any>; body?: string }>(
    collection: OverlayCollection,
    entry: T,
  ): Localised<T> {
    const overlay = original ? overlays.get(`${collection}/${entry.id}`) : undefined;
    if (!overlay) {
      const translated = !original;
      return {
        ...entry,
        data: polish(entry.data, sourceLocale.quotes),
        i18n: { lang: DEFAULT_LOCALE, translated, stale: false },
      };
    }
    const stale = overlay.data.source !== sourceHash(collection, entry.data, entry.body ?? '');
    return {
      ...entry,
      data: polish(applyOverlay(collection, entry.data, overlay.data as OverlayData), locale.quotes),
      body: overlay.body ?? '',
      i18n: { lang: code, translated: true, stale },
    };
  }

  const eras: EraEntry[] = raw.eras
    .map((entry) => localise('eras', entry))
    .sort((a, b) => a.data.order - b.data.order)
    .map((era, index, list) => ({ ...era, data: { ...era.data, colour: era.data.colour ?? hueFor(index, list.length) } }));
  // Threads stand in the same order in every language: by their number, then by their title as first written.
  const threadRank = new Map(
    [...raw.threads]
      .sort((a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title, DEFAULT_LOCALE))
      .map((entry, index) => [entry.id, index]),
  );
  const threads = raw.threads
    .map((entry) => localise('threads', entry))
    .sort((a, b) => (threadRank.get(a.id) ?? 0) - (threadRank.get(b.id) ?? 0));
  const people = raw.people.map((entry) => localise('people', entry));
  const places = raw.places.map((entry) => localise('places', entry));
  const sources = raw.sources.map((entry) => localise('sources', entry));
  const pages = raw.pages.map((entry) => localise('pages', entry));
  const allEvents = raw.events.map((entry) => localise('events', entry));

  const erasById = byId(eras);
  const placesById = byId(places);
  const i18n = i18nFor(code);

  const views = allEvents.filter(isPublished).map((entry): EventView => {
    const eraEntry = erasById.get(entry.data.era);
    if (!eraEntry) throw new Error(`Event "${entry.id}" names the unknown era "${entry.data.era}"`);
    const primary = placesById.get(entry.data.places[0] ?? '');
    const date = entry.data.date as WikiDate;
    return {
      id: entry.id,
      title: entry.data.title,
      era: entry.data.era,
      eraOrder: eraEntry.data.order,
      date,
      order: entry.data.order,
      places: entry.data.places,
      people: entry.data.people,
      threads: entry.data.threads,
      follows: entry.data.follows,
      entry,
      data: entry.data,
      body: entry.body ?? '',
      // An untranslated entry keeps its English date label along with its English words.
      dateLabel: entry.i18n.lang === code ? i18n.date(date) : i18nFor(entry.i18n.lang).date(date),
      eraEntry,
      primaryPlace: primary && isPublished(primary) ? primary : undefined,
    };
  });

  // The order of events is the same in every language: ties are settled by the English title.
  let events: EventView[];
  if (original) {
    const rank = new Map(original.events.map((event, index) => [event.id, index]));
    events = [...views].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  } else {
    events = sortEvents(views);
  }

  const bySource = new Map<string, EventView[]>();
  for (const event of events) {
    for (const sourceId of new Set(Object.values(event.data.citations).map((c) => c.source))) {
      bySource.set(sourceId, [...(bySource.get(sourceId) ?? []), event]);
    }
  }

  const counted = [...events.map((event) => event.entry), ...[...people, ...places, ...sources].filter(isPublished)];

  return {
    locale,
    i18n,
    original,
    eras,
    threads,
    events,
    eventsById: byId(events),
    unpublishedEvents: new Map(allEvents.filter((e) => !isPublished(e)).map((e) => [e.id, e.data.title])),
    people: byId(people),
    places: placesById,
    sources: byId(sources),
    pages: byId(pages),
    erasById,
    threadsById: byId(threads),
    leadsTo: leadsTo(events),
    byEra: byEra(events),
    byPlace: groupBy(events, 'places'),
    byPerson: groupBy(events, 'people'),
    byThread: groupBy(events, 'threads'),
    bySource,
    coverage: { translated: counted.filter((entry) => entry.i18n.translated).length, total: counted.length },
  };
}

const cached = new Map<string, Promise<SiteData>>();

export function getSite(code: string = DEFAULT_LOCALE): Promise<SiteData> {
  let site = cached.get(code);
  if (!site) {
    site = load(code);
    cached.set(code, site);
  }
  return site;
}

// --- links and text --------------------------------------------------------------

/** Name and link of any entry, for chips and wiki links. `href` is empty for unpublished entries. */
export function linkFor(site: SiteData, type: LinkType, id: string): { href: string; label: string } | undefined {
  const published = (entry: { data: { draft?: boolean } }) => (isPublished(entry) ? entryHref(site, type, id) : '');
  switch (type) {
    case 'event': {
      const event = site.eventsById.get(id);
      if (event) return { href: entryHref(site, type, id), label: event.title };
      const pending = site.unpublishedEvents.get(id);
      return pending === undefined ? undefined : { href: '', label: pending };
    }
    case 'person': {
      const person = site.people.get(id);
      return person && { href: published(person), label: person.data.name };
    }
    case 'place': {
      const place = site.places.get(id);
      return place && { href: published(place), label: place.data.name };
    }
    case 'source': {
      const source = site.sources.get(id);
      return source && { href: published(source), label: source.data.title };
    }
    case 'thread': {
      const thread = site.threadsById.get(id);
      return thread && { href: entryHref(site, type, id), label: thread.data.title };
    }
    case 'era': {
      const era = site.erasById.get(id);
      return era && { href: entryHref(site, type, id), label: era.data.title };
    }
  }
}

/** Any content entry. Only events, people, places and pages carry a `citations` map. */
interface Renderable {
  id: string;
  collection: string;
  body?: string;
  data: object;
  i18n: EntryI18n;
}

const citationsOf = (entry: Renderable) => (entry.data as { citations?: Record<string, CitationDef> }).citations;

/**
 * How to render an entry's text. Links always lead to pages in the site's
 * language. Names inside the text, Bible references and quotation marks follow
 * the language of the text itself: an entry still in English reads as English
 * throughout, with no German names set into English sentences.
 */
export function proseContext(site: SiteData, entry: Renderable): ProseContext {
  const textLocale = getLocale(entry.i18n.lang);
  const names = entry.i18n.lang === site.locale.code ? site : (site.original ?? site);
  return {
    citations: citationsOf(entry) ?? {},
    bible: textLocale.bible,
    quotes: textLocale.quotes,
    articleRule: textLocale.articleRule,
    resolve(type, id) {
      const link = linkFor(site, type, id);
      const label = linkFor(names, type, id)?.label;
      return link && { href: link.href, label: label ?? link.label };
    },
    source(id) {
      const source = names.sources.get(id);
      return (
        source && {
          id,
          cite: source.data.cite,
          title: source.data.title,
          url: source.data.url,
          href: entryHref(site, 'source', id),
        }
      );
    },
  };
}

function check(result: ProseResult, entry: Renderable, field: string): ProseResult {
  if (result.errors.length > 0) {
    const message = `${entry.collection}/${entry.id} (${field}, ${entry.i18n.lang}): ${result.errors.join('; ')}`;
    if (!LENIENT) throw new Error(message);
    console.warn(`[content] ${message}`);
  }
  return result;
}

/** Render an entry's body. A broken link or citation stops the build with the entry's name. */
export function renderBody(site: SiteData, entry: Renderable): ProseResult {
  return check(renderProse(entry.body ?? '', proseContext(site, entry)), entry, 'body');
}

/** Render a Markdown front-matter field of an entry, such as the dating note. */
export function renderField(site: SiteData, entry: Renderable, field: string, markdown: string): ProseResult {
  return check(renderProse(markdown, proseContext(site, entry)), entry, field);
}

export function renderSummary(site: SiteData, entry: Renderable, markdown: string): string {
  return check(renderInline(markdown, proseContext(site, entry)), entry, 'summary').html;
}

/** The first few citations of an event's narrative, as short labels for its timeline card. */
export function keyCitations(site: SiteData, event: EventView, max = 2): string[] {
  const context = proseContext(site, event.entry);
  const labels: string[] = [];
  for (const token of scanTokens(event.body)) {
    let label: string | undefined;
    if (token.kind === 'bible') {
      try {
        label = parseBibleRef(token.ref, context.bible).short;
      } catch {
        // Reported by renderBody when the event page is built.
      }
    } else if (token.kind === 'cite') {
      const def = event.data.citations[token.key];
      const source = def && context.source(def.source);
      if (source) label = smarten(citationLabel(source.cite, def.at), context.quotes);
    }
    if (label && !labels.includes(label)) labels.push(label);
    if (labels.length === max) break;
  }
  return labels;
}

/** The map regions an event touches, from its places. */
export function regionsOf(site: SiteData, event: EventView): string[] {
  return [...new Set(event.places.flatMap((id) => site.places.get(id)?.data.region ?? []))];
}

/** A source's date of writing as a label, in the language of the source record's words. */
export function writtenLabel(site: SiteData, source: SourceEntry): string | undefined {
  const { written } = source.data;
  if (!written) return undefined;
  return written.display ?? i18nFor(source.i18n.lang).date({ ...written, confidence: 'firm' });
}
