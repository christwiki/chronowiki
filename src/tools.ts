/**
 * What a wiki's own scripts may use: the content as the validator reads it,
 * the schemas, and the wiki's settings. None of it needs Astro.
 */
export { CONFIDENCE_LEVELS, COLLECTIONS, ID_PATTERN, SCHEMAS } from './content/schemas';
export { loadWikiConfig } from './config/load';
export { checkLocale } from './i18n/check';
export { sourceHash, wordsOf } from './i18n/overlay';
export { parseBibleRef } from './lib/bible';
export { compareDated, type Confidence, type WikiDate } from './lib/dates';
export { CONTENT_ROOT, loadContent, loadPages, loadTranslations, splitFrontMatter } from './lib/load';
export { scanTokens } from './lib/prose';
export { validateContent, type Issue, type RawContent, type RawEntry } from './lib/validate';
export { validateTranslations } from './lib/validate-i18n';
