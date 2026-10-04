/**
 * Looks a message up and fills it in. Plain functions with no dependency on
 * Astro or Node, because the pages and the scripts in the browser both use them.
 */
import type { MessageParams, Plural } from './types';

const isPlural = (value: unknown): value is Plural =>
  typeof value === 'object' && value !== null && typeof (value as Plural).other === 'string';

/** The message at a dotted path, or undefined. */
export function lookup(messages: unknown, key: string): string | Plural | undefined {
  let node = messages;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' || isPlural(node) ? node : undefined;
}

/**
 * Fill a message in. A plural message takes its form from `count` by the
 * language's own rules. Numbers are written the way the language writes them
 * ("1,037" or "1.037"); pass a string where that is not wanted, as for years.
 */
export function fill(message: string | Plural, locale: string, params: MessageParams = {}): string {
  let template: string;
  if (typeof message === 'string') {
    template = message;
  } else {
    const form = new Intl.PluralRules(locale).select(Number(params.count ?? 0));
    template = message[form] ?? message.other;
  }
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = params[name];
    if (value === undefined) return placeholder;
    return typeof value === 'number' ? new Intl.NumberFormat(locale).format(value) : value;
  });
}

export function translate(messages: unknown, locale: string, key: string, params?: MessageParams): string {
  const message = lookup(messages, key);
  if (message === undefined) throw new Error(`Unknown message "${key}"`);
  return fill(message, locale, params);
}

/** The names of the placeholders in a message, for checking a translation against its original. */
export function placeholders(message: string | Plural): string[] {
  const texts = typeof message === 'string' ? [message] : Object.values(message);
  return [...new Set(texts.flatMap((text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1])))].sort();
}
