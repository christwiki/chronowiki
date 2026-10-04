import { describe, expect, it } from 'vitest';
import { dateSchema, eraSchema, eventSchema, personSchema, placeSchema, sourceSchema, threadSchema } from '../../src/content/schemas';

const ok = (schema: { safeParse(v: unknown): { success: boolean } }, v: unknown) => schema.safeParse(v).success;

describe('dateSchema', () => {
  it('accepts a firm year', () => expect(ok(dateSchema, { start: 325, confidence: 'firm' })).toBe(true));
  it('accepts undated without a year', () => expect(ok(dateSchema, { confidence: 'undated' })).toBe(true));
  it('requires a year otherwise', () => expect(ok(dateSchema, { confidence: 'traditional' })).toBe(false));
  it('rejects year 0', () => expect(ok(dateSchema, { start: 0, confidence: 'firm' })).toBe(false));
  it('rejects end before start', () =>
    expect(ok(dateSchema, { start: -586, end: -597, confidence: 'firm' })).toBe(false));
  it('rejects a day without a month', () =>
    expect(ok(dateSchema, { start: 1517, day: 31, confidence: 'firm' })).toBe(false));
  it('rejects a month on a traditional date', () =>
    expect(ok(dateSchema, { start: -2000, month: 3, confidence: 'traditional' })).toBe(false));
  it('rejects unknown keys', () => expect(ok(dateSchema, { start: 325, confidence: 'firm', year: 325 })).toBe(false));
});

describe('eventSchema', () => {
  const base = { title: 'T', summary: 'S', era: 'exile-and-return', date: { start: -586, confidence: 'estimated' } };
  it('fills defaults', () => {
    const r = eventSchema.parse(base);
    expect(r).toMatchObject({ order: 0, places: [], people: [], threads: [], follows: [], citations: {}, draft: false });
  });
  it('rejects a long summary', () => expect(ok(eventSchema, { ...base, summary: 'x'.repeat(281) })).toBe(false));
  it('rejects a bad id', () => expect(ok(eventSchema, { ...base, places: ['Not An Id'] })).toBe(false));
  it('rejects a non-https citation URL', () =>
    expect(ok(eventSchema, { ...base, citations: { a: { source: 'x', url: 'http://example.org' } } })).toBe(false));
  it('accepts a reviewed date as a string or a date', () => {
    expect(eventSchema.parse({ ...base, reviewed: '2026-10-03' }).reviewed).toBeInstanceOf(Date);
    expect(eventSchema.parse({ ...base, reviewed: new Date('2026-10-03') }).reviewed).toBeInstanceOf(Date);
  });
  it('rejects unknown keys', () => expect(ok(eventSchema, { ...base, sources: [] })).toBe(false));
});

describe('personSchema', () => {
  it('accepts lifespan dates', () =>
    expect(
      ok(personSchema, {
        name: 'Jeremiah',
        role: 'Prophet',
        summary: 'S',
        born: { start: -650, circa: true, confidence: 'estimated' },
      }),
    ).toBe(true));
});

describe('placeSchema', () => {
  const base = {
    name: 'Babylon',
    modern: 'Hillah, Iraq',
    lat: 32.54,
    lon: 44.42,
    kind: 'city',
    region: 'mesopotamia-and-persia',
    summary: 'S',
  };
  it('defaults location to known', () => expect(placeSchema.parse(base).location).toBe('known'));
  it('rejects latitude out of range', () => expect(ok(placeSchema, { ...base, lat: 91 })).toBe(false));
  // Which regions exist is the wiki's business: the validator checks the name against wiki.config.ts.
  it('takes any region that is written as an id', () => {
    expect(ok(placeSchema, { ...base, region: 'atlantis' })).toBe(true);
    expect(ok(placeSchema, { ...base, region: 'The Levant' })).toBe(false);
  });
});

describe('sourceSchema', () => {
  const base = { title: 'Annals', cite: 'Tacitus, Annals', kind: 'history', url: 'https://example.org/annals', summary: 'S' };
  it('accepts a minimal source', () => expect(ok(sourceSchema, base)).toBe(true));
  it('rejects an unknown kind', () => expect(ok(sourceSchema, { ...base, kind: 'blog' })).toBe(false));
  it('requires https', () => expect(ok(sourceSchema, { ...base, url: 'ftp://example.org' })).toBe(false));
  it('accepts further links', () => {
    const links = [{ label: 'Translation', url: 'https://example.org/translation' }];
    expect(sourceSchema.parse({ ...base, links }).links).toEqual(links);
    expect(sourceSchema.parse(base).links).toEqual([]);
    expect(ok(sourceSchema, { ...base, links: [{ label: 'Bad', url: 'http://example.org' }] })).toBe(false);
  });
  it('accepts a date written', () =>
    expect(ok(sourceSchema, { ...base, written: { start: 115, end: 120, circa: true } })).toBe(true));
});

describe('eraSchema', () => {
  const base = { title: 'Primeval History', order: 1, span: 'Undated', summary: 'S' };
  it('accepts an era without years', () => expect(ok(eraSchema, { ...base, colour: 'era-1' })).toBe(true));
  it('accepts an era without a colour', () => expect(ok(eraSchema, base)).toBe(true));
  it('knows sixteen hues', () => {
    expect(ok(eraSchema, { ...base, colour: 'era-16' })).toBe(true);
    expect(ok(eraSchema, { ...base, colour: 'era-17' })).toBe(false);
    expect(ok(eraSchema, { ...base, colour: 'era-0' })).toBe(false);
  });
});

describe('threadSchema', () => {
  it('puts a thread without a number first', () => expect(threadSchema.parse({ title: 'Covenant', summary: 'S' }).order).toBe(0));
});
