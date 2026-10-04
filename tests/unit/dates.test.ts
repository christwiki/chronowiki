import { describe, expect, it } from 'vitest';
import { i18nFor } from '../../src/i18n';
import { CONFIDENCE_LEVELS, compareDated, formatDate, formatYear, lifespan, yearOf } from '../../src/lib/dates';

const en = i18nFor('en');
const de = i18nFor('de');

describe('formatYear', () => {
  it('labels BC years', () => expect(formatYear(-586)).toBe('586 BC'));
  it('prefixes AD below 1000', () => expect(formatYear(325)).toBe('AD 325'));
  it('leaves later years bare', () => expect(formatYear(1517)).toBe('1517'));
  it('rejects year 0', () => expect(() => formatYear(0)).toThrow(/year 0/i));
});

describe('formatDate', () => {
  const firm = { confidence: 'firm' } as const;
  it('prefers the display override', () =>
    expect(formatDate({ start: -586, display: '587/586 BC', confidence: 'estimated' })).toBe('587/586 BC'));
  it('formats a single year', () => expect(formatDate({ start: 325, ...firm })).toBe('AD 325'));
  it('formats circa', () =>
    expect(formatDate({ start: -2000, circa: true, confidence: 'traditional' })).toBe('c. 2000 BC'));
  it('formats a BC range', () => expect(formatDate({ start: -597, end: -586, ...firm })).toBe('597–586 BC'));
  it('formats a circa range', () =>
    expect(formatDate({ start: -1010, end: -970, circa: true, confidence: 'estimated' })).toBe('c. 1010–970 BC'));
  it('formats a BC to AD range', () => expect(formatDate({ start: -6, end: 30, ...firm })).toBe('6 BC – AD 30'));
  it('formats an early AD range', () => expect(formatDate({ start: 30, end: 33, ...firm })).toBe('AD 30–33'));
  it('formats a later range', () => expect(formatDate({ start: 1545, end: 1563, ...firm })).toBe('1545–1563'));
  it('formats a range crossing 1000', () => expect(formatDate({ start: 962, end: 1054, ...firm })).toBe('AD 962–1054'));
  it('collapses equal start and end', () => expect(formatDate({ start: 1517, end: 1517, ...firm })).toBe('1517'));
  it('formats day and month', () =>
    expect(formatDate({ start: 1517, month: 10, day: 31, ...firm })).toBe('31 October 1517'));
  it('formats month only', () => expect(formatDate({ start: 1517, month: 10, ...firm })).toBe('October 1517'));
  it('formats an early AD day', () => expect(formatDate({ start: 325, month: 5, day: 20, ...firm })).toBe('20 May AD 325'));
  it('formats a BC day', () => expect(formatDate({ start: -597, month: 3, day: 16, ...firm })).toBe('16 March 597 BC'));
  it('ignores day on a range', () =>
    expect(formatDate({ start: 1545, end: 1563, month: 12, day: 13, ...firm })).toBe('1545–1563'));
  it('labels undated events', () => expect(formatDate({ confidence: 'undated' })).toBe('Undated'));
});

describe('spokenDate', () => {
  it('appends the confidence', () =>
    expect(en.spokenDate({ start: -586, confidence: 'estimated' })).toBe('586 BC, estimated date'));
  it('spells out circa', () =>
    expect(en.spokenDate({ start: -2000, circa: true, confidence: 'traditional' })).toBe('about 2000 BC, traditional date'));
  it('spells out a range', () =>
    expect(en.spokenDate({ start: -597, end: -586, confidence: 'firm' })).toBe('597 BC to 586 BC, firm date'));
  it('handles undated', () => expect(en.spokenDate({ confidence: 'undated' })).toBe('undated'));
});

