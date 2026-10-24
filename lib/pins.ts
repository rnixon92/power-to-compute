import type { Company } from "@/data/types";
import { itMw } from "@/lib/forecast";
import { project } from "@/lib/geo";
import { defaultScenario } from "@/lib/scenario";
import type { Pin } from "@/components/charts/UsMap";

export function pinsFor(list: Company[]): Pin[] {
  const pins: Pin[] = [];
  for (const c of list) {
    for (const campus of c.campuses) {
      if (campus.lat == null || campus.lng == null) continue;
      const xy = project(campus.lat, campus.lng);
      if (!xy) continue;
      const ramps = c.ramps.filter((r) => r.campus === campus.id);
      const signed = ramps.filter((r) => r.tier === "live" || r.tier === "contracted").reduce((a, r) => a + itMw(r, defaultScenario), 0);
      const open = ramps.filter((r) => r.tier === "announced" || r.tier === "pipeline").reduce((a, r) => a + itMw(r, defaultScenario), 0);
      const tenants = Array.from(new Set(ramps.map((r) => r.tenant).filter((t): t is string => Boolean(t))));
      pins.push({ ticker: c.ticker, campus: campus.id, name: campus.name, place: campus.place, x: xy[0], y: xy[1], signed, open, power: campus.powerMw, tenants });
    }
  }
  return pins;
}
