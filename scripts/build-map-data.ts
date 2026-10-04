/**
 * Builds the map's base layers from Natural Earth data (public domain) as
 * packaged on npm, and writes them to src/geo/. Run once, and again only to
 * change the level of detail:
 *
 *   npm run map-data
 *
 *   world-50m.json       land, lakes and rivers of the whole world at 1:50m
 *   near-east-10m.json   land at 1:10m for Europe, the Mediterranean and the Near East,
 *                        shown when the reader zooms in
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { geoArea, geoContains, geoIdentity } from 'd3-geo';
import { geoProject } from 'd3-geo-projection';
import type { Feature, FeatureCollection, GeoJsonObject, Geometry, Position } from 'geojson';
import { feature, quantize } from 'topojson-client';
import { topology } from 'topojson-server';
import { presimplify, quantile, simplify } from 'topojson-simplify';
import type { Topology } from 'topojson-specification';

const require = createRequire(import.meta.url);

/** [west, south, east, north] of the detailed layer. */
const DETAIL_BOUNDS = [-12, 10, 62, 60] as const;

function merged(topo: Topology, name: string): FeatureCollection {
  const object = feature(topo, topo.objects[name]) as Feature | FeatureCollection;
  return object.type === 'FeatureCollection' ? object : { type: 'FeatureCollection', features: [object] };
}

/** Drop properties: the map needs shapes only. */
function bare(collection: FeatureCollection): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: collection.features.filter((f) => f.geometry).map((f) => ({ type: 'Feature', properties: {}, geometry: f.geometry })),
  };
}

/**
 * Build a topology, keep the given share of its points, and store coordinates
 * as small integers (simplifying turns them back into floats, hence the second pass).
 */
/**
 * d3-geo reads polygons on the sphere: an outer ring must run clockwise, or the
 * polygon is taken to cover the rest of the globe. Source data and planar
 * clipping do not guarantee that, so every ring is put in the right order here.
 */
function rewind(collection: FeatureCollection): FeatureCollection {
  const coversMost = (ring: Position[]) => geoArea({ type: 'Polygon', coordinates: [ring] }) > 2 * Math.PI;
  const fix = (rings: Position[][]) =>
    rings.map((ring, index) => {
      const outer = index === 0;
      // An outer ring should enclose the smaller part of the globe, a hole the larger.
      return coversMost(ring) === outer ? [...ring].reverse() : ring;
    });
  return {
    type: 'FeatureCollection',
    features: collection.features.map((f) => {
      const g = f.geometry;
      if (g.type === 'Polygon') return { ...f, geometry: { ...g, coordinates: fix(g.coordinates) } };
      if (g.type === 'MultiPolygon') return { ...f, geometry: { ...g, coordinates: g.coordinates.map(fix) } };
      return f;
    }),
  };
}

/**
 * Natural Earth's lakes include modern reservoirs, which have no place on a
 * historical map. A lake that contains one of these points is left out.
 */
const RESERVOIRS: [name: string, lon: number, lat: number][] = [
  ['Lake Nasser', 32.7, 22.8],
  ['Toshka Lakes', 30.9, 23.2],
  ['Lake Tharthar', 43.3, 33.95],
  ['Lake Razazza', 43.75, 32.7],
  ['Lake Habbaniyah', 43.45, 33.28],
  ['Lake Qadisiyah', 42.0, 34.3],
  ['Mosul Dam Lake', 42.6, 36.75],
  ['Lake Assad', 38.3, 36.0],
  ['Atatürk Reservoir', 38.6, 37.5],
  ['Keban Reservoir', 39.2, 38.8],
  ['Hirfanlı Reservoir', 33.7, 39.2],
  ['Kuybyshev Reservoir', 49.0, 54.5],
  ['Rybinsk Reservoir', 38.3, 58.4],
  ['Tsimlyansk Reservoir', 42.9, 48.1],
  ['Volgograd Reservoir', 45.6, 50.2],
  ['Saratov Reservoir', 47.5, 52.9],
  ['Gorky Reservoir', 43.2, 57.0],
  ['Kama Reservoir', 56.0, 58.5],
  ['Kakhovka Reservoir', 34.0, 47.3],
  ['Kremenchuk Reservoir', 32.7, 49.3],
  ['Kyiv Reservoir', 30.5, 50.9],
  ['Lake Volta', -0.2, 7.6],
  ['Sarygamysh Lake', 57.4, 41.9],
  ['Lake Kariba', 28.0, -17.0],
  ['Cahora Bassa', 31.5, -15.7],
  ['Kainji Lake', 4.6, 10.4],
  ['Lake Mead', -114.4, 36.2],
  ['Lake Powell', -110.7, 37.2],
  ['Lake Sakakawea', -102.0, 47.7],
  ['Lake Oahe', -100.4, 45.0],
  ['Fort Peck Lake', -106.7, 47.7],
];

