/**
 * Checks a language against the English messages: the same keys, the same
 * placeholders, nothing left empty, a name for every book of the Bible. The
 * validator runs it over every language of a wiki, with the wiki's own
 * wording laid over it, so a mistake in `wiki.config.ts` is caught as well.
 */
import { EN_BOOKS } from './bible/en';
import { en } from './messages/en';
import { placeholders } from './translate';
import type { LocaleDef, Plural } from './types';

/** Lists a wiki may add to: a key here that English lacks is not a mistake. */
const OPEN = ['languages.'];

/** Every message of a language, as [dotted key, message]. */
export function messageLeaves(node: unknown, prefix = ''): [string, string | Plural][] {
  if (typeof node === 'string') return [[prefix, node]];
  if (typeof node === 'object' && node !== null) {
    if (typeof (node as Plural).other === 'string') return [[prefix, node as Plural]];
    return Object.entries(node).flatMap(([key, value]) => messageLeaves(value, prefix ? `${prefix}.${key}` : key));
  }
  return [];
}

const textsOf = (message: string | Plural) => (typeof message === 'string' ? [message] : Object.values(message));

/** What is wrong with a language, one line per problem. Empty when nothing is. */
export function checkLocale(locale: LocaleDef): string[] {
  const problems: string[] = [];
  const source = new Map(messageLeaves(en));
  const own = new Map(messageLeaves(locale.messages));

  if (!/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/.test(locale.code)) {
    problems.push(`the code "${locale.code}" cannot open an address: use a tag such as "de" or "pt-BR"`);
  }
  for (const [key, message] of source) {
    const theirs = own.get(key);
    if (theirs === undefined) {
      problems.push(`the message "${key}" is missing`);
      continue;
    }
    if (typeof theirs !== typeof message) {
      problems.push(`the message "${key}" must be ${typeof message === 'string' ? 'a text' : 'a plural ({ one, other })'}`);
      continue;
    }
    // An English message that is empty is optional, and what a wiki puts there is its own.
    if (textsOf(message).every((text) => text === '')) continue;
    if (placeholders(theirs).join() !== placeholders(message).join()) {
      const wanted = placeholders(message).map((name) => `{${name}}`).join(', ') || 'none';
      problems.push(`the message "${key}" must have the placeholders of the English one: ${wanted}`);
    }
    if (textsOf(theirs).some((text) => text.trim().length === 0)) problems.push(`the message "${key}" is empty`);
  }
  for (const key of own.keys()) {
    if (!source.has(key) && !OPEN.some((prefix) => key.startsWith(prefix))) {
      problems.push(`there is no message "${key}"`);
    }
  }

  const books = Object.keys(EN_BOOKS);
  const named = new Set(Object.keys(locale.bible.books));
  const unnamed = books.filter((book) => !named.has(book));
  if (unnamed.length > 0) problems.push(`these books of the Bible have no name: ${unnamed.join(', ')}`);

  return problems;
}
