/**
 * Typographic quotation marks and apostrophes. The content files are written
 * with the plain marks on a keyboard; the site shows the marks of the
 * language: “these” and ‘these’ in English, „diese“ and ‚diese‘ in German.
 * Running the function twice changes nothing.
 */

/** Opening and closing double marks, then opening and closing single marks. */
export type Quotes = readonly [string, string, string, string];

export const EN_QUOTES: Quotes = ['“', '”', '‘', '’'];

const APOSTROPHE = '’';
const OPENS_AFTER = /[\s(\[{—–“‘„‚«‹/]/;
const WORD = /[\p{L}\p{N}]/u;

export function smarten(text: string, quotes: Quotes = EN_QUOTES): string {
  const [openDouble, closeDouble, openSingle, closeSingle] = quotes;
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char !== '"' && char !== "'") {
      out += char;
      continue;
    }
    const before = i === 0 ? ' ' : text[i - 1];
    const after = i === text.length - 1 ? ' ' : text[i + 1];
    const opening = OPENS_AFTER.test(before) && !/\s/.test(after);
    if (char === '"') out += opening ? openDouble : closeDouble;
    else if (opening) out += openSingle;
    // Inside a word, or after a plural's final s, the mark is an apostrophe in every language.
    else if (WORD.test(before) && (WORD.test(after) || /s/i.test(before))) out += APOSTROPHE;
    else out += closeSingle;
  }
  return out;
}

/**
 * The same for Markdown source: code spans and link targets are left alone,
 * since a quotation mark there is syntax and not text.
 */
export function smartenMarkdown(markdown: string, quotes: Quotes = EN_QUOTES): string {
  return markdown
    .split(/(`[^`]*`|\]\([^)]*\))/)
    .map((part, index) => (index % 2 === 1 ? part : smarten(part, quotes)))
    .join('');
}
