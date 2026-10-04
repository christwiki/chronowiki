/**
 * Reads the content files from disk for the scripts. Astro loads the same files
 * through its content collections; this loader exists so that validation and
 * link checking can run without starting Astro.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { COLLECTIONS } from '../content/schemas';
import type { RawContent, RawEntry } from './validate';

export const CONTENT_ROOT = 'src/content';

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/** Front matter is parsed with js-yaml, the parser Astro itself uses, so both accept and reject the same files. */
export function splitFrontMatter(text: string): { data: unknown; body: string } {
  const match = FRONT_MATTER.exec(text);
  if (!match) return { data: {}, body: text };
  return { data: parseYaml(match[1]) ?? {}, body: match[2] };
}

function markdownFiles(dir: string): string[] {
  let names: string[];
  try {
    names = readdirSync(dir, { recursive: true }) as string[];
  } catch {
    return [];
  }
  return names
    .filter((name) => name.endsWith('.md'))
    .map((name) => join(dir, name))
    .sort();
}

export function loadContent(root = CONTENT_ROOT): RawContent {
  const content = {} as RawContent;
  for (const collection of COLLECTIONS) {
    content[collection] = markdownFiles(join(root, collection)).map((path): RawEntry => {
      const file = relative(root, path).split(sep).join('/');
      const entry: RawEntry = { id: basename(path, '.md'), file, data: {}, body: '' };
      try {
        Object.assign(entry, splitFrontMatter(readFileSync(path, 'utf8')));
      } catch (error) {
        entry.parseError = (error as Error).message.split('\n')[0];
      }
      return entry;
    });
  }
  return content;
}

/** A translation file: `i18n/<language>/<collection>/<id>.md`. */
export interface RawTranslation extends RawEntry {
  locale: string;
  collection: string;
}

function read(root: string, path: string): RawEntry {
  const file = relative(root, path).split(sep).join('/');
  const entry: RawEntry = { id: basename(path, '.md'), file, data: {}, body: '' };
  try {
    Object.assign(entry, splitFrontMatter(readFileSync(path, 'utf8')));
  } catch (error) {
    entry.parseError = (error as Error).message.split('\n')[0];
  }
  return entry;
}

/** The pages of running text that are not entries, such as the method page. */
export function loadPages(root = CONTENT_ROOT): RawEntry[] {
  return markdownFiles(join(root, 'pages')).map((path) => read(root, path));
}

export function loadTranslations(root = CONTENT_ROOT): RawTranslation[] {
  return markdownFiles(join(root, 'i18n')).map((path) => {
    const entry = read(root, path);
    const [, locale = '', collection = ''] = entry.file.split('/');
    return { ...entry, locale, collection };
  });
}
