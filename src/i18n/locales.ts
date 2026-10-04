/**
 * The languages of the wiki being built, from its `wiki.config.ts`. The first
 * is the language the content is written in.
 */
import config from 'virtual:chronowiki/config';
import type { LocaleDef } from './types';

/** The language the content is written in. Its pages have no prefix in their address. */
export const DEFAULT_LOCALE: string = config.defaultLocale;

export const LOCALES: LocaleDef[] = config.locales;

/**
 * Preview languages are built while developing, and in a build when
 * PREVIEW_LOCALES=true. A release build leaves them out.
 */
const PREVIEW =
  (typeof process !== 'undefined' && process.env.PREVIEW_LOCALES === 'true') || import.meta.env?.DEV === true;

/** The languages this build produces pages for. */
export function activeLocales(): LocaleDef[] {
  return LOCALES.filter((locale) => locale.status === 'live' || PREVIEW);
}

export function getLocale(code: string | undefined = DEFAULT_LOCALE): LocaleDef {
  const locale = LOCALES.find((candidate) => candidate.code === code);
  if (!locale) throw new Error(`Unknown language "${code}"`);
  return locale;
}

export const isDefaultLocale = (code: string) => code === DEFAULT_LOCALE;
