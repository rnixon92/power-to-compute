import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import states from "us-atlas/states-albers-10m.json";

export const MAP_W = 975;
export const MAP_H = 610;

const projection = geoAlbersUsa().scale(1300).translate([487.5, 305]);

let cache: string[] | null = null;

/** State outlines, pre-projected by us-atlas. */
export function statePaths(): string[] {
  if (cache) return cache;
  const topo = states as unknown as Topology<{ states: GeometryCollection }>;
  const fc = feature(topo, topo.objects.states);
  const path = geoPath();
  cache = fc.features.map((f) => path(f) ?? "").filter(Boolean);
  return cache;
}

export function project(lat: number, lng: number): [number, number] | null {
  return projection([lng, lat]);
}
