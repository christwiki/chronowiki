/**
 * The rules every entry must pass before the site builds: schemas, references
 * that resolve, and the source policy (spec section 4). Pure: takes the raw
 * content as data and returns a list of issues, so it can be unit-tested and
 * run from a script without Astro.
 */
import { BibleRefError, parseBibleRef } from './bible';
import { compareDated } from './dates';
import { scanTokens, type LinkType, type Token } from './prose';
import {
  ID_PATTERN,
  SCHEMAS,
  type CollectionName,
  type EraData,
  type EventData,
  type PersonData,
  type PlaceData,
  type SourceData,
  type ThreadData,
} from '../content/schemas';

export interface RawEntry {
  id: string;
  /** Path relative to the content root, e.g. `events/exile-and-return/fall-of-jerusalem.md`. */
  file: string;
  data: unknown;
  body: string;
  /** Set when the front matter is not valid YAML. */
  parseError?: string;
}

export type RawContent = Record<CollectionName, RawEntry[]>;

export interface Entry<T> {
  id: string;
  file: string;
  data: T;
  body: string;
}

export interface Issue {
  level: 'error' | 'warning';
  code: string;
  file: string;
  message: string;
}

const LINK_COLLECTION: Record<LinkType, CollectionName> = {
  person: 'people',
  place: 'places',
  event: 'events',
  thread: 'threads',
  source: 'sources',
  era: 'eras',
};

const MIN_WORDS = 80;
const MAX_WORDS = 700;
const ERA_MARGIN_YEARS = 50;

/** Lower-case, without accents or punctuation. Letters of every script are kept. */
function normaliseName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function countWords(markdown: string): number {
  const text = markdown.replace(/\[\[[^\]]*\]\]/g, ' ');
  return text.split(/\s+/).filter(Boolean).length;
}

export interface ValidateOptions {
  /** Release check: drafts, orphans and unreviewed entries are errors. */
  strict?: boolean;
  /** The region ids of `wiki.config.ts`. Given, a place in any other region is an error. */
  regions?: string[];
}

