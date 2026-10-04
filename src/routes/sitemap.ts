/** Every page of the site in every language being built, for search engines. */
import type { APIRoute } from 'astro';
import { activeLocales, i18nFor } from '../i18n';
import { getSite, isPublished } from '../lib/site';

export const GET: APIRoute = async ({ site: origin }) => {
  const site = await getSite();
  const paths = [
    '/',
    '/map/',
    '/threads/',
    '/people/',
    '/places/',
    '/sources/',
    '/about/',
    ...site.eras.map((era) => `/eras/${era.id}/`),
    ...site.threads.map((thread) => `/threads/${thread.id}/`),
    ...site.events.map((event) => `/events/${event.id}/`),
    ...[...site.people.values()].filter(isPublished).map((person) => `/people/${person.id}/`),
    ...[...site.places.values()].filter(isPublished).map((place) => `/places/${place.id}/`),
    ...[...site.sources.values()].filter(isPublished).map((source) => `/sources/${source.id}/`),
  ];
  const locales = activeLocales();
  const address = (path: string, code: string) => new URL(i18nFor(code).href(path), origin).href;

  // Each page is listed once per language, with the other languages named as its alternates.
  const urls = paths
    .flatMap((path) =>
      locales.map((locale) => {
        const alternates =
          locales.length > 1
            ? locales
                .map((other) => `<xhtml:link rel="alternate" hreflang="${other.code}" href="${address(path, other.code)}"/>`)
                .join('')
            : '';
        return `  <url><loc>${address(path, locale.code)}</loc>${alternates}</url>`;
      }),
    )
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
