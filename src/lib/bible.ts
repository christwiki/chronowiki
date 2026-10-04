/**
 * Bible references. An author writes `[[bible:2 Kings 25:8-10]]`, in English
 * and in every translation alike: the reference is markup, not prose. This
 * module checks that the book, chapter and verses exist, and produces the label
 * a reader sees and the link into a Bible reader, both in the reader's language.
 */
import { bcv_parser } from 'bible-passage-reference-parser/esm/bcv_parser.js';
import * as lang from 'bible-passage-reference-parser/esm/lang/en.js';
import { EN_BOOKS } from '../i18n/bible/en';

export interface BibleBookNames {
  /** Full name: "2 Kings". */
  name: string;
  /** Abbreviation: "2 Kgs". */
  short: string;
  /**
   * How the Bible reader's address names the book, where that cannot be derived
   * from `name`; `null` where the reader does not carry the book.
   */
  query?: string | null;
}

/** How one language writes Bible references and where its links go. */
export interface BibleStyle {
  /** Names shown to readers: "Links open the passage in the {version} at {reader}." */
  reader: string;
  version: string;
  /** The public-domain version that entries in this language quote. */
  quoted: string;
  books: Record<string, BibleBookNames>;
  /** One psalm is a "Psalm", several are "Psalms". */
  psalm: { name: string; short: string };
  /** Between chapter and verse: ":" in English, "," in German. */
  chapterVerse: string;
  /** Between verses of one chapter: ", " in English, "." in German. */
  verseList: string;
  /**
   * The kind of reader. BibleGateway takes a whole reference in one address;
   * Bibleserver takes one passage, so a reference to two passages becomes two links.
   */
  link: 'biblegateway' | 'bibleserver';
  /** The reader's code for the version: "NRSVUE", "EU". */
  linkVersion: string;
}

/**
 * English, and the fallback wherever another language's reader lacks a book.
 * NRSVUE is the ecumenical academic standard and includes the deuterocanonical books.
 */
export const EN_BIBLE: BibleStyle = {
  reader: 'BibleGateway',
  version: 'NRSVUE',
  quoted: 'World English Bible',
  books: EN_BOOKS,
  psalm: { name: 'Psalm', short: 'Ps' },
  chapterVerse: ':',
  verseList: ', ',
  link: 'biblegateway',
  linkVersion: 'NRSVUE',
};

export interface BibleLink {
  label: string;
  url: string;
}

export interface BibleRef {
  /** What the author wrote, trimmed. */
  input: string;
  /** Machine form, e.g. `2Kgs.25.8-2Kgs.25.10`. */
  osis: string;
  /** Reader-facing label with full book names: "2 Kings 25:8–10". */
  label: string;
  /** Compact label with abbreviations: "2 Kgs 25:8–10". */
  short: string;
  /** Link to the passage, or to the first passage where the reader takes one at a time. */
  url: string;
  /** The label cut into the pieces that each have their own link. One piece for most readers. */
  links: BibleLink[];
}

export class BibleRefError extends Error {}

/** Books with a single chapter, cited by verse alone ("Jude 3"). */
const SINGLE_CHAPTER = new Set(['Obad', 'Phlm', '2John', '3John', 'Jude', 'EpJer', 'PrAzar', 'Sus', 'Bel', 'PrMan']);

const EN_DASH = '–';

/** Notes the parser attaches to references it accepts as written. */
const HARMLESS_MESSAGES = new Set(['start_chapter_1', 'start_chapter_not_exist_in_single_chapter_book']);

let parser: bcv_parser | undefined;

function getParser(): bcv_parser {
  if (!parser) {
    parser = new bcv_parser(lang);
    parser.set_options({
      versification_system: 'nrsv',
      osis_compaction_strategy: 'b',
      consecutive_combination_strategy: 'separate',
      sequence_combination_strategy: 'separate',
      book_alone_strategy: 'full',
      invalid_passage_strategy: 'include',
      invalid_sequence_strategy: 'include',
    });
    parser.include_apocrypha(true);
  }
  return parser;
}

interface Point {
  book: string;
  chapter?: number;
  verse?: number;
}

interface Segment {
  start: Point;
  end?: Point;
}

function parsePoint(osis: string): Point {
  const [book, chapter, verse] = osis.split('.');
  return {
    book,
    chapter: chapter === undefined ? undefined : Number(chapter),
    verse: verse === undefined ? undefined : Number(verse),
  };
}