export function validateContent(raw: RawContent, opts: ValidateOptions = {}): Issue[] {
  const issues: Issue[] = [];
  const error = (code: string, file: string, message: string) => issues.push({ level: 'error', code, file, message });
  const warning = (code: string, file: string, message: string) =>
    issues.push({ level: 'warning', code, file, message });
  /** A rule that only blocks a release: a warning normally, an error in strict mode. */
  const releaseRule = (code: string, file: string, message: string) =>
    issues.push({ level: opts.strict ? 'error' : 'warning', code, file, message });

  // --- ids and schemas -----------------------------------------------------
  const ids = {} as Record<CollectionName, Set<string>>;
  const parsed = {
    events: [] as Entry<EventData>[],
    people: [] as Entry<PersonData>[],
    places: [] as Entry<PlaceData>[],
    sources: [] as Entry<SourceData>[],
    threads: [] as Entry<ThreadData>[],
    eras: [] as Entry<EraData>[],
  };

  for (const name of Object.keys(SCHEMAS) as CollectionName[]) {
    ids[name] = new Set();
    for (const entry of raw[name]) {
      if (!ID_PATTERN.test(entry.id)) {
        error('id', entry.file, `File name "${entry.id}" is not a kebab-case id`);
      }
      if (ids[name].has(entry.id)) {
        error('id', entry.file, `Another ${name} entry already uses the id "${entry.id}"`);
      }
      ids[name].add(entry.id);

      if (entry.parseError) {
        error(
          'yaml',
          entry.file,
          `The front matter is not valid YAML: ${entry.parseError}. Put a value in double quotes if it contains a colon followed by a space.`,
        );
        continue;
      }

      const result = SCHEMAS[name].safeParse(entry.data);
      if (!result.success) {
        for (const problem of result.error.issues) {
          const path = problem.path.join('.') || '(front matter)';
          error('schema', entry.file, `${path}: ${problem.message}`);
        }
        continue;
      }
      if (name === 'places' && opts.regions && !opts.regions.includes((result.data as PlaceData).region)) {
        error(
          'schema',
          entry.file,
          `region: "${(result.data as PlaceData).region}" is not one of the regions in wiki.config.ts (${opts.regions.join(', ')})`,
        );
        continue;
      }
      (parsed[name] as Entry<unknown>[]).push({ ...entry, data: result.data });
    }
  }

  const exists = (collection: CollectionName, id: string) => ids[collection].has(id);
  const referenced = { people: new Set<string>(), places: new Set<string>(), sources: new Set<string>() };

  // An entry that fails its schema is skipped below. Its references are still
  // counted, so one broken event does not also report its people as orphans.
  const parsedFiles = new Set(Object.values(parsed).flatMap((entries) => entries.map((e) => e.file)));
  for (const entry of Object.values(raw).flat()) {
    if (parsedFiles.has(entry.file) || typeof entry.data !== 'object' || entry.data === null) continue;
    const data = entry.data as Record<string, unknown>;
    for (const key of ['people', 'places'] as const) {
      if (Array.isArray(data[key])) for (const id of data[key]) referenced[key].add(String(id));
    }
    if (typeof data.citations === 'object' && data.citations !== null) {
      for (const def of Object.values(data.citations)) {
        if (def && typeof def === 'object' && 'source' in def) referenced.sources.add(String(def.source));
      }
    }
  }

  // --- wiki tokens in any text field ----------------------------------------
  /** Checks tokens and returns the valid ones. */
  function checkText(file: string, text: string, citations: Record<string, { source: string }> | undefined): Token[] {
    const good: Token[] = [];
    for (const token of scanTokens(text)) {
      switch (token.kind) {
        case 'bible':
          try {
            parseBibleRef(token.ref);
            good.push(token);
          } catch (e) {
            if (!(e instanceof BibleRefError)) throw e;
            error('token', file, `${token.raw}: ${e.message}`);
          }
          break;
        case 'cite':
          if (citations && token.key in citations) good.push(token);
          else error('token', file, `${token.raw}: no citation "${token.key}" is defined in this entry's citations`);
          break;
        case 'link': {
          const collection = LINK_COLLECTION[token.type];
          if (!exists(collection, token.id)) {
            error('ref', file, `${token.raw}: there is no ${token.type} "${token.id}"`);
            break;
          }
          if (collection === 'people' || collection === 'places' || collection === 'sources') {
            referenced[collection].add(token.id);
          }
          good.push(token);
          break;
        }
        case 'unknown':
          error('token', file, `${token.raw}: unknown link type "${token.type}"`);
      }
    }
    return good;
  }

  function checkCitations(
    entry: Entry<{ citations: Record<string, { source: string }>; draft: boolean }>,
    used: Set<string>,
  ) {
    for (const [key, def] of Object.entries(entry.data.citations)) {
      if (!exists('sources', def.source)) {
        error('ref', entry.file, `citations.${key}: there is no source "${def.source}"`);
      } else {
        referenced.sources.add(def.source);
      }
      if (!entry.data.draft && !used.has(key)) {
        releaseRule('unused-citation', entry.file, `citations.${key} is defined but never cited in the text`);
      }
    }
  }

  const usedKeys = (tokens: Token[]) =>
    new Set(tokens.flatMap((token) => (token.kind === 'cite' ? [token.key] : [])));

  // --- events ---------------------------------------------------------------
  const eraById = new Map(parsed.eras.map((era) => [era.id, era]));
  const eventById = new Map(parsed.events.map((event) => [event.id, event]));
  const dated = (event: Entry<EventData>) => ({
    eraOrder: eraById.get(event.data.era)?.data.order ?? 0,
    date: event.data.date,
    order: event.data.order,
    title: event.data.title,
  });

  for (const event of parsed.events) {
    const { data, file } = event;

    const folder = file.split('/').at(-2);
    if (folder !== data.era) {
      error('era-folder', file, `The file is in "${folder}" but its era is "${data.era}"`);
    }

    if (!exists('eras', data.era)) error('ref', file, `era: there is no era "${data.era}"`);
    for (const id of data.places) {
      if (exists('places', id)) referenced.places.add(id);
      else error('ref', file, `places: there is no place "${id}"`);
    }
    for (const id of data.people) {
      if (exists('people', id)) referenced.people.add(id);
      else error('ref', file, `people: there is no person "${id}"`);
    }
    for (const id of data.threads) {
      if (!exists('threads', id)) error('ref', file, `threads: there is no thread "${id}"`);
    }
    for (const id of data.follows) {
      if (id === event.id) error('follows', file, 'An event cannot follow itself');
      else if (!exists('events', id)) error('ref', file, `follows: there is no event "${id}"`);
    }

    const bodyTokens = checkText(file, event.body, data.citations);
    const otherTokens = [
      ...checkText(file, data.dating ?? '', data.citations),
      ...checkText(file, data.summary, data.citations),
    ];
    checkCitations(event, usedKeys([...bodyTokens, ...otherTokens]));

    if (data.draft) {
      releaseRule('draft', file, 'Entry is still a draft');
      continue;
    }

    if (!bodyTokens.some((t) => t.kind === 'bible' || t.kind === 'cite')) {
      error('primary', file, 'The narrative cites no primary source: add a [[bible:…]] or [[cite:…]] citation');
    }
    if (data.date.confidence !== 'firm' && !data.dating?.trim()) {
      error('dating', file, `A "${data.date.confidence}" date needs a dating note explaining its basis`);
    }
    if (data.places.length === 0 && data.date.confidence !== 'undated') {
      error('place', file, 'A dated event needs at least one place');
    }
    if (!data.reviewed) releaseRule('reviewed', file, 'The citations have not been independently checked yet');

    const words = countWords(event.body);
    if (words < MIN_WORDS || words > MAX_WORDS) {
      warning('length', file, `The narrative has ${words} words; aim for ${MIN_WORDS}–${MAX_WORDS}`);
    }

    const era = eraById.get(data.era);
    const year = data.date.start;
    if (era && year !== undefined) {
      const { start, end } = era.data;
      if (
        (start !== undefined && year < start - ERA_MARGIN_YEARS) ||
        (end !== undefined && year > end + ERA_MARGIN_YEARS)
      ) {
        warning('era-range', file, `Year ${year} lies well outside the era "${era.data.title}" (${era.data.span})`);
      }
    }

    for (const id of data.follows) {
      const earlier = eventById.get(id);
      if (earlier && id !== event.id && compareDated(dated(earlier), dated(event)) > 0) {
        warning('follows-order', file, `follows "${id}", which comes later in the timeline`);
      }
    }
  }

  // Cycles in the follows graph.
  const state = new Map<string, 'open' | 'done'>();
  const visit = (id: string, path: string[]): void => {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'open') {
      const cycle = [...path.slice(path.indexOf(id)), id];
      error('follows', eventById.get(id)!.file, `follows forms a cycle: ${cycle.join(' → ')}`);
      return;
    }
    state.set(id, 'open');
    for (const next of eventById.get(id)?.data.follows ?? []) {
      if (next !== id && eventById.has(next)) visit(next, [...path, id]);
    }
    state.set(id, 'done');
  };
  for (const event of parsed.events) visit(event.id, []);

  // --- people and places -----------------------------------------------------
  for (const entry of [...parsed.people, ...parsed.places]) {
    const tokens = [
      ...checkText(entry.file, entry.body, entry.data.citations),
      ...checkText(entry.file, entry.data.summary, entry.data.citations),
    ];
    checkCitations(entry, usedKeys(tokens));
  }

  for (const place of parsed.places) {
    if (!place.data.draft && place.data.lat === 0 && place.data.lon === 0) {
      error('place', place.file, 'Coordinates are still 0, 0');
    }
  }

  for (const [kind, entries] of [
    ['person', parsed.people],
    ['place', parsed.places],
  ] as const) {
    const owners = new Map<string, string>();
    for (const entry of entries) {
      for (const name of new Set([entry.data.name, ...entry.data.altNames].map(normaliseName))) {
        if (!name) continue;
        const owner = owners.get(name);
        if (owner && owner !== entry.id) {
          error('duplicate', entry.file, `The ${kind} name "${name}" is already used by "${owner}"`);
        } else {
          owners.set(name, entry.id);
        }
      }
    }
  }

  // --- sources, threads, eras ------------------------------------------------
  for (const entry of [...parsed.sources, ...parsed.threads, ...parsed.eras]) {
    checkText(entry.file, entry.body, undefined);
    checkText(entry.file, entry.data.summary, undefined);
  }

  // --- drafts and orphans ----------------------------------------------------
  for (const entry of [...parsed.people, ...parsed.places, ...parsed.sources]) {
    if (entry.data.draft) releaseRule('draft', entry.file, 'Entry is still a draft');
  }
  for (const name of ['people', 'places', 'sources'] as const) {
    for (const entry of parsed[name]) {
      if (!referenced[name].has(entry.id)) {
        releaseRule('orphan', entry.file, `No event refers to this ${name === 'people' ? 'person' : name.slice(0, -1)}`);
      }
    }
  }

  return issues.sort((a, b) => a.file.localeCompare(b.file) || a.code.localeCompare(b.code));
}
