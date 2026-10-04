declare module 'd3-geo-projection' {
  import type { GeoStreamWrapper } from 'd3-geo';
  import type { GeoJsonObject } from 'geojson';

  /** Projects a GeoJSON object and returns the projected (planar) GeoJSON, or null if nothing remains. */
  export function geoProject(object: GeoJsonObject, projection: GeoStreamWrapper): GeoJsonObject | null;
}
