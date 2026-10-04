import type { APIRoute } from 'astro';
import { i18nFor } from '../i18n';

export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL(i18nFor().asset('/sitemap.xml'), site).href}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
