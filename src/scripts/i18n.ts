/**
 * The words the scripts in the browser use. The page hands them over in a
 * small JSON block (see `src/layouts/Base.astro`); nothing here is hard-coded
 * in one language.
 */
import { fill, lookup } from '../i18n/translate';
import type { MessageParams } from '../i18n/types';

interface Handover {
  locale: string;
  messages: unknown;
}

function read(): Handover {
  try {
    return JSON.parse(document.getElementById('i18n')?.textContent ?? '') as Handover;
  } catch {
    return { locale: document.documentElement.lang || 'en', messages: {} };
  }
}

const handover = read();

/** The language of the page. */
export const locale = handover.locale;

/** A message in the page's language. An unknown key gives the key itself, which shows the gap without breaking the page. */
export function t(key: string, params?: MessageParams): string {
  const message = lookup(handover.messages, key);
  return message === undefined ? key : fill(message, locale, params);
}
