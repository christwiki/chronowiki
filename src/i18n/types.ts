import type { BibleStyle } from '../lib/bible';
import type { en } from './messages/en';

/** A message that changes with a number. Which forms a language needs is the language's business. */
export interface Plural {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

type Widen<T> = T extends string ? string : T extends { other: string } ? Plural : { [K in keyof T]: Widen<T[K]> };

/**
 * The shape every language's messages must have: exactly the keys of the
 * English file. The one open list is `languages`, to which a wiki may add.
 */
export type Messages = Omit<Widen<typeof en>, 'languages'> & { languages: Record<string, string> };

/** Some of the messages: what a wiki lays over the theme's wording. */
export type MessageOverrides = DeepPartial<Messages>;

type DeepPartial<T> = T extends string | Plural ? T : { [K in keyof T]?: DeepPartial<T[K]> };

type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string | Plural ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** Every message, by its dotted path: `nav.timeline`, `filter.count`. */
export type MessageKey = Leaves<Widen<typeof en>>;

export type MessageParams = Record<string, string | number>;

export interface LocaleDef {
  /** BCP 47 tag. It is the `lang` attribute and, for every language but the first, the URL prefix. */
  code: string;
  /** The language's own name for itself, for the language switch. */
  name: string;
  dir: 'ltr' | 'rtl';
  /**
   * A `live` language is published. A `preview` language is built for development
   * and testing only, until its translation is ready (see docs/languages.md).
   */
  status: 'live' | 'preview';
  /** Opening and closing double quotation marks, then opening and closing single ones. */
  quotes: readonly [string, string, string, string];
  /**
   * English titles open with "The", which is dropped or written small inside a
   * sentence. Languages whose titles do not work that way leave this out.
   */
  articleRule?: 'english';
  /** How Bible references are written and which reader they link to. Only wikis that cite the Bible use it. */
  bible: BibleStyle;
  messages: Messages;
}
