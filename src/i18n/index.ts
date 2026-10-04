/**
 * What a page or component needs to speak one language: messages, links,
 * dates, numbers and sorting. `useI18n(Astro)` reads the language from the
 * route; everything else follows from it.
 */
import config from 'virtual:chronowiki/config';
import { formatDate, lifespan, spokenDate, type Confidence, type DateStyle, type WikiDate } from '../lib/dates';
import { joinBase } from '../lib/paths';
import { activeLocales, DEFAULT_LOCALE, getLocale, isDefaultLocale, LOCALES } from './locales';
import { lookup, translate } from './translate';
import type { LocaleDef, MessageKey, MessageParams } from './types';

export { activeLocales, DEFAULT_LOCALE, getLocale, isDefaultLocale, LOCALES } from './locales';
export type { LocaleDef, MessageKey, MessageOverrides, Messages } from './types';

const base = () => import.meta.env?.BASE_URL ?? '/';

/** A page's address in a language: the first language at the root, every other under its code. */
export function localizedPath(path: string, code: string): string {
  return isDefaultLocale(code) ? path : `/${code}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * The address of the current page without the site's base path and without
 * its language: `/de/events/x/` and `/events/x/` both give `/events/x/`.
 */
export function neutralPath(pathname: string): string {
  const prefix = base().replace(/\/$/, '');
  let path = prefix && pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
  if (!path.startsWith('/')) path = `/${path}`;
  const first = path.split('/')[1];
  if (first && !isDefaultLocale(first) && LOCALES.some((locale) => locale.code === first)) {
    path = path.slice(first.length + 1) || '/';
  }
  return path;
}

export interface I18n {
  locale: LocaleDef;
  /** The language's code, as in `lang="de"`. */
  code: string;
  dir: 'ltr' | 'rtl';
  t(key: MessageKey, params?: MessageParams): string;
  /** Link to a page in this language. Every internal link goes through here. */
  href(path: string): string;
  /** Link to a file that is the same in every language: map shapes, the search index, the icon. */
  asset(path: string): string;
  dates: DateStyle;
  date(date: WikiDate): string;
  spokenDate(date: WikiDate): string;
  lifespan(born?: WikiDate, died?: WikiDate): string | undefined;
  /** A calendar day of our own time, such as the day an entry was checked. */
  day(date: Date): string;
  number(value: number): string;
  list(items: string[]): string;
  /** Alphabetical order as the language sorts. */
  compare(a: string, b: string): number;
  /** The name of a map region, as the wiki's settings give it. */
  region(id: string): string;
  /** The name of a source's language, by the name its record gives. */
  languageName(english: string): string;
  /** The name of the language the wiki is written in, for "shown in English". */
  originalLanguage: string;
  /** The same page in every language being built, for the language switch and for search engines. */
  alternates(pathname: string): { code: string; name: string; href: string; current: boolean }[];
  /** "←" and "→" point the other way where the text runs right to left. */
  arrow: { back: string; forward: string };
}

const cache = new Map<string, I18n>();

export function i18nFor(code: string = DEFAULT_LOCALE): I18n {
  const cached = cache.get(code);
  if (cached) return cached;

  const locale = getLocale(code);
  const { messages } = locale;
  const dates: DateStyle = { locale: code, templates: messages.date };
  const t = (key: MessageKey, params?: MessageParams) => translate(messages, code, key, params);
  const numbers = new Intl.NumberFormat(code);
  const lists = new Intl.ListFormat(code, { type: 'conjunction' });
  const collator = new Intl.Collator(code);
  // English days are written day first, like the dates of the timeline: "4 October 2026".
  const days = new Intl.DateTimeFormat(code === 'en' ? 'en-GB' : code, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const confidence = (level: Confidence) => t(`confidence.${level}.label`);

  const i18n: I18n = {
    locale,
    code,
    dir: locale.dir,
    t,
    href: (path) => joinBase(base(), localizedPath(path, code)),
    asset: (path) => joinBase(base(), path),
    dates,
    date: (date) => formatDate(date, dates),
    // The label continues a sentence, so its first letter is written small; nouns keep their capitals.
    spokenDate: (date) => {
      const label = confidence(date.confidence);
      return spokenDate(date, label.charAt(0).toLocaleLowerCase(code) + label.slice(1), dates);
    },
    lifespan: (born, died) => lifespan(born, died, dates),
    day: (date) => days.format(date),
    number: (value) => numbers.format(value),
    list: (items) => lists.format(items),
    compare: (a, b) => collator.compare(a, b),
    region: (id) => config.regionNames[code]?.[id] ?? id,
    originalLanguage: new Intl.DisplayNames(code, { type: 'language' }).of(DEFAULT_LOCALE) ?? getLocale(DEFAULT_LOCALE).name,
    languageName(english) {
      const one = (name: string) => lookup(messages.languages, name);
      const whole = one(english);
      if (typeof whole === 'string') return whole;
      // "Greek and Latin", "Hebrew, Aramaic and Greek": translate when every part is known.
      const parts = english.split(/,\s*|\s+and\s+/).map((part) => one(part.trim()));
      return parts.length > 1 && parts.every((part) => typeof part === 'string') ? lists.format(parts as string[]) : english;
    },
    alternates(pathname) {
      const path = neutralPath(pathname);
      return activeLocales().map((other) => ({
        code: other.code,
        name: other.name,
        href: joinBase(base(), localizedPath(path, other.code)),
        current: other.code === code,
      }));
    },
    arrow: locale.dir === 'rtl' ? { back: '→', forward: '←' } : { back: '←', forward: '→' },
  };
  cache.set(code, i18n);
  return i18n;
}

/** The language of an address: the code that opens it, or the wiki's first language. */
export function localeOfPath(pathname: string): string {
  const prefix = base().replace(/\/$/, '');
  const path = prefix && pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
  const first = path.split('/').filter(Boolean)[0];
  return first && LOCALES.some((locale) => locale.code === first) ? first : DEFAULT_LOCALE;
}

/** The language of the page being rendered: from its route, or failing that from its address. */
export function useI18n(astro: { params?: Record<string, string | undefined>; url: URL }): I18n {
  return i18nFor(astro.params?.locale ?? localeOfPath(astro.url.pathname));
}

/**
 * The `locale` route parameter for every language being built: `undefined`
 * for the first language, whose pages sit at the root, and the code for every other.
 */
export function localeParams(): { locale: string | undefined }[] {
  return activeLocales().map((locale) => ({ locale: isDefaultLocale(locale.code) ? undefined : locale.code }));
}
