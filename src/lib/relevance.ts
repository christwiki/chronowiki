/**
 * Decides whether a search result really answers the query.
 *
 * When no word in the index matches, Pagefind falls back to ever shorter
 * beginnings of the word, down to a single letter, and returns whatever
 * contains that. A result counts only if a word it marks begins like one of
 * the words searched for.
 */
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
const NOT_WORD = /[^\p{L}\p{N}]+/gu;

export function isRelevant(excerpt: string, query: string): boolean {
  const terms = fold(query).split(NOT_WORD).filter(Boolean);
  const marked = [...excerpt.matchAll(/<mark>(.*?)<\/mark>/g)].map((match) => fold(match[1]).replace(NOT_WORD, ''));
  return marked.some((word) =>
    terms.some((term) => {
      const need = Math.min(3, term.length);
      return word.length >= need && word.slice(0, need) === term.slice(0, need);
    }),
  );
}
