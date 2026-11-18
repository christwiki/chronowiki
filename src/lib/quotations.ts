/**
 * Quotations: where a later text quotes an earlier one. This module holds the
 * two things that are logic and not markup: where a passage stands among the
 * others, and the layout of the diagram that joins the two columns of books.
 * Both are pure, so they can be tested without a site.
 */
import { EN_BOOKS } from '../i18n/bible/en';

/** Books in the order of `EN_BOOKS`: Old Testament, New Testament, deuterocanonical books. */
const BOOK_ORDER = new Map(Object.keys(EN_BOOKS).map((book, index) => [book, index]));

/** Sources stand after every book of the Bible, in the order they were written. */
export const SOURCE_ORDER = 1000;

export interface Position {
  /** The book the passage opens in: "Hos". */
  book: string;
  /** Book, chapter and verse as numbers, for sorting. */
  sort: [number, number, number];
}

/** Where a Bible passage stands, from its machine form: `Hos.11.1`, `Matt.2.17-Matt.2.18`. */
export function positionOf(osis: string): Position {
  const [book, chapter = '0', verse = '0'] = osis.split(/[-,]/)[0].split('.');
  return { book, sort: [BOOK_ORDER.get(book) ?? BOOK_ORDER.size, Number(chapter), Number(verse)] };
}

export function comparePositions(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = (a[i] ?? 0) - (b[i] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

// --- the diagram -----------------------------------------------------------------

export interface DiagramLink {
  id: string;
  /** The id of the book or source on each side. */
  earlier: string;
  later: string;
}

export interface DiagramGroup {
  id: string;
  /** Room the group needs for its name, in the diagram's units. */
  minHeight?: number;
}

export interface DiagramOptions {
  /** Distance between two lines that end in the same group. */
  step?: number;
  /** The least height of a group: one line of its name. */
  minHeight?: number;
  /** Space between two groups. */
  gap?: number;
}

export interface PlacedGroup {
  id: string;
  top: number;
  height: number;
  /** How many lines end here. */
  count: number;
}

export interface PlacedLink {
  id: string;
  /** Where the line leaves the earlier column and where it reaches the later one. */
  y1: number;
  y2: number;
}

export interface DiagramLayout {
  height: number;
  earlier: PlacedGroup[];
  later: PlacedGroup[];
  links: PlacedLink[];
}

/**
 * Lays out two columns of groups and the lines between them. The groups stand
 * in the order given. Within a group the lines are ordered by where they lead,
 * so that lines to the same place run side by side and cross as little as the
 * order of the groups allows. The shorter column is spread to the height of the
 * longer one.
 *
 * `links` must be in reading order: lines between the same two groups keep it.
 */
export function layoutDiagram(
  links: DiagramLink[],
  earlier: DiagramGroup[],
  later: DiagramGroup[],
  options: DiagramOptions = {},
): DiagramLayout {
  const step = options.step ?? 10;
  const minHeight = options.minHeight ?? 26;
  const gap = options.gap ?? 8;

  const rank = {
    earlier: new Map(earlier.map((group, index) => [group.id, index])),
    later: new Map(later.map((group, index) => [group.id, index])),
  };
  const order = new Map(links.map((link, index) => [link.id, index]));

  function column(side: 'earlier' | 'later', groups: DiagramGroup[]) {
    const other = side === 'earlier' ? 'later' : 'earlier';
    const members = groups.map((group) =>
      links
        .filter((link) => link[side] === group.id)
        .sort((a, b) => (rank[other].get(a[other]) ?? 0) - (rank[other].get(b[other]) ?? 0) || order.get(a.id)! - order.get(b.id)!),
    );
    const heights = groups.map((group, index) => Math.max(group.minHeight ?? minHeight, members[index].length * step));
    const natural = heights.reduce((sum, height) => sum + height, 0) + gap * Math.max(groups.length - 1, 0);
    return { groups, members, heights, natural };
  }

  const columns = { earlier: column('earlier', earlier), later: column('later', later) };
  const height = Math.max(columns.earlier.natural, columns.later.natural, 0);
  const ends = { earlier: new Map<string, number>(), later: new Map<string, number>() };

  function place(side: 'earlier' | 'later'): PlacedGroup[] {
    const { groups, members, heights, natural } = columns[side];
    const spare = height - natural;
    // One group is centred; several are spread, the spare room shared among the gaps.
    const between = groups.length > 1 ? gap + spare / (groups.length - 1) : gap;
    let top = groups.length > 1 ? 0 : spare / 2;
    return groups.map((group, index) => {
      const placed: PlacedGroup = { id: group.id, top, height: heights[index], count: members[index].length };
      members[index].forEach((link, position) => {
        ends[side].set(link.id, top + heights[index] / 2 + (position - (members[index].length - 1) / 2) * step);
      });
      top += heights[index] + between;
      return placed;
    });
  }

  const placedEarlier = place('earlier');
  const placedLater = place('later');
  return {
    height,
    earlier: placedEarlier,
    later: placedLater,
    links: links.flatMap((link) => {
      const y1 = ends.earlier.get(link.id);
      const y2 = ends.later.get(link.id);
      return y1 === undefined || y2 === undefined ? [] : [{ id: link.id, y1, y2 }];
    }),
  };
}

const round = (value: number) => Math.round(value * 100) / 100;

/** The line of a link as an SVG path, in a drawing `width` units wide: level at both ends, an S between. */
export function linkPath(link: PlacedLink, width = 100): string {
  const middle = width / 2;
  return `M0 ${round(link.y1)}C${middle} ${round(link.y1)} ${middle} ${round(link.y2)} ${width} ${round(link.y2)}`;
}
