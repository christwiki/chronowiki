/**
 * Starts a new wiki in a folder, from the example that comes with the theme.
 *
 *   npx github:christwiki/chronowiki init my-wiki
 *
 * The new wiki holds the example's entries, so it builds and can be looked at
 * at once. Replace them with your own.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const target = process.argv[2];
if (!target || target.startsWith('-')) {
  console.error('Usage: chronowiki init <folder>');
  process.exit(2);
}

const root = fileURLToPath(new URL('..', import.meta.url));
const example = join(root, 'example');
const destination = resolve(target);

if (existsSync(destination) && readdirSync(destination).length > 0) {
  console.error(`${destination} is not empty. Name a new folder.`);
  process.exit(2);
}

const LEFT_OUT = new Set(['node_modules', 'dist', '.astro', '.cache', 'package-lock.json']);
mkdirSync(destination, { recursive: true });
cpSync(example, destination, { recursive: true, filter: (source) => !LEFT_OUT.has(basename(source)) });

// The example depends on the theme beside it. A wiki of its own depends on the published theme.
const theme = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string };
const manifestPath = join(destination, 'package.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.name = basename(destination).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'my-wiki';
manifest.description = 'A history wiki built on a timeline.';
manifest.dependencies.chronowiki = `github:christwiki/chronowiki#v${theme.version}`;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

// npm leaves .gitignore files out of packages, so it is written here.
writeFileSync(join(destination, '.gitignore'), ['node_modules/', 'dist/', '.astro/', '.cache/', '.DS_Store', ''].join('\n'));

console.log(`A new wiki is in ${destination}

  cd ${target}
  npm install
  npm run dev

Then make it yours:
  wiki.config.ts        the wiki's name, languages and map regions
  src/content/          the entries: eras, events, people, places, sources, threads
  src/content/pages/    the page that says how the wiki is made

The entries that come with it are from Christwiki (CC BY-SA 4.0). Delete them when your own are in place.`);