function withoutReservoirs(lakes: FeatureCollection): FeatureCollection {
  const removed: string[] = [];
  const features = lakes.features.filter((lake) => {
    const hit = RESERVOIRS.find(([, lon, lat]) => geoContains(lake, [lon, lat]));
    if (hit) removed.push(hit[0]);
    return !hit;
  });
  console.log(`Reservoirs left out: ${removed.join(', ') || 'none found'}`);
  return { type: 'FeatureCollection', features };
}

function build(objects: Record<string, GeoJsonObject>, keep: number, quantization: number): Topology {
  let topo = topology(objects) as unknown as Topology;
  topo = presimplify(topo as never) as never;
  topo = simplify(topo as never, quantile(topo as never, keep)) as never;
  return quantize(topo as never, quantization) as Topology;
}

function write(name: string, topo: Topology) {
  const path = `src/geo/${name}`;
  const json = JSON.stringify(topo);
  writeFileSync(path, json);
  console.log(`${path}: ${(json.length / 1024).toFixed(0)} kB`);
}

// --- world ---------------------------------------------------------------------
const world = require('sane-topojson/dist/world_50m.json') as Topology;
write(
  'world-50m.json',
  build(
    {
      land: rewind(bare(merged(world, 'land'))),
      lakes: rewind(withoutReservoirs(bare(merged(world, 'lakes')))),
      rivers: bare(merged(world, 'rivers')),
    },
    0.45,
    2e4,
  ),
);

// --- detail --------------------------------------------------------------------
const [west, south, east, north] = DETAIL_BOUNDS;
// Clip in plain longitude/latitude space. Screen-style clipping needs y to grow downward,
// so latitudes are flipped for the clip and flipped back afterwards.
const flip = geoIdentity().reflectY(true);
const clip = geoIdentity().clipExtent([
  [west, -north],
  [east, -south],
]);

const land10 = require('world-atlas/land-10m.json') as Topology;
const clipped: Feature<Geometry>[] = [];
for (const item of bare(merged(land10, 'land')).features) {
  const flipped = geoProject(item, flip) as Feature | null;
  const cut = flipped && (geoProject(flipped, clip) as Feature | null);
  const back = cut && (geoProject(cut, flip) as Feature | null);
  if (back?.geometry) clipped.push({ type: 'Feature', properties: {}, geometry: back.geometry });
}

write('near-east-10m.json', build({ land: rewind({ type: 'FeatureCollection', features: clipped }) }, 0.3, 4e4));

writeFileSync(
  'src/geo/README.md',
  `# Map data

Generated by \`scripts/build-map-data.ts\`. Do not edit by hand.

- \`world-50m.json\`: land, lakes and rivers at 1:50,000,000, from Natural Earth via the npm package \`sane-topojson\`.
- \`near-east-10m.json\`: land at 1:10,000,000 for longitude ${west} to ${east} and latitude ${south} to ${north}, from Natural Earth via the npm package \`world-atlas\`.

Natural Earth data is in the public domain (https://www.naturalearthdata.com/about/terms-of-use/).
Coastlines, lakes and rivers are those of today, not of antiquity; the large modern reservoirs are left out.
`,
);
