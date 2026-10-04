/**
 * The wiki as Typst source. After the site is built the integration typesets
 * this file into the PDF and removes it, so it is never published.
 */
import type { APIRoute } from 'astro';
import config from 'virtual:chronowiki/config';
import { bookSlug, getBook } from '../book/model';
import { writeTypst } from '../book/typst';
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
  return new Response(writeTypst(book), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
