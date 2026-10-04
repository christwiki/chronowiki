/** The map's data in one language: every published place with coordinates, and the events at each. */
import type { APIRoute } from 'astro';
import { DEFAULT_LOCALE, localeParams } from '../i18n';
import { entryHref, getSite, isPublished } from '../lib/site';

export interface MapPlace {
  id: string;
  name: string;
  modern: string;
  lat: number;
  lon: number;
  kind: string;
  location: string;
  href: string;
}

export interface MapEvent {
  id: string;
  title: string;
  date: string;
  year?: number;
  era: string;
  /** Name of the CSS custom property holding the era's colour. */
  colour: string;
  places: string[];
  href: string;
}

export interface MapData {
  places: MapPlace[];
  events: MapEvent[];
}

export function getStaticPaths() {
  return localeParams().map((params) => ({ params }));
}

export const GET: APIRoute = async ({ params }) => {
  const site = await getSite(params.locale ?? DEFAULT_LOCALE);
  const located = new Set<string>();

  const places: MapPlace[] = [...site.places.values()]
    .filter((place) => !(place.data.lat === 0 && place.data.lon === 0))
    .map((place) => {
      located.add(place.id);
      return {
        id: place.id,
        name: place.data.name,
        modern: place.data.modern,
        lat: place.data.lat,
        lon: place.data.lon,
        kind: place.data.kind,
        location: place.data.location,
        href: isPublished(place) ? entryHref(site, 'place', place.id) : '',
      };
    });

  const events: MapEvent[] = site.events.map((event) => ({
    id: event.id,
    title: event.title,
    date: event.dateLabel,
    year: event.date.start,
    era: event.era,
    colour: `--${event.eraEntry.data.colour}`,
    places: event.places.filter((id) => located.has(id)),
    href: entryHref(site, 'event', event.id),
  }));

  const data: MapData = { places, events };
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
};
