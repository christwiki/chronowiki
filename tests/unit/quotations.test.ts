import { describe, expect, it } from 'vitest';
import { comparePositions, layoutDiagram, linkPath, positionOf } from '../../src/lib/quotations';

describe('positionOf', () => {
  it('reads book, chapter and verse from the machine form', () => {
    expect(positionOf('Hos.11.1').book).toBe('Hos');
    expect(positionOf('Matt.2.17-Matt.2.18').sort.slice(1)).toEqual([2, 17]);
  });

  it('takes the first passage of several', () => expect(positionOf('Exod.12.46,Ps.34.20').book).toBe('Exod'));

  it('orders passages as the books stand', () => {
    const sorted = ['Matt.1.22', 'Isa.7.14', 'Hos.11.1', 'Isa.6.9', 'Gen.1'].sort((a, b) => comparePositions(positionOf(a).sort, positionOf(b).sort));
    expect(sorted).toEqual(['Gen.1', 'Isa.6.9', 'Isa.7.14', 'Hos.11.1', 'Matt.1.22']);
  });
});

describe('layoutDiagram', () => {
  const links = [
    { id: 'a', earlier: 'Isa', later: 'Matt' },
    { id: 'b', earlier: 'Hos', later: 'Matt' },
    { id: 'c', earlier: 'Isa', later: 'John' },
    { id: 'd', earlier: 'Ps', later: 'John' },
    { id: 'e', earlier: 'Ps', later: 'John' },
  ];
  const earlier = [{ id: 'Ps' }, { id: 'Isa' }, { id: 'Hos' }];
  const later = [{ id: 'Matt' }, { id: 'John' }];
  const layout = layoutDiagram(links, earlier, later, { step: 10, minHeight: 20, gap: 5 });
  const y = Object.fromEntries(layout.links.map((link) => [link.id, link]));

  it('gives every group room for its lines, and at least for its name', () => {
    expect(layout.earlier.map((group) => [group.id, group.height, group.count])).toEqual([
      ['Ps', 20, 2],
      ['Isa', 20, 2],
      ['Hos', 20, 1],
    ]);
    expect(layout.later.map((group) => group.height)).toEqual([20, 30]);
  });

  it('makes both columns as tall as the taller one', () => {
    expect(layout.height).toBe(70);
    const last = (groups: typeof layout.earlier) => groups.at(-1)!.top + groups.at(-1)!.height;
    expect(last(layout.earlier)).toBe(70);
    expect(last(layout.later)).toBe(70);
    expect(layout.later[1].top).toBe(40);
  });

  it('ends every line inside its two groups', () => {
    for (const link of links) {
      const from = layout.earlier.find((group) => group.id === link.earlier)!;
      const to = layout.later.find((group) => group.id === link.later)!;
      expect(y[link.id].y1).toBeGreaterThanOrEqual(from.top);
      expect(y[link.id].y1).toBeLessThanOrEqual(from.top + from.height);
      expect(y[link.id].y2).toBeGreaterThanOrEqual(to.top);
      expect(y[link.id].y2).toBeLessThanOrEqual(to.top + to.height);
    }
  });

  it('orders the lines of a group by where they lead, so that they do not cross needlessly', () => {
    // From Isaiah, the line to Matthew (above) leaves above the line to John (below).
    expect(y.a.y1).toBeLessThan(y.c.y1);
    // Into John, the lines from the Psalms (above) arrive above the line from Isaiah.
    expect(y.d.y2).toBeLessThan(y.c.y2);
    expect(y.e.y2).toBeLessThan(y.c.y2);
    // Lines between the same two groups keep their reading order.
    expect(y.d.y1).toBeLessThan(y.e.y1);
    expect(y.d.y2).toBeLessThan(y.e.y2);
  });

  it('centres a column of one group', () => {
    const one = layoutDiagram(links.slice(0, 2), [{ id: 'Isa' }, { id: 'Hos' }], [{ id: 'Matt' }], { step: 10, minHeight: 20, gap: 10 });
    expect(one.height).toBe(50);
    expect(one.later[0]).toMatchObject({ top: 15, height: 20 });
  });

  it('leaves out a line whose group is not drawn', () =>
    expect(layoutDiagram([{ id: 'x', earlier: 'Isa', later: 'Nowhere' }], [{ id: 'Isa' }], [{ id: 'Matt' }]).links).toEqual([]));

  it('lays out nothing at all', () => expect(layoutDiagram([], [], [])).toEqual({ height: 0, earlier: [], later: [], links: [] }));
});

describe('linkPath', () => {
  it('draws an S that is level at both ends', () =>
    expect(linkPath({ id: 'a', y1: 10, y2: 42.123 })).toBe('M0 10C50 10 50 42.12 100 42.12'));
});
