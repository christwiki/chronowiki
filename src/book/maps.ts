/**
 * Maps for the book, drawn when the site is built from the same shapes as the
 * site's own map: no tiles, no outside service, no modern borders. Each map
 * is one SVG in a few greys, so that it reads on a screen with no colour.
 *
 * A map is framed as the site frames it: Mercator, fitted to its places, and
 * never closer than a few degrees across, so that one place is shown in its
 * region and not as a dot on an empty sheet.
 */
import { geoArea, geoMercator, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import detailSource from '../geo/near-east-10m.json?raw';
import worldSource from '../geo/world-50m.json?raw';
import { esc } from './xml';

export interface MapPin {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** False where the position is approximate, traditional or disputed: drawn hollow and dashed, as on the site. */
  certain: boolean;
  /** How much happened here. On a crowded map the places with most are named first. */
  weight?: number;
}

export interface MapOptions {
  /** `places` names every place, for an event or a place. `overview` shows many places and names the chief ones. */
  kind: 'places' | 'overview';
  /** On an overview, how many places are named at most. */
  labels?: number;
}

export const MAP_WIDTH = 900;
export const MAP_HEIGHT = 520;

/**
 * A map is never closer than this many degrees of longitude across. A map of
 * one event's places shows them in their region, as on the site; an overview
 * of many places may come closer, since the places themselves fill the sheet.
 */
const MIN_SPAN_DEGREES = { places: 9, overview: 4 };
/** An overview is framed on the places where this share of everything happened. */
const BULK = 0.8;
/** Places far outside that frame are left off the map only if showing them would shrink it this many times. */
const WORTH_LEAVING_OUT = 2.5;
/** The places fill this share of the sheet; the rest is their surroundings. */
const FILL = 0.62;
/** [west, south, east, north] of the finer coastline; must match scripts/build-map-data.ts. */
const DETAIL = [-12, 10, 62, 60] as const;

const SEA = '#ffffff';
const LAND = '#ebebeb';
const COAST = '#7d7d7d';
const WATER = '#9a9a9a';
const INK = '#000000';
const FONT = "Inter, 'DejaVu Sans', 'Helvetica Neue', Arial, sans-serif";

type Ring = [number, number][];

/** The share of the globe a ring encloses, as the projection reads its direction. */
const enclosed = (ring: Ring) => geoArea({ type: 'Polygon', coordinates: [ring] });
const HALF_GLOBE = 2 * Math.PI;

/**
 * Puts every polygon's rings the way the projection reads them: the outline
 * first and wound so that it encloses the land, each hole after it and wound
 * the other way. One landmass in the shapes, Africa with Eurasia, has its
 * outline wound to enclose everything but itself. Drawn whole that goes
 * unnoticed; cut to a frame, it turns land and sea round.
 */
export function wind(rings: Ring[]): Ring[] {
  // Simplifying the shapes has left a few polygons with no ring at all.
  if (rings.length === 0) return rings;
  const sized = rings.map((ring) => {
    const area = enclosed(ring);
    return { ring, area, size: Math.min(area, 2 * HALF_GLOBE - area) };
  });
  const outline = sized.reduce((largest, candidate) => (candidate.size > largest.size ? candidate : largest));
  return [
    outline.area > HALF_GLOBE ? [...outline.ring].reverse() : outline.ring,
    ...sized.filter((entry) => entry !== outline).map((entry) => (entry.area < HALF_GLOBE ? [...entry.ring].reverse() : entry.ring)),
  ];
}

interface Collection {
  type: 'FeatureCollection';
  features: { type: 'Feature'; properties: unknown; geometry: { type: string; coordinates: unknown } | null }[];
}

function rewound(shape: unknown): GeoPermissibleObjects {
  const collection = shape as Collection;
  if (collection.type !== 'FeatureCollection') return shape as GeoPermissibleObjects;
  return {
    ...collection,
    features: collection.features.map((item) => {
      const { geometry } = item;
      if (geometry?.type === 'Polygon') return { ...item, geometry: { ...geometry, coordinates: wind(geometry.coordinates as Ring[]) } };
      if (geometry?.type === 'MultiPolygon') return { ...item, geometry: { ...geometry, coordinates: (geometry.coordinates as Ring[][]).map(wind) } };
      return item;
    }),
  } as GeoPermissibleObjects;
}

let shapes: { land: GeoPermissibleObjects; lakes: GeoPermissibleObjects; rivers: GeoPermissibleObjects; detail: GeoPermissibleObjects } | undefined;

function loadShapes() {
  if (!shapes) {
    const world = JSON.parse(worldSource) as Topology;
    const detail = JSON.parse(detailSource) as Topology;
    shapes = {
      land: rewound(feature(world, world.objects.land)),
      lakes: rewound(feature(world, world.objects.lakes)),
      rivers: feature(world, world.objects.rivers),
      detail: rewound(feature(detail, detail.objects.land)),
    };
  }
  return shapes;
}

/**
 * Drops the points of a path that fall within `tolerance` units of the one
 * before, and the rings that shrink to nothing. A coastline drawn for a whole
 * continent has many times more points than the sheet can show.
 */
export function thin(path: string, closed: boolean, tolerance = 0.5): string {
  const out: string[] = [];
  for (const piece of path.split('M')) {
    if (!piece) continue;
    const points = piece
      .replace(/Z/g, '')
      .split('L')
      .map((pair) => pair.split(',').map(Number) as [number, number]);
    const kept: [number, number][] = [];
    for (const point of points) {
      const last = kept[kept.length - 1];
      if (!last || Math.abs(point[0] - last[0]) >= tolerance || Math.abs(point[1] - last[1]) >= tolerance) kept.push(point);
    }
    if (kept.length < (closed ? 3 : 2)) continue;
    out.push(`M${kept.map((point) => `${point[0]},${point[1]}`).join('L')}${closed ? 'Z' : ''}`);
  }
  return out.join('');
}

/** A rough width for a label, in units of its font size. Inter's letters, measured by eye, are near enough for placing. */
function widthOf(text: string): number {
  let width = 0;
  for (const char of text) {
    if (/[ijlI.,'’:;!|]/.test(char)) width += 0.28;
    else if (/[ftr\-– ]/.test(char)) width += 0.36;
    else if (/[mwMW]/.test(char)) width += 0.86;
    else if (/[A-ZÀ-Þ0-9]/.test(char)) width += 0.68;
    else width += 0.57;
  }
  return width;
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

export interface DrawnMap {
  svg: string;
  /** Places that lie far outside the map and were left off it, so that the map could show where most happened. */
  beyond: MapPin[];
}

/** The value below which half of the weight lies. */
function median(values: number[], weights: number[]): number {
  const order = values.map((value, index) => ({ value, weight: weights[index] })).sort((a, b) => a.value - b.value);
  const half = weights.reduce((sum, weight) => sum + weight, 0) / 2;
  let seen = 0;
  for (const { value, weight } of order) {
    seen += weight;
    if (seen >= half) return value;
  }
  return order[order.length - 1].value;
}

/**
 * The places an overview is framed on. Usually all of them. But where most
 * happened in one region and a little far away (the life of Jesus in Galilee
 * and Judea, with one event in Rome), framing everything would shrink the
 * region to a blot. Then the frame is drawn round the bulk, and the far
 * places are named beside the map instead of on it.
 */
function bulkOf(points: [number, number][], weights: number[]): boolean[] {
  const all = points.map(() => true);
  if (points.length < 3) return all;
  const cx = median(points.map((point) => point[0]), weights);
  const cy = median(points.map((point) => point[1]), weights);
  const distance = points.map((point) => Math.hypot(point[0] - cx, point[1] - cy));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let covered = 0;
  let reach = 0;
  for (const index of distance.map((_, i) => i).sort((a, b) => distance[a] - distance[b])) {
    covered += weights[index];
    reach = distance[index];
    if (covered >= total * BULK) break;
  }
  const kept = distance.map((d) => d <= reach * 1.25);
  const span = (keep: boolean[]) => {
    const inside = points.filter((_, index) => keep[index]);
    return Math.max(Math.max(...inside.map((p) => p[0])) - Math.min(...inside.map((p) => p[0])), Math.max(...inside.map((p) => p[1])) - Math.min(...inside.map((p) => p[1])), 1e-9);
  };
  return kept.every(Boolean) || span(all) / span(kept) < WORTH_LEAVING_OUT ? all : kept;
}

/** Draw a map of some places. Returns nothing where there is no place to show. */
export function drawMap(allPins: MapPin[], options: MapOptions): DrawnMap | undefined {
  if (allPins.length === 0) return undefined;
  const { land, lakes, rivers, detail } = loadShapes();
  const overview = options.kind === 'overview';
  const width = MAP_WIDTH;
  const height = MAP_HEIGHT;

  // Frame the places: measure them on a projection of unit scale, then scale and centre.
  const projection = geoMercator().scale(1).translate([0, 0]);
  const everywhere = allPins.map((pin) => projection([pin.lon, pin.lat])!);
  const framed = overview ? bulkOf(everywhere, allPins.map((pin) => Math.max(pin.weight ?? 0, 1))) : allPins.map(() => true);
  const pins = allPins.filter((_, index) => framed[index]);
  const beyond = allPins.filter((_, index) => !framed[index]);
  const unit = everywhere.filter((_, index) => framed[index]);
  const xs = unit.map((point) => point[0]);
  const ys = unit.map((point) => point[1]);
  const minSpan = Math.abs(projection([MIN_SPAN_DEGREES[options.kind], 0])![0] - projection([0, 0])![0]);
  const spanX = Math.max(Math.max(...xs) - Math.min(...xs), minSpan);
  const spanY = Math.max(Math.max(...ys) - Math.min(...ys), minSpan * (height / width));
  const scale = FILL / Math.max(spanX / width, spanY / height);
  const centre = [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2];
  projection
    .scale(scale)
    .translate([width / 2 - scale * centre[0], height / 2 - scale * centre[1]])
    .clipExtent([
      [0, 0],
      [width, height],
    ]);

  // The finer coastline is used where the whole sheet lies inside it and is close enough to show it.
  // How many degrees of longitude the sheet is across. (Asking the projection for its corners fails on a sheet wider than the world.)
  const across = (width / scale) * (180 / Math.PI);
  const close = across < 45;
  const [west, north] = projection.invert!([0, 0])!;
  const [east, south] = projection.invert!([width, height])!;
  const inside = close && west >= DETAIL[0] && east <= DETAIL[2] && south >= DETAIL[1] && north <= DETAIL[3];
  const path = geoPath(projection).digits(1);
  // A map of half the world is drawn more coarsely: its coasts have ten times the points of a region's.
  const tolerance = across < 100 ? 0.5 : 1.2;
  const draw = (shape: GeoPermissibleObjects, closed: boolean) => thin(path(shape) ?? '', closed, tolerance);

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    `<rect width="${width}" height="${height}" fill="${SEA}"/>`,
    `<path d="${draw(close && inside ? detail : land, true)}" fill="${LAND}" stroke="${COAST}" stroke-width="0.9" stroke-linejoin="round"/>`,
  ];
  // Rivers and lakes say where one is on a map of a region. On a map of half the world they are only clutter.
  if (across < 100) {
    parts.push(`<path d="${draw(rivers, false)}" fill="none" stroke="${WATER}" stroke-width="${close ? 1.1 : 0.7}" stroke-linecap="round" stroke-linejoin="round"/>`);
    parts.push(`<path d="${draw(lakes, true)}" fill="${SEA}" stroke="${WATER}" stroke-width="0.7"/>`);
  }

  // --- pins -------------------------------------------------------------------------
  const radius = overview ? 4.5 : 7;
  const size = overview ? 19 : 22;
  const placed = pins
    .map((pin) => ({ pin, point: projection([pin.lon, pin.lat])! }))
    .filter(({ point }) => point[0] >= 0 && point[0] <= width && point[1] >= 0 && point[1] <= height);
  const dots: Box[] = placed.map(({ point }) => ({ x0: point[0] - radius - 1, y0: point[1] - radius - 1, x1: point[0] + radius + 1, y1: point[1] + radius + 1 }));
  const names: Box[] = [];

  for (const { pin, point } of placed) {
    const [x, y] = point.map((value) => Math.round(value * 10) / 10);
    parts.push(
      pin.certain
        ? `<circle cx="${x}" cy="${y}" r="${radius}" fill="${INK}" stroke="${SEA}" stroke-width="1.5"/>`
        : `<circle cx="${x}" cy="${y}" r="${radius - 1}" fill="${SEA}" stroke="${INK}" stroke-width="2" stroke-dasharray="3 2.2"/>`,
    );
  }

  // --- names: each where it fits, the weightiest first -------------------------------
  const order = [...placed].sort((a, b) => (b.pin.weight ?? 0) - (a.pin.weight ?? 0));
  const limit = overview ? (options.labels ?? 14) : Infinity;
  const gap = radius + 5;
  let named = 0;
  const labels: string[] = [];
  for (const { pin, point } of order) {
    if (named >= limit) break;
    const [x, y] = point;
    const w = widthOf(pin.name) * size;
    const h = size;
    // Beside the pin to the right or left, then above, below and at the corners.
    const candidates: { box: Box; anchor: 'start' | 'end' | 'middle'; tx: number; ty: number }[] = [
      { anchor: 'start', tx: x + gap, ty: y + h * 0.35 },
      { anchor: 'end', tx: x - gap, ty: y + h * 0.35 },
      { anchor: 'middle', tx: x, ty: y - gap - h * 0.15 },
      { anchor: 'middle', tx: x, ty: y + gap + h * 0.85 },
      { anchor: 'start', tx: x + gap * 0.7, ty: y - gap * 0.6 },
      { anchor: 'start', tx: x + gap * 0.7, ty: y + gap * 0.6 + h * 0.7 },
      { anchor: 'end', tx: x - gap * 0.7, ty: y - gap * 0.6 },
      { anchor: 'end', tx: x - gap * 0.7, ty: y + gap * 0.6 + h * 0.7 },
    ].map((candidate) => {
      const x0 = candidate.anchor === 'start' ? candidate.tx : candidate.anchor === 'end' ? candidate.tx - w : candidate.tx - w / 2;
      return { ...candidate, anchor: candidate.anchor as 'start' | 'end' | 'middle', box: { x0: x0 - 2, y0: candidate.ty - h * 0.85, x1: x0 + w + 2, y1: candidate.ty + h * 0.25 } };
    });
    // A name never lies on another name or leaves the sheet. It should not lie on another place's pin either;
    // in a crowd that cannot always be had, and the place where most happened is named all the same.
    const free = candidates
      .filter(({ box }) => box.x0 >= 3 && box.x1 <= width - 3 && box.y0 >= 3 && box.y1 <= height - 3 && !names.some((other) => overlaps(box, other)))
      .map((candidate) => ({ candidate, covered: dots.filter((dot, index) => placed[index].pin !== pin && overlaps(candidate.box, dot)).length }))
      .sort((a, b) => a.covered - b.covered);
    const fits = free.length > 0 && free[0].covered <= 1 ? free[0].candidate : undefined;
    if (!fits) continue;
    names.push(fits.box);
    named += 1;
    const attrs = `x="${Math.round(fits.tx * 10) / 10}" y="${Math.round(fits.ty * 10) / 10}" text-anchor="${fits.anchor}" font-family="${FONT}" font-size="${size}"`;
    // The name is written twice: first as a white edge, so that it stays readable where it crosses a coast.
    labels.push(`<text ${attrs} fill="none" stroke="${SEA}" stroke-width="4.5" stroke-linejoin="round">${esc(pin.name)}</text>`);
    labels.push(`<text ${attrs} fill="${INK}">${esc(pin.name)}</text>`);
  }
  parts.push(...labels);
  parts.push(`<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="none" stroke="${COAST}" stroke-width="1"/>`);
  parts.push('</svg>');
  return { svg: parts.join(''), beyond };
}
