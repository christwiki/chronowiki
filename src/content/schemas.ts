/**
 * Schemas for the six kinds of entry. Shared by Astro's content collections
 * (`wikiCollections()` in `collections.ts`) and by the validator, so there is
 * one definition of what a valid entry is.
 *
 * One rule is not here because it depends on the wiki: a place's `region`
 * must be one of the regions in `wiki.config.ts`. Both callers check it.
 */
import { z } from 'astro/zod';

export const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const ID = z.string().regex(ID_PATTERN, 'must be a kebab-case id such as "council-of-nicaea"');

export const CONFIDENCE_LEVELS = ['firm', 'estimated', 'traditional', 'undated'] as const;

export const SOURCE_KINDS = [
  'scripture',
  'history',
  'chronicle',
  'letter',
  'treatise',
  'council',
  'creed',
  'law',
  'liturgy',
  'inscription',
  'manuscript',
  'artifact',
] as const;

export const PLACE_KINDS = ['city', 'region', 'mountain', 'river', 'sea', 'island', 'site'] as const;

/** How well a place's position is known. */
export const LOCATION_KINDS = ['known', 'approximate', 'traditional', 'disputed'] as const;

const year = z.number().int().refine((y) => y !== 0, 'there is no year 0');

const httpsUrl = z.string().refine((value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}, 'must be an https URL');

export const dateSchema = z
  .strictObject({
    start: year.optional(),
    end: year.optional(),
    month: z.number().int().min(1).max(12).optional(),
    day: z.number().int().min(1).max(31).optional(),
    circa: z.boolean().optional(),
    display: z.string().min(1).optional(),
    confidence: z.enum(CONFIDENCE_LEVELS),
  })
  .superRefine((date, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    if (date.start === undefined && date.confidence !== 'undated') {
      issue('start', 'a year is required unless confidence is "undated"');
    }
    if (date.start !== undefined && date.end !== undefined && date.end < date.start) {
      issue('end', 'end must not be before start');
    }
    if (date.end !== undefined && date.start === undefined) issue('end', 'end requires start');
    if (date.day !== undefined && date.month === undefined) issue('day', 'day requires month');
    if (date.month !== undefined && date.confidence !== 'firm' && date.confidence !== 'estimated') {
      issue('month', 'month and day are only allowed on firm or estimated dates');
    }
  });

const citationsSchema = z
  .record(
    z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'citation keys are lower-case letters, digits and hyphens'),
    z.strictObject({
      source: ID,
      at: z.string().min(1).optional(),
      url: httpsUrl.optional(),
    }),
  )
  .default({});

const summary = z.string().min(1).max(280);

export const eventSchema = z.strictObject({
  title: z.string().min(1),
  summary,
  era: ID,
  date: dateSchema,
  order: z.number().int().default(0),
  places: z.array(ID).default([]),
  people: z.array(ID).default([]),
  threads: z.array(ID).default([]),
  follows: z.array(ID).default([]),
  citations: citationsSchema,
  dating: z.string().optional(),
  reviewed: z.coerce.date().optional(),
  draft: z.boolean().default(false),
});

export const personSchema = z.strictObject({
  name: z.string().min(1),
  altNames: z.array(z.string().min(1)).default([]),
  role: z.string().min(1),
  born: dateSchema.optional(),
  died: dateSchema.optional(),
  summary,
  citations: citationsSchema,
  draft: z.boolean().default(false),
});

export const placeSchema = z.strictObject({
  name: z.string().min(1),
  altNames: z.array(z.string().min(1)).default([]),
  modern: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  kind: z.enum(PLACE_KINDS),
  /** One of the regions in `wiki.config.ts`. */
  region: ID,
  location: z.enum(LOCATION_KINDS).default('known'),
  summary,
  citations: citationsSchema,
  draft: z.boolean().default(false),
});

export const sourceSchema = z.strictObject({
  title: z.string().min(1),
  author: z.string().min(1).optional(),
  cite: z.string().min(1),
  kind: z.enum(SOURCE_KINDS),
  written: z
    .strictObject({ start: year, end: year.optional(), circa: z.boolean().optional(), display: z.string().optional() })
    .optional(),
  language: z.string().min(1).optional(),
  /** The full text online, or for an artifact the holding institution's object record. */
  url: httpsUrl,
  /** Further places to read it: a translation, the original language, images. */
  links: z.array(z.strictObject({ label: z.string().min(1), url: httpsUrl })).default([]),
  edition: z.string().min(1).optional(),
  holding: z.string().min(1).optional(),
  summary,
  draft: z.boolean().default(false),
});

export const threadSchema = z.strictObject({
  title: z.string().min(1),
  /** Where the thread stands in lists. Threads with the same number are sorted by title. */
  order: z.number().int().default(0),
  summary,
});

export const eraSchema = z.strictObject({
  title: z.string().min(1),
  /** A shorter title for the era rail. */
  short: z.string().min(1).optional(),
  order: z.number().int().min(1),
  start: year.optional(),
  end: year.optional(),
  span: z.string().min(1),
  /** One of the sixteen hues, `era-1` to `era-16`. Left out, the eras are spread evenly across them. */
  colour: z.string().regex(/^era-([1-9]|1[0-6])$/, 'must be era-1 to era-16').optional(),
  summary,
});

/** A page of running text that is not an entry, such as the method page. */
export const pageSchema = z.strictObject({
  title: z.string().min(1),
  summary: z.string().min(1),
  citations: citationsSchema,
});

/**
 * A translation of an entry: only its words, in another language. See
 * `src/i18n/overlay.ts`. The validator checks which fields fit which collection.
 */
export const translationSchema = z.strictObject({
  source: z.string().regex(/^[0-9a-f]{12}$/, 'must be the 12-digit hash written by `npm run i18n -- stamp`'),
  translated: z.coerce.date().optional(),
  title: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  short: z.string().min(1).optional(),
  summary: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  modern: z.string().min(1).optional(),
  altNames: z.array(z.string().min(1)).optional(),
  span: z.string().min(1).optional(),
  dating: z.string().min(1).optional(),
  dateDisplay: z.string().min(1).optional(),
  bornDisplay: z.string().min(1).optional(),
  diedDisplay: z.string().min(1).optional(),
  writtenDisplay: z.string().min(1).optional(),
  author: z.string().min(1).optional(),
  cite: z.string().min(1).optional(),
  language: z.string().min(1).optional(),
  edition: z.string().min(1).optional(),
  holding: z.string().min(1).optional(),
  links: z.array(z.string().min(1)).optional(),
  citations: z.record(z.string(), z.strictObject({ at: z.string().min(1) })).optional(),
});

export type PageData = z.infer<typeof pageSchema>;
export type TranslationData = z.infer<typeof translationSchema>;
export type EventData = z.infer<typeof eventSchema>;
export type PersonData = z.infer<typeof personSchema>;
export type PlaceData = z.infer<typeof placeSchema>;
export type SourceData = z.infer<typeof sourceSchema>;
export type ThreadData = z.infer<typeof threadSchema>;
export type EraData = z.infer<typeof eraSchema>;

export const SCHEMAS = {
  events: eventSchema,
  people: personSchema,
  places: placeSchema,
  sources: sourceSchema,
  threads: threadSchema,
  eras: eraSchema,
} as const;

export type CollectionName = keyof typeof SCHEMAS;
export const COLLECTIONS = Object.keys(SCHEMAS) as CollectionName[];
