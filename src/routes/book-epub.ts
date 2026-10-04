/**
 * The wiki as an EPUB, for any e-reader. It is made with the site, from the
 * same entries, so it is never behind it.
 */
import type { APIRoute } from 'astro';
import config from 'virtual:chronowiki/config';
import { writeEpub } from '../book/epub';
import { bookSlug, getBook } from '../book/model';
import { activeLocales, DEFAULT_LOCALE, i18nFor, isDefaultLocale } from '../i18n';

export function getStaticPaths() {
  if (!config.book) return [];
  return activeLocales().map((locale) => ({
    params: { locale: isDefaultLocale(locale.code) ? undefined : locale.code, name: bookSlug(locale.code) },
  }));
}

export const GET: APIRoute = async ({ params, site }) => {
  const code = params.locale ?? DEFAULT_LOCALE;
  const book = await getBook(code, new URL(i18nFor(code).href('/'), site).href);
  // The cover picture is added after the build, by the step that typesets the PDF.
  return new Response(writeEpub(book) as BodyInit, { headers: { 'Content-Type': 'application/epub+zip' } });
};
