/**
 * The Astro integration. A wiki's `astro.config.mjs` needs one line of it:
 *
 *   integrations: [chronowiki()]
 *
 * It adds every page of the wiki to the site, hands the wiki's settings
 * (`wiki.config.ts`) to the theme, and builds the search index after the pages.
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONFIG_NAMES = ['wiki.config.ts', 'wiki.config.mts', 'wiki.config.mjs', 'wiki.config.js'];
const VIRTUAL = 'virtual:chronowiki/config';
const RESOLVED = `\0${VIRTUAL}`;
const VIRTUAL_CSS = 'virtual:chronowiki/css';
const RESOLVED_CSS = `\0${VIRTUAL_CSS}`;

const route = (name) => new URL(`./src/routes/${name}`, import.meta.url);

/** Every page, once, for all languages: `[...locale]` is empty for the first language and its code for the others. */
const ROUTES = [
  ['/[...locale]', 'index.astro'],
  ['/[...locale]/map', 'map.astro'],
  ['/[...locale]/about', 'about.astro'],
  ['/[...locale]/events/[id]', 'event.astro'],
  ['/[...locale]/people', 'people.astro'],
  ['/[...locale]/people/[id]', 'person.astro'],
  ['/[...locale]/places', 'places.astro'],
  ['/[...locale]/places/[id]', 'place.astro'],
  ['/[...locale]/sources', 'sources.astro'],
  ['/[...locale]/sources/[id]', 'source.astro'],
  ['/[...locale]/threads', 'threads.astro'],
  ['/[...locale]/threads/[id]', 'thread.astro'],
  ['/[...locale]/eras/[id]', 'era.astro'],
  ['/[...locale]/data/map.json', 'map-data.ts'],
  ['/[...locale]/404', '404-localized.astro'],
  ['/404', '404.astro'],
  ['/sitemap.xml', 'sitemap.ts'],
  ['/robots.txt', 'robots.ts'],
];

/**
 * @param {{ config?: string, css?: string[], search?: boolean }} [options]
 *   `config`: where the wiki's settings are, if not `wiki.config.ts` beside `astro.config.mjs`.
 *   `css`: the wiki's own stylesheets, loaded after the theme's, for its colours and typefaces.
 *   `search`: set to false to build without the search index.
 * @returns {import('astro').AstroIntegration}
 */
export default function chronowiki(options = {}) {
  return {
    name: 'chronowiki',
    hooks: {
      'astro:config:setup'({ config, injectRoute, updateConfig, addWatchFile }) {
        const root = fileURLToPath(config.root);
        const configFile = options.config
          ? resolve(root, options.config)
          : CONFIG_NAMES.map((name) => join(root, name)).find((path) => existsSync(path));
        if (!configFile || !existsSync(configFile)) {
          throw new Error(
            `chronowiki: there is no ${options.config ?? 'wiki.config.ts'} in ${root}. It holds the wiki's name, languages and regions; see the README.`,
          );
        }
        addWatchFile(configFile);
        const stylesheets = (options.css ?? []).map((file) => resolve(root, file));
        const lost = stylesheets.find((file) => !existsSync(file));
        if (lost) throw new Error(`chronowiki: the stylesheet ${lost} does not exist`);

        for (const [pattern, file] of ROUTES) injectRoute({ pattern, entrypoint: route(file) });

        updateConfig({
          // Addresses end in a slash and every page is a folder, so links are the same on every host.
          trailingSlash: 'always',
          build: { format: 'directory' },
          vite: {
            plugins: [
              {
                name: 'chronowiki:config',
                resolveId: (id) => (id === VIRTUAL ? RESOLVED : id === VIRTUAL_CSS ? RESOLVED_CSS : undefined),
                load(id) {
                  if (id === RESOLVED) return `export { default } from ${JSON.stringify(configFile)};`;
                  if (id === RESOLVED_CSS) return stylesheets.map((file) => `import ${JSON.stringify(file)};`).join('\n');
                  return undefined;
                },
              },
            ],
            // The theme is TypeScript and Astro files, built with the wiki rather than loaded as a finished package.
            ssr: { noExternal: ['chronowiki'] },
            // The map's libraries are loaded on demand. Listing them lets the dev server
            // prepare them at start-up instead of re-bundling in the middle of a session.
            optimizeDeps: { include: ['chronowiki > d3-geo', 'chronowiki > d3-selection', 'chronowiki > d3-transition', 'chronowiki > d3-zoom', 'chronowiki > topojson-client'] },
          },
        });
      },

      async 'astro:build:done'({ dir, logger }) {
        if (options.search === false) return;
        const out = fileURLToPath(dir);
        const pagefind = await import('pagefind');
        const { index, errors } = await pagefind.createIndex();
        if (!index) throw new Error(`chronowiki: the search index could not be started: ${errors.join('; ')}`);
        const added = await index.addDirectory({ path: out });
        if (added.errors.length > 0) throw new Error(`chronowiki: the search index failed: ${added.errors.join('; ')}`);
        await index.writeFiles({ outputPath: join(out, 'pagefind') });
        await pagefind.close();
        logger.info(`search index built from ${added.page_count} pages`);
      },
    },
  };
}
