import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { geoArea } from 'd3-geo';
import { drawMap, MAP_HEIGHT, MAP_WIDTH, thin, wind, type MapPin } from '../../src/book/maps';
import { parseXml, type XElement } from '../../src/book/xml';

const pin = (id: string, name: string, lat: number, lon: number, over: Partial<MapPin> = {}): MapPin => ({ id, name, lat, lon, certain: true, ...over });

const JERUSALEM = pin('jerusalem', 'Jerusalem', 31.78, 35.23);
const BABYLON = pin('babylon', 'Babylon', 32.54, 44.42);
const SINAI = pin('mount-sinai', 'Mount Sinai', 28.54, 33.97, { certain: false });
const ROME = pin('rome', 'Rome', 41.9, 12.5);
const BEIJING = pin('beijing', 'Beijing', 39.9, 116.4);
const BOSTON = pin('boston', 'Boston', 42.36, -71.06);

const elements = (svg: string) => (parseXml(svg)[0] as XElement).children as XElement[];
const texts = (svg: string) => elements(svg).filter((node) => node.tag === 'text' && node.attrs.fill !== 'none');
const circles = (svg: string) => elements(svg).filter((node) => node.tag === 'circle');

/** Set MAP_DUMP to a folder to look at the maps these tests draw. */
function dump(name: string, svg: string) {
  if (!process.env.MAP_DUMP) return;
  mkdirSync(process.env.MAP_DUMP, { recursive: true });
  writeFileSync(`${process.env.MAP_DUMP}/${name}.svg`, svg);
}

describe('thin', () => {
  it('drops points that fall on the one before', () => {
    expect(thin('M0,0L0.2,0.1L0.3,0.3L5,5L5.2,5.1L10,0Z', true)).toBe('M0,0L5,5L10,0Z');
  });
  it('drops a ring that shrinks to nothing, and keeps the others', () => {
    expect(thin('M0,0L0.1,0.1L0.2,0ZM10,10L20,10L20,20Z', true)).toBe('M10,10L20,10L20,20Z');
  });
  it('keeps an open line of two points', () => expect(thin('M0,0L4,4', false)).toBe('M0,0L4,4'));
});

describe('wind', () => {
  // A square of ten degrees, wound one way and the other, and a small square inside it.
  const square: [number, number][] = [[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]];
  const inner: [number, number][] = [[4, 4], [4, 6], [6, 6], [6, 4], [4, 4]];
  const area = (rings: [number, number][][]) => geoArea({ type: 'Polygon', coordinates: rings });
  const small = area([square]) < 1 ? square : [...square].reverse();
  const inverted = [...small].reverse();

  it('turns round an outline that encloses everything but its land', () => {
    expect(area([inverted])).toBeGreaterThan(12);
    expect(area(wind([inverted]))).toBeCloseTo(area([small]), 6);
    expect(wind([small])[0]).toEqual(small);
  });

  it('puts the outline first and makes the other rings holes in it', () => {
    const lake = area([inner]) < 1 ? inner : [...inner].reverse();
    const rings = wind([lake, inverted]);
    expect(rings[0]).toEqual(small);
    expect(area(rings)).toBeLessThan(area([small]));
    expect(area(rings)).toBeCloseTo(area([small]) - area([lake]), 6);
  });
});

