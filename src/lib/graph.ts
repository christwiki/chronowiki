/**
 * The relationships between events: chronological order, what each event leads
 * to, and the groupings by place, person, thread and era that the pages show.
 * Pure functions over plain data, independent of Astro.
 */
import { compareDated, type WikiDate } from './dates';

export interface EventNode {
  id: string;
  title: string;
  era: string;
  eraOrder: number;
  date: WikiDate;
  order: number;
  places: string[];
  people: string[];
  threads: string[];
  follows: string[];
}

/** A new array in chronological order. */
export function sortEvents<T extends EventNode>(events: T[]): T[] {
  return [...events].sort(compareDated);
}

/**
 * The inverse of `follows`: for each event, the ids of the events that grow out
 * of it. Pass sorted events to get each list in chronological order.
 */
export function leadsTo(sorted: EventNode[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const event of sorted) {
    for (const earlier of event.follows) {
      const list = result.get(earlier) ?? [];
      list.push(event.id);
      result.set(earlier, list);
    }
  }
  return result;
}

/** The events before and after `id` in an already sorted list. */
export function neighbours<T extends EventNode>(sorted: T[], id: string): { prev?: T; next?: T } {
  const index = sorted.findIndex((e) => e.id === id);
  if (index === -1) return {};
  const result: { prev?: T; next?: T } = {};
  if (index > 0) result.prev = sorted[index - 1];
  if (index < sorted.length - 1) result.next = sorted[index + 1];
  return result;
}

/** Events per place, person or thread id, keeping the order of `sorted`. */
export function groupBy<T extends EventNode>(sorted: T[], key: 'places' | 'people' | 'threads'): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const event of sorted) {
    for (const id of event[key]) {
      const list = result.get(id) ?? [];
      list.push(event);
      result.set(id, list);
    }
  }
  return result;
}

/** Events per era id. With sorted input the eras come out in era order. */
export function byEra<T extends EventNode>(sorted: T[]): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const event of sorted) {
    const list = result.get(event.era) ?? [];
    list.push(event);
    result.set(event.era, list);
  }
  return result;
}
