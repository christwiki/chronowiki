/**
 * The languages the theme speaks out of the box. A wiki lists the ones it
 * wants in `wiki.config.ts` and may lay its own wording over the theme's:
 *
 *   locales: [english({ messages: { site: { tagline: '…' } } }), german({ status: 'preview' })]
 *
 * Another language is a `LocaleDef` written out in full; docs/languages.md
 * walks through it.
 */
import { EN_BIBLE, type BibleStyle } from '../lib/bible';
import { DE_BOOKS } from './bible/de';
import { de } from './messages/de';
import { en } from './messages/en';
import type { LocaleDef, MessageOverrides, Messages, Plural } from './types';

export interface LocaleOptions {
  /** `live` (the default) is published; `preview` is built only while developing or when PREVIEW_LOCALES=true. */
  status?: LocaleDef['status'];
  /** The wiki's own wording, laid over the theme's: its tagline, its opening lines, its examples. */
  messages?: MessageOverrides;
  /** How Bible references are written and where they link, if not as the theme has it. */
  bible?: BibleStyle;
}

const isPlural = (value: unknown): value is Plural =>
  typeof value === 'object' && value !== null && typeof (value as Plural).other === 'string';

/** Lay a wiki's wording over a language's messages. A plural is replaced whole, never form by form. */
export function mergeMessages(base: Messages, over: MessageOverrides | undefined): Messages {
  if (!over) return base;
  const merge = (target: unknown, source: unknown): unknown => {
    if (typeof source !== 'object' || source === null || isPlural(source)) return source;
    const out: Record<string, unknown> = { ...(target as Record<string, unknown>) };
    for (const [key, value] of Object.entries(source)) {
      if (value !== undefined) out[key] = merge(out[key], value);
    }
    return out;
  };
  return merge(base, over) as Messages;
}

export function english(options: LocaleOptions = {}): LocaleDef {
  return {
    code: 'en',
    name: 'English',
    dir: 'ltr',
    status: options.status ?? 'live',
    quotes: ['“', '”', '‘', '’'],
    articleRule: 'english',
    bible: options.bible ?? EN_BIBLE,
    messages: mergeMessages(en, options.messages),
  };
}

export function german(options: LocaleOptions = {}): LocaleDef {
  return {
    code: 'de',
    name: 'Deutsch',
    dir: 'ltr',
    status: options.status ?? 'live',
    quotes: ['„', '“', '‚', '‘'],
    bible: options.bible ?? {
      // The Einheitsübersetzung includes the deuterocanonical books, as the NRSVUE does.
      reader: 'ERF Bibleserver',
      version: 'Einheitsübersetzung 2016',
      quoted: 'Lutherbibel 1912',
      books: DE_BOOKS,
      psalm: { name: 'Psalm', short: 'Ps' },
      chapterVerse: ',',
      verseList: '.',
      link: 'bibleserver',
      linkVersion: 'EU',
    },
    messages: mergeMessages(de, options.messages),
  };
}
