import type { LocaleDef } from '../i18n/types';

/**
 * A language as a wiki may write it out. Two things may be left out:
 * `status` (then the language is live) and `bible` (then Bible references are
 * written the English way, which only matters to a wiki that cites the Bible).
 */
export type LocaleInput = Omit<LocaleDef, 'status' | 'bible'> & Partial<Pick<LocaleDef, 'status' | 'bible'>>;

/** A region of the map: a filter on the timeline and a heading on the places index. */
export interface RegionInput {
  /** The id places name in their `region` field. */
  id: string;
  /** The region's name: one string, or one per language (`{ en: 'Egypt', de: 'Ägypten' }`). */
  name: string | Record<string, string>;
}

/** What a wiki says about itself in `wiki.config.ts`. */
export interface WikiInput {
  /** The wiki's name, shown in the header and in page titles. It is not translated. */
  name: string;
  /** Where the wiki's files are kept, linked from the footer. */
  repository?: string;
  /** The licence of the wiki's text, named in the footer. */
  license?: { name: string; url: string };
  /** The wiki's own icon: a file in its `public/` folder, such as `/favicon.svg`. Left out, the theme's mark is used. */
  favicon?: string;
  /**
   * The languages, as made by `english()`, `german()` or written out in full.
   * The first is the language the content is written in; its pages sit at the
   * root and every other language under its code. Default: English.
   */
  locales?: LocaleInput[];
  /** The regions of the map, in the order filters and the places index list them. */
  regions: RegionInput[];
}

/** The same, with every default filled in. This is what the theme and the tools read. */
export interface WikiConfig {
  name: string;
  repository?: string;
  license?: { name: string; url: string };
  favicon?: string;
  locales: LocaleDef[];
  /** The code of the language the content is written in. */
  defaultLocale: string;
  /** Region ids in display order. */
  regions: string[];
  /** Region names by language, then by region id. Every language has every region. */
  regionNames: Record<string, Record<string, string>>;
}
