/**
 * A book, as the EPUB and the PDF are both made from it: a run of documents
 * in reading order. Each document is a piece of XHTML in which a link to
 * another entry is written `book:<kind>/<id>`; the two writers turn those
 * into links of their own kind.
 */
export const BOOK_SCHEME = 'book:';

/** What a link in the book points at: `book:person/jehoiachin`, `book:part/people`. */
export const bookRef = (kind: string, id: string): string => `${BOOK_SCHEME}${kind}/${id}`;

export type BookDocKind = 'title' | 'part' | 'era' | 'event' | 'thread' | 'index' | 'page';

export interface BookDoc {
  /** The document's file name without extension. Unique in the book. */
  id: string;
  kind: BookDocKind;
  /** Its title in the table of contents. */
  title: string;
  /** 1 for a part, 2 for a chapter, 3 for a section of a chapter. */
  level: 1 | 2 | 3;
  /** The entries this document holds: what links point at, and the `id` of the element they land on ('' for the document itself). */
  targets: { ref: string; anchor: string }[];
  /** The body, as XHTML. */
  html: string;
}

export interface BookMeta {
  /** The wiki's name: the book's title. */
  title: string;
  tagline: string;
  description: string;
  language: string;
  dir: 'ltr' | 'rtl';
  /** The same for every edition of this book in this language, so that a reader's device knows a new edition as the same book. */
  identifier: string;
  /** When this edition was made. */
  modified: Date;
  /** "Edition of 4 October 2026". */
  edition: string;
  /** Where the wiki is published. */
  url: string;
  rights?: string;
  /** The file name of the book without extension: `christwiki`, `christwiki-de`. */
  slug: string;
  labels: {
    contents: string;
    /** The parts, for the line of links at the foot of every page of the PDF. */
    parts: { ref: string; title: string }[];
  };
}

export interface Book {
  meta: BookMeta;
  docs: BookDoc[];
}
