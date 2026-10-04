/**
 * What a wiki's `wiki.config.ts` imports:
 *
 *   import { defineWiki, english, german } from 'chronowiki/config';
 */
export { defineWiki, missingRegionNames } from './define';
export type { LocaleInput, RegionInput, WikiConfig, WikiInput } from './types';
export { english, german, mergeMessages, type LocaleOptions } from '../i18n/packs';
export type { LocaleDef, MessageOverrides, Messages, Plural } from '../i18n/types';
export { EN_BIBLE, type BibleBookNames, type BibleStyle } from '../lib/bible';
