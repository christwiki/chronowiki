/**
 * Finds and loads a wiki's `wiki.config.ts` for the command-line tools. The
 * site build reads the same file through `virtual:chronowiki/config`.
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { WikiConfig } from './types';

export const CONFIG_NAMES = ['wiki.config.ts', 'wiki.config.mts', 'wiki.config.mjs', 'wiki.config.js'];

export function findWikiConfig(root: string = process.cwd()): string | undefined {
  return CONFIG_NAMES.map((name) => join(resolve(root), name)).find((path) => existsSync(path));
}

export async function loadWikiConfig(root: string = process.cwd()): Promise<WikiConfig> {
  const path = findWikiConfig(root);
  if (!path) {
    throw new Error(`No wiki.config.ts in ${resolve(root)}. Run the command from the wiki's folder.`);
  }
  const loaded = (await import(pathToFileURL(path).href)) as { default?: WikiConfig };
  const config = loaded.default;
  if (!config || !Array.isArray(config.locales)) {
    throw new Error(`${path} must export the result of defineWiki() as its default export.`);
  }
  return config;
}
