/**
 * Join the site's base path and a root-relative path. Page paths always end in a
 * slash (the site is built with `trailingSlash: 'always'`); paths to files keep
 * their extension. Query strings and fragments are preserved.
 *
 * Pages do not call this directly: links go through `useI18n(Astro).href`, which
 * also puts the page's language into the address (see `src/i18n/index.ts`).
 */
export function joinBase(base: string, path: string): string {
  const cut = path.search(/[?#]/);
  const pathname = cut === -1 ? path : path.slice(0, cut);
  const suffix = cut === -1 ? '' : path.slice(cut);

  const segments = [...base.split('/'), ...pathname.split('/')].filter(Boolean);
  const isFile = /\.[a-z0-9]+$/i.test(segments.at(-1) ?? '');
  const joined = `/${segments.join('/')}`;

  return `${joined}${isFile || joined === '/' ? '' : '/'}${suffix}`;
}