function parseSegment(osis: string): Segment {
  const [start, end] = osis.split('-');
  return { start: parsePoint(start), end: end === undefined ? undefined : parsePoint(end) };
}

type Form = 'label' | 'short' | 'query';

/** What is written between the parts of a reference in one form. */
interface Marks {
  dash: string;
  chapterVerse: string;
  verseList: string;
  passageList: string;
}

function marksFor(form: Form, style: BibleStyle): Marks {
  // The English reader's address is plain: "2 Kings 25:8-10,12; Jer 52:12".
  if (form === 'query') return { dash: '-', chapterVerse: ':', verseList: ',', passageList: '; ' };
  return { dash: EN_DASH, chapterVerse: style.chapterVerse, verseList: style.verseList, passageList: '; ' };
}

const isSingle = (book: string) => SINGLE_CHAPTER.has(book);

/** "12:1", "12", or for a single-chapter book just the verse. Empty for a whole book. */
function locator(point: Point, marks: Marks): string {
  if (point.chapter === undefined) return '';
  if (point.verse === undefined) return String(point.chapter);
  return isSingle(point.book) ? String(point.verse) : `${point.chapter}${marks.chapterVerse}${point.verse}`;
}

/** Whether the run of same-book segments starting at `index` covers more than one chapter. */
function coversSeveralChapters(segments: Segment[], index: number): boolean {
  const book = segments[index].start.book;
  const chapters = new Set<number | undefined>();
  for (let i = index; i < segments.length && segments[i].start.book === book; i++) {
    chapters.add(segments[i].start.chapter);
    if (segments[i].end) chapters.add(segments[i].end!.chapter);
  }
  return chapters.size > 1 || chapters.has(undefined);
}

function bookName(segments: Segment[], index: number, form: Form, style: BibleStyle): string {
  const id = segments[index].start.book;
  const short = form === 'short';
  if (id === 'Ps' && !coversSeveralChapters(segments, index)) return short ? style.psalm.short : style.psalm.name;
  return short ? style.books[id].short : style.books[id].name;
}

/** Whether a segment continues the chapter of the one before it: "…, 12" and not "; 26:12". */
function continuesChapter(previous: Point | undefined, start: Point): boolean {
  return (
    previous !== undefined &&
    previous.book === start.book &&
    start.verse !== undefined &&
    previous.verse !== undefined &&
    previous.chapter === start.chapter
  );
}

interface Piece {
  /** What stands before this piece when it is not the first. */
  separator: string;
  text: string;
  /** True where a new passage begins; false where the piece adds verses to the chapter before. */
  opens: boolean;
}

function pieces(segments: Segment[], form: Form, style: BibleStyle): Piece[] {
  const marks = marksFor(form, style);
  const out: Piece[] = [];
  let previous: Point | undefined;

  segments.forEach((segment, index) => {
    const { start, end } = segment;
    const sameBook = previous?.book === start.book;
    const opens = !continuesChapter(previous, start);

    let text: string;
    if (opens) {
      const where = locator(start, marks);
      // The reader query repeats the book name so every passage stands alone.
      const named = !sameBook || form === 'query';
      text = named ? [bookName(segments, index, form, style), where].filter(Boolean).join(' ') : where;
    } else {
      text = String(start.verse);
    }

    if (end) {
      if (end.book !== start.book) {
        const name = form === 'short' ? style.books[end.book].short : style.books[end.book].name;
        text += `${marks.dash}${[name, locator(end, marks)].filter(Boolean).join(' ')}`;
      } else if (end.verse !== undefined && (isSingle(start.book) || end.chapter === start.chapter)) {
        text += `${marks.dash}${end.verse}`;
      } else {
        text += `${marks.dash}${locator(end, marks)}`;
      }
    }

    out.push({ separator: opens ? marks.passageList : marks.verseList, text, opens });
    previous = end ?? start;
  });

  return out;
}

const join = (list: Piece[]) => list.map((piece, index) => (index === 0 ? '' : piece.separator) + piece.text).join('');

function format(segments: Segment[], form: Form, style: BibleStyle): string {
  return join(pieces(segments, form, style));
}