describe('a map of an event’s places', () => {
  const { svg, beyond } = drawMap([JERUSALEM, BABYLON], { kind: 'places' })!;
  dump('jerusalem-babylon', svg);

  it('is one well-formed drawing of a fixed size', () => {
    const [root] = parseXml(svg) as XElement[];
    expect(root.tag).toBe('svg');
    expect(root.attrs.viewBox).toBe(`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`);
  });

  it('puts every place on the sheet and names it', () => {
    expect(circles(svg)).toHaveLength(2);
    expect(texts(svg).map((node) => node.children[0])).toEqual(['Jerusalem', 'Babylon']);
    for (const circle of circles(svg)) {
      expect(Number(circle.attrs.cx)).toBeGreaterThan(0);
      expect(Number(circle.attrs.cx)).toBeLessThan(MAP_WIDTH);
      expect(Number(circle.attrs.cy)).toBeGreaterThan(0);
      expect(Number(circle.attrs.cy)).toBeLessThan(MAP_HEIGHT);
    }
  });

  it('keeps west on the left', () => {
    const [jerusalem, babylon] = circles(svg);
    expect(Number(jerusalem.attrs.cx)).toBeLessThan(Number(babylon.attrs.cx));
  });

  it('draws land, rivers and lakes, in greys only', () => {
    expect(elements(svg).filter((node) => node.tag === 'path')).toHaveLength(3);
    const colours = new Set([...svg.matchAll(/#([0-9a-f]{6})/g)].map((match) => match[1]));
    for (const colour of colours) expect(colour.slice(0, 2) === colour.slice(2, 4) && colour.slice(2, 4) === colour.slice(4, 6), colour).toBe(true);
  });

  it('leaves no place off: an event\'s map shows all its places, however far apart', () => {
    expect(beyond).toEqual([]);
    expect(drawMap([JERUSALEM, ROME, BEIJING], { kind: 'places' })!.beyond).toEqual([]);
  });

  it('is small enough to carry by the hundred', () => expect(svg.length).toBeLessThan(120_000));
});

describe('a map of one place', () => {
  const { svg } = drawMap([JERUSALEM], { kind: 'places' })!;
  dump('jerusalem', svg);

  it('shows the place in its region, in the middle of the sheet', () => {
    const [circle] = circles(svg);
    expect(Number(circle.attrs.cx)).toBeCloseTo(MAP_WIDTH / 2, 0);
    expect(Number(circle.attrs.cy)).toBeCloseTo(MAP_HEIGHT / 2, 0);
    // Nine degrees across at least: the coast of the Levant and the Nile delta are on the sheet.
    expect(svg.length).toBeGreaterThan(3000);
  });

  it('draws a place whose position is not certain hollow and dashed', () => {
    const uncertain = drawMap([SINAI], { kind: 'places' })!.svg;
    dump('sinai', uncertain);
    expect(circles(uncertain)[0].attrs['stroke-dasharray']).toBeDefined();
    expect(circles(svg)[0].attrs['stroke-dasharray']).toBeUndefined();
  });
});

describe('an overview', () => {
  const places = [
    pin('jerusalem', 'Jerusalem', 31.78, 35.23, { weight: 9 }),
    pin('bethlehem', 'Bethlehem', 31.7, 35.2, { weight: 2 }),
    pin('bethany', 'Bethany', 31.77, 35.26, { weight: 1 }),
    pin('rome', 'Rome', 41.9, 12.5, { weight: 5 }),
    pin('antioch', 'Antioch', 36.2, 36.16, { weight: 4 }),
    pin('alexandria', 'Alexandria', 31.2, 29.92, { weight: 3 }),
  ];
  const { svg } = drawMap(places, { kind: 'overview', labels: 4 })!;
  dump('overview', svg);

  it('shows every place and names the chief ones, as many as asked for', () => {
    expect(circles(svg)).toHaveLength(6);
    expect(texts(svg).map((node) => node.children[0])).toEqual(['Jerusalem', 'Rome', 'Antioch', 'Alexandria']);
  });

  it('never sets one name on another', () => {
    const crowded = drawMap(places, { kind: 'overview', labels: 6 })!.svg;
    const names = texts(crowded).map((node) => node.children[0]);
    // Bethlehem and Bethany lie within a few units of Jerusalem: at most one of the three names fits beside each pin.
    expect(names).toContain('Jerusalem');
    expect(new Set(names).size).toBe(names.length);
    const boxes = texts(crowded).map((node) => {
      const width = String(node.children[0]).length * 19 * 0.45;
      const x = Number(node.attrs.x) - (node.attrs['text-anchor'] === 'end' ? width : node.attrs['text-anchor'] === 'middle' ? width / 2 : 0);
      return { x0: x, x1: x + width, y0: Number(node.attrs.y) - 14, y1: Number(node.attrs.y) + 3 };
    });
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1)) expect(a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0, 'two names overlap').toBe(false);
    }
  });
});

