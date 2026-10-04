/**
 * The content collections of a wiki. A wiki's `src/content.config.ts` is two lines:
 *
 *   import { wikiCollections } from 'chronowiki/content';
 *   export const collections = wikiCollections();
 *
 * Every collection is a folder of Markdown files under `src/content/`. The id
 * is the file name without its extension, whatever sub-folder the file sits
 * in, so an event is `council-of-nicaea` and not `councils-and-empire/council-of-nicaea`.
 */
/// <reference path="../virtual.d.ts" />
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import config from 'virtual:chronowiki/config';
import {
  eraSchema,
  eventSchema,
  pageSchema,
  personSchema,
  placeSchema,
  sourceSchema,
  threadSchema,
  translationSchema,
} from './schemas';

const files = (name: string) =>
  glob({
    base: `./src/content/${name}`,
    pattern: '**/*.md',
    generateId: ({ entry }) => entry.replace(/\.md$/, '').split('/').pop()!,
  });

export function wikiCollections() {
  const place = placeSchema.refine((data) => config.regions.includes(data.region), {
    path: ['region'],
    message: `must be one of the regions in wiki.config.ts: ${config.regions.join(', ')}`,
  });

  return {
    events: defineCollection({ loader: files('events'), schema: eventSchema }),
    people: defineCollection({ loader: files('people'), schema: personSchema }),
    places: defineCollection({ loader: files('places'), schema: place }),
    sources: defineCollection({ loader: files('sources'), schema: sourceSchema }),
    threads: defineCollection({ loader: files('threads'), schema: threadSchema }),
    eras: defineCollection({ loader: files('eras'), schema: eraSchema }),
    pages: defineCollection({ loader: files('pages'), schema: pageSchema }),
    /**
     * Translations of all of the above. Here the id keeps its folders:
     * `de/events/council-of-nicaea` is the German words of that event.
     */
    translations: defineCollection({
      loader: glob({ base: './src/content/i18n', pattern: '**/*.md', generateId: ({ entry }) => entry.replace(/\.md$/, '') }),
      schema: translationSchema,
    }),
  };
}