function gatewayUrl(segments: Segment[], version: string): string {
  // BibleGateway reads English references whatever version it shows.
  const query = format(segments, 'query', EN_BIBLE);
  return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(query)}&version=${version}`;
}

/** "2.Könige25,8-10.12": the form Bibleserver's addresses take. `undefined` where it lacks the book. */
function bibleserverQuery(passage: Segment[], style: BibleStyle): string | undefined {
  const { start } = passage[0];
  const names = style.books[start.book];
  if (names.query === null || passage.some((s) => s.end && s.end.book !== start.book)) return undefined;
  const book = names.query ?? names.name.replace(/^(\d) /, '$1.').replaceAll(' ', '');
  const point = (p: Point) => (p.verse === undefined ? String(p.chapter) : `${p.chapter},${p.verse}`);
  const range = (s: Segment, withChapter: boolean) => {
    const from = withChapter ? point(s.start) : String(s.start.verse);
    if (!s.end) return from;
    const sameChapter = s.end.chapter === s.start.chapter && s.end.verse !== undefined;
    return `${from}-${sameChapter ? s.end.verse : point(s.end)}`;
  };
  if (start.chapter === undefined) return book;
  return book + passage.map((segment, index) => range(segment, index === 0)).join('.');
}

function links(segments: Segment[], style: BibleStyle): BibleLink[] {
  const labelled = pieces(segments, 'label', style);
  if (style.link === 'biblegateway') {
    return [{ label: join(labelled), url: gatewayUrl(segments, style.linkVersion) }];
  }
  // One link for each passage, a passage being a chapter with whatever verses of it are listed.
  const out: BibleLink[] = [];
  let from = 0;
  for (let index = 1; index <= segments.length; index++) {
    if (index < segments.length && !labelled[index].opens) continue;
    const passage = segments.slice(from, index);
    const query = bibleserverQuery(passage, style);
    out.push({
      label: join(labelled.slice(from, index)),
      url: query
        ? `https://www.bibleserver.com/${style.linkVersion}/${encodeURIComponent(query)}`
        : gatewayUrl(passage, EN_BIBLE.linkVersion),
    });
    from = index;
  }
  return out;
}

/**
 * Parse and validate a Bible reference. Throws `BibleRefError` when the book is
 * unknown, a chapter or verse does not exist, or part of the input is not a
 * reference at all. The reference is always written in English; `style` decides
 * how it is shown and where it links.
 */
export function parseBibleRef(raw: string, style: BibleStyle = EN_BIBLE): BibleRef {
  const input = raw.trim();
  if (!input) throw new BibleRefError('Empty Bible reference');

  const entities = getParser().parse(input).parsed_entities();
  if (entities.length === 0) throw new BibleRefError(`No Bible reference found in "${input}"`);

  let covered = 0;
  const segments: Segment[] = [];
  const osisParts: string[] = [];

  for (const entity of entities) {
    const [from, to] = entity.indices;
    if (/[^\s;,]/.test(input.slice(covered, from))) {
      throw new BibleRefError(`"${input.slice(covered, from).trim()}" in "${input}" is not a Bible reference`);
    }
    covered = to;

    for (const part of entity.entities ?? []) {
      const problems = Object.keys(part.valid.messages ?? {}).filter((m) => !HARMLESS_MESSAGES.has(m));
      if (!part.valid.valid || problems.length > 0) {
        throw new BibleRefError(
          `"${input.slice(from, to)}" does not exist (${problems.join(', ') || 'invalid passage'})`,
        );
      }
    }
    if (!entity.osis) throw new BibleRefError(`"${input.slice(from, to)}" is not a valid passage`);

    for (const osis of entity.osis.split(',')) {
      const segment = parseSegment(osis);
      for (const point of [segment.start, segment.end]) {
        if (point && !EN_BOOKS[point.book]) throw new BibleRefError(`Unsupported book "${point.book}" in "${input}"`);
      }
      segments.push(segment);
      osisParts.push(osis);
    }
  }

  if (/[^\s;,]/.test(input.slice(covered))) {
    throw new BibleRefError(`"${input.slice(covered).trim()}" in "${input}" is not a Bible reference`);
  }

  const passageLinks = links(segments, style);
  return {
    input,
    osis: osisParts.join(','),
    label: format(segments, 'label', style),
    short: format(segments, 'short', style),
    url: passageLinks[0].url,
    links: passageLinks,
  };
}