describe('dates in German', () => {
  const firm = { confidence: 'firm' } as const;
  it('puts the era after the year', () => {
    expect(de.date({ start: -586, ...firm })).toBe('586 v. Chr.');
    expect(de.date({ start: 325, ...firm })).toBe('325 n. Chr.');
    expect(de.date({ start: 1517, ...firm })).toBe('1517');
  });
  it('writes the day with a full stop and the month in German', () => {
    expect(de.date({ start: -597, month: 3, day: 16, ...firm })).toBe('16. März 597 v. Chr.');
    expect(de.date({ start: 1517, month: 10, day: 31, ...firm })).toBe('31. Oktober 1517');
    expect(de.date({ start: 325, month: 5, ...firm })).toBe('Mai 325 n. Chr.');
  });
  it('formats ranges', () => {
    expect(de.date({ start: -597, end: -586, ...firm })).toBe('597–586 v. Chr.');
    expect(de.date({ start: 30, end: 33, ...firm })).toBe('30–33 n. Chr.');
    expect(de.date({ start: -6, end: 30, ...firm })).toBe('6 v. Chr. – 30 n. Chr.');
  });
  it('writes circa and the undated label in German', () => {
    expect(de.date({ start: -2000, circa: true, confidence: 'traditional' })).toBe('um 2000 v. Chr.');
    expect(de.date({ confidence: 'undated' })).toBe('Undatiert');
  });
  it('keeps an entry\'s own display label', () =>
    expect(de.date({ start: -586, display: '587/586 v. Chr.', confidence: 'estimated' })).toBe('587/586 v. Chr.'));
  it('reads a date aloud', () =>
    expect(de.spokenDate({ start: -2000, circa: true, confidence: 'traditional' })).toBe('um 2000 v. Chr., traditionelles Datum'));
  it('gives a lifespan', () => {
    expect(de.lifespan({ start: -615, circa: true, confidence: 'estimated' }, { start: -562, confidence: 'firm' })).toBe(
      'um 615 v. Chr. – 562 v. Chr.',
    );
    expect(de.lifespan(undefined, { start: 67, confidence: 'traditional' })).toBe('gestorben 67 n. Chr.');
  });
});

describe('yearOf', () => {
  it('returns the start year', () => expect(yearOf({ start: -586, confidence: 'firm' })).toBe(-586));
  it('is undefined for undated events', () => expect(yearOf({ confidence: 'undated' })).toBeUndefined());
});

describe('CONFIDENCE_LEVELS', () => {
  it('lists all four levels in order', () =>
    expect(CONFIDENCE_LEVELS).toEqual(['firm', 'estimated', 'traditional', 'undated']));
});

describe('compareDated', () => {
  const e = (eraOrder: number, start: number | undefined, order = 0, title = 't', month?: number, day?: number) => ({
    eraOrder,
    order,
    title,
    date: { start, month, day, confidence: 'firm' as const },
  });
  it('orders by era first', () => expect(compareDated(e(2, -2000), e(1, undefined))).toBeGreaterThan(0));
  it('orders by year inside an era', () => expect(compareDated(e(5, -597), e(5, -586))).toBeLessThan(0));
  it('puts yearless events first inside an era', () =>
    expect(compareDated(e(1, undefined), e(1, -4000))).toBeLessThan(0));
  it('orders by month and day', () =>
    expect(compareDated(e(14, 1517, 0, 't', 10, 31), e(14, 1517, 0, 't', 4, 1))).toBeGreaterThan(0));
  it('treats a missing month as the start of the year', () =>
    expect(compareDated(e(14, 1517), e(14, 1517, 0, 't', 4, 1))).toBeLessThan(0));
  it('lets order override month within a year', () =>
    expect(compareDated(e(8, 30, 10, 't', 4, 7), e(8, 30, 20, 't', 4, 5))).toBeLessThan(0));
  it('falls back to order', () => expect(compareDated(e(8, 30, 10), e(8, 30, 20))).toBeLessThan(0));
  it('falls back to title', () => expect(compareDated(e(8, 30, 0, 'a'), e(8, 30, 0, 'b'))).toBeLessThan(0));
});

describe('lifespan', () => {
  const born = { start: -615, circa: true, confidence: 'estimated' as const };
  const died = { start: -562, confidence: 'firm' as const };
  it('joins birth and death', () => expect(lifespan(born, died)).toBe('c. 615 BC – 562 BC'));
  it('gives the birth alone', () => expect(lifespan(born)).toBe('born c. 615 BC'));
  it('gives the death alone', () => expect(lifespan(undefined, died)).toBe('died 562 BC'));
  it('is undefined when nothing is known', () => expect(lifespan()).toBeUndefined());
});
