/**
 * Dates are signed years: negative is BC, positive is AD, and
 * there is no year 0. Every date carries a confidence level (spec section 4.7).
 */

import { en } from '../i18n/messages/en';

export type Confidence = 'firm' | 'estimated' | 'traditional' | 'undated';

export const CONFIDENCE_LEVELS: Confidence[] = ['firm', 'estimated', 'traditional', 'undated'];

export interface WikiDate {
  start?: number;
  end?: number;
  month?: number;
  day?: number;
  circa?: boolean;
  display?: string;
  confidence: Confidence;
}

/** The date templates of one language (`date` in its messages) and its code. */
export interface DateStyle {
  locale: string;
  templates: {
    bc: string;
    ad: string;
    plain: string;
    rangeBc: string;
    rangeAd: string;
    rangePlain: string;
    rangeAcross: string;
    monthYear: string;
    dayMonthYear: string;
    circa: string;
    undated: string;
    spokenCirca: string;
    spokenRange: string;
    spokenUndated: string;
    spoken: string;
    lifespan: string;
    born: string;
    died: string;
  };
}

export const EN_DATES: DateStyle = { locale: 'en', templates: en.date };

const put = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (placeholder, name: string) => String(values[name] ?? placeholder));

/** The month's name in the language, in the form used in a date. */
function monthName(month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, month - 1, 15)));
}

/** "586 BC", "AD 325", "1517". The era is dropped from the year 1000 on. */
export function formatYear(year: number, style: DateStyle = EN_DATES): string {
  if (year === 0) throw new RangeError('There is no year 0: use -1 for 1 BC and 1 for AD 1.');
  const { templates } = style;
  if (year < 0) return put(templates.bc, { year: -year });
  return put(year < 1000 ? templates.ad : templates.plain, { year });
}

function formatRange(start: number, end: number, style: DateStyle, across: string): string {
  const { templates } = style;
  if (start < 0 && end < 0) return put(templates.rangeBc, { start: -start, end: -end });
  if (start < 0) return put(across, { start: formatYear(start, style), end: formatYear(end, style) });
  // Both AD: the era, if any, is written once.
  return put(start < 1000 ? templates.rangeAd : templates.rangePlain, { start, end });
}

function isRange(date: WikiDate): date is WikiDate & { start: number; end: number } {
  return date.start !== undefined && date.end !== undefined && date.end !== date.start;
}

function label(date: WikiDate, style: DateStyle, spoken: boolean): string {
  const { templates } = style;
  if (date.display) return date.display;
  if (date.start === undefined) return spoken ? templates.spokenUndated : templates.undated;

  let text: string;
  if (isRange(date)) {
    text = spoken
      ? put(templates.spokenRange, { start: formatYear(date.start, style), end: formatYear(date.end, style) })
      : formatRange(date.start, date.end, style, templates.rangeAcross);
  } else {
    const year = formatYear(date.start, style);
    if (date.month === undefined) text = year;
    else {
      const month = monthName(date.month, style.locale);
      text =
        date.day === undefined
          ? put(templates.monthYear, { month, date: year })
          : put(templates.dayMonthYear, { day: date.day, month, date: year });
    }
  }
  return date.circa ? put(spoken ? templates.spokenCirca : templates.circa, { date: text }) : text;
}

/** The label shown wherever a date appears. */
export function formatDate(date: WikiDate, style: DateStyle = EN_DATES): string {
  return label(date, style, false);
}

/** The same date for screen readers: "about 2000 BC, traditional date". */
export function spokenDate(date: WikiDate, confidence: string, style: DateStyle = EN_DATES): string {
  if (date.start === undefined && !date.display) return style.templates.spokenUndated;
  return put(style.templates.spoken, { date: label(date, style, true), confidence });
}

export function yearOf(date: WikiDate): number | undefined {
  return date.start;
}

export interface Dated {
  eraOrder: number;
  date: WikiDate;
  order?: number;
  title: string;
}

/**
 * Chronological order: era, then year (events without a year open their era),
 * then the author's explicit `order`, then month and day, then title.
 */
export function compareDated(a: Dated, b: Dated): number {
  return (
    a.eraOrder - b.eraOrder ||
    (a.date.start ?? -Infinity) - (b.date.start ?? -Infinity) ||
    (a.order ?? 0) - (b.order ?? 0) ||
    (a.date.month ?? 0) - (b.date.month ?? 0) ||
    (a.date.day ?? 0) - (b.date.day ?? 0) ||
    a.title.localeCompare(b.title, 'en')
  );
}

/** "c. 615 BC – 562 BC", "born c. 615 BC", "died 562 BC", or undefined when neither is known. */
export function lifespan(born?: WikiDate, died?: WikiDate, style: DateStyle = EN_DATES): string | undefined {
  const { templates } = style;
  if (born && died) return put(templates.lifespan, { born: formatDate(born, style), died: formatDate(died, style) });
  if (born) return put(templates.born, { date: formatDate(born, style) });
  if (died) return put(templates.died, { date: formatDate(died, style) });
  return undefined;
}
