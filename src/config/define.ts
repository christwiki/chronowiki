/**
 * `defineWiki()` turns what a wiki says about itself into the settings the
 * theme and the command-line tools read. It is pure, so the same
 * `wiki.config.ts` works in the site build and in the tools.
 */
import { english } from '../i18n/packs';
import type { LocaleDef } from '../i18n/types';
import { EN_BIBLE } from '../lib/bible';
import type { WikiConfig, WikiInput } from './types';

export type { LocaleInput, RegionInput, WikiConfig, WikiInput } from './types';

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function defineWiki(input: WikiInput): WikiConfig {
  const given = input.locales && input.locales.length > 0 ? input.locales : [english()];
  const locales = given.map((locale): LocaleDef => ({ ...locale, status: locale.status ?? 'live', bible: locale.bible ?? EN_BIBLE }));
  const codes = locales.map((locale) => locale.code);
  const repeated = codes.find((code, index) => codes.indexOf(code) !== index);
  if (repeated) throw new Error(`wiki.config: the language "${repeated}" is listed twice`);

  const defaultLocale = locales[0].code;
  const regions = input.regions.map((region) => region.id);
  for (const id of regions) {
    if (!ID.test(id)) throw new Error(`wiki.config: the region id "${id}" must be lower-case words joined by hyphens`);
  }

  const nameIn = (name: string | Record<string, string>, code: string) =>
    typeof name === 'string' ? name : (name[code] ?? name[defaultLocale] ?? Object.values(name)[0]);
  const regionNames: WikiConfig['regionNames'] = {};
  for (const code of codes) {
    regionNames[code] = Object.fromEntries(input.regions.map((region) => [region.id, nameIn(region.name, code) ?? region.id]));
  }

  return {
    name: input.name,
    repository: input.repository,
    license: input.license,
    favicon: input.favicon,
    locales,
    defaultLocale,
    regions,
    regionNames,
  };
}

/** Languages whose name for a region was not given, so the default language's is shown: `[code, region id]`. */
export function missingRegionNames(input: WikiInput): [string, string][] {
  const codes = (input.locales ?? []).map((locale) => locale.code);
  const missing: [string, string][] = [];
  for (const region of input.regions) {
    if (typeof region.name === 'string') continue;
    for (const code of codes) if (region.name[code] === undefined) missing.push([code, region.id]);
  }
  return missing;
}
