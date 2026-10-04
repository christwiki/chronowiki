// @ts-check
import { defineConfig } from 'astro/config';
import chronowiki from 'chronowiki';

export default defineConfig({
  // The address the wiki will be published at. Sitemap and canonical links are built from it.
  site: process.env.SITE_URL ?? 'https://example.org',
  // Set BASE_PATH when the wiki is served from a sub-path, such as /my-wiki/ on GitHub Pages.
  base: process.env.BASE_PATH ?? '/',
  integrations: [chronowiki({ css: ['./src/styles/custom.css'] })],
});