describe('an overview of a region with a little far away', () => {
  // The life of Jesus: Galilee and Judea, and one event in Rome.
  const places = [
    pin('jerusalem', 'Jerusalem', 31.78, 35.23, { weight: 12 }),
    pin('bethlehem', 'Bethlehem', 31.7, 35.2, { weight: 2 }),
    pin('nazareth', 'Nazareth', 32.7, 35.3, { weight: 3 }),
    pin('capernaum', 'Capernaum', 32.88, 35.57, { weight: 5 }),
    pin('jordan', 'Jordan River', 31.84, 35.55, { weight: 1 }),
    pin('rome', 'Rome', 41.9, 12.5, { weight: 1 }),
  ];
  const drawn = drawMap(places, { kind: 'overview' })!;
  dump('bulk', drawn.svg);

  it('is framed on where most happened, and says what it leaves off', () => {
    expect(drawn.beyond.map((place) => place.id)).toEqual(['rome']);
    expect(circles(drawn.svg)).toHaveLength(5);
  });

  it('names the place where most happened, crowded as it is', () => {
    expect(texts(drawn.svg).map((node) => node.children[0])).toContain('Jerusalem');
    expect(texts(drawn.svg).map((node) => node.children[0])).toContain('Capernaum');
  });

  it('keeps a far place on the map when much happened there', () => {
    const paul = places.map((place) => (place.id === 'rome' ? { ...place, weight: 9 } : place));
    expect(drawMap(paul, { kind: 'overview' })!.beyond).toEqual([]);
  });

  it('keeps every place when none is far enough to matter', () => {
    expect(drawMap(places.filter((place) => place.id !== 'rome'), { kind: 'overview' })!.beyond).toEqual([]);
  });
});

describe('a map wider than the world', () => {
  const svg = drawMap([pin('la', 'Los Angeles', 34.05, -118.24), pin('pyongyang', 'Pyongyang', 39.03, 125.75), ROME], { kind: 'overview' })!.svg;
  dump('wide', svg);
  it('still leaves out rivers and lakes', () => expect(elements(svg).filter((node) => node.tag === 'path')).toHaveLength(1));
});

describe('a map of the whole world', () => {
  const { svg } = drawMap([ROME, BEIJING, BOSTON, JERUSALEM], { kind: 'overview' })!;
  dump('world', svg);

  it('holds places an ocean apart, and leaves out rivers and lakes', () => {
    expect(circles(svg)).toHaveLength(4);
    expect(elements(svg).filter((node) => node.tag === 'path')).toHaveLength(1);
    const xs = Object.fromEntries(circles(svg).map((circle, index) => [['rome', 'beijing', 'boston', 'jerusalem'][index], Number(circle.attrs.cx)]));
    expect(xs.boston).toBeLessThan(xs.rome);
    expect(xs.rome).toBeLessThan(xs.jerusalem);
    expect(xs.jerusalem).toBeLessThan(xs.beijing);
  });

  it('fills the land and leaves the sea, on every continent', () => {
    // A ring that runs along the frame would mean a landmass read inside out: sea filled, land left empty.
    const land = elements(svg).find((node) => node.tag === 'path')!.attrs.d;
    const framed = land.split('M').filter((ring) => ring.includes(`0,0L`) && ring.includes(`${MAP_WIDTH},${MAP_HEIGHT}`));
    expect(framed).toEqual([]);
  });

  it('stays small although it shows every coast', () => expect(svg.length).toBeLessThan(200_000));
});

describe('no places', () => {
  it('gives no map', () => expect(drawMap([], { kind: 'places' })).toBeUndefined());
});
