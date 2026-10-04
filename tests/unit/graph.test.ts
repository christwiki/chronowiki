import { describe, expect, it } from 'vitest';
import { byEra, groupBy, leadsTo, neighbours, sortEvents, type EventNode } from '../../src/lib/graph';

const ev = (id: string, eraOrder: number, start: number | undefined, extra: Partial<EventNode> = {}): EventNode => ({
  id,
  title: id,
  era: `era-${eraOrder}`,
  eraOrder,
  order: 0,
  date: { start, confidence: start === undefined ? 'undated' : 'firm' },
  places: [],
  people: [],
  threads: [],
  follows: [],
  ...extra,
});

const events = [
  ev('edict-of-cyrus', 6, -538, { follows: ['fall-of-jerusalem'], threads: ['temple'], places: ['babylon'] }),
  ev('creation', 1, undefined),
  ev('fall-of-jerusalem', 6, -586, { threads: ['temple'], places: ['jerusalem', 'babylon'], people: ['jeremiah'] }),
  ev('temple-rebuilt', 6, -516, {
    follows: ['edict-of-cyrus', 'fall-of-jerusalem'],
    threads: ['temple'],
    places: ['jerusalem'],
  }),
];

describe('graph', () => {
  const sorted = sortEvents(events);
  it('sorts by era then date', () =>
    expect(sorted.map((e) => e.id)).toEqual(['creation', 'fall-of-jerusalem', 'edict-of-cyrus', 'temple-rebuilt']));
  it('does not mutate its input', () => expect(events[0].id).toBe('edict-of-cyrus'));
  it('derives leads-to in date order', () => {
    const lt = leadsTo(sorted);
    expect(lt.get('fall-of-jerusalem')).toEqual(['edict-of-cyrus', 'temple-rebuilt']);
    expect(lt.get('edict-of-cyrus')).toEqual(['temple-rebuilt']);
    expect(lt.get('temple-rebuilt')).toBeUndefined();
  });
  it('finds neighbours', () => {
    const temple = groupBy(sorted, 'threads').get('temple')!;
    expect(neighbours(temple, 'edict-of-cyrus')).toMatchObject({
      prev: { id: 'fall-of-jerusalem' },
      next: { id: 'temple-rebuilt' },
    });
    expect(neighbours(temple, 'fall-of-jerusalem').prev).toBeUndefined();
    expect(neighbours(temple, 'temple-rebuilt').next).toBeUndefined();
    expect(neighbours(temple, 'not-there')).toEqual({});
  });
  it('groups by place', () =>
    expect(groupBy(sorted, 'places').get('babylon')!.map((e) => e.id)).toEqual(['fall-of-jerusalem', 'edict-of-cyrus']));
  it('groups by era in order', () => expect([...byEra(sorted).keys()]).toEqual(['era-1', 'era-6']));
});
