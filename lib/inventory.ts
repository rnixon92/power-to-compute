import type { Company, Ramp } from "@/data/types";
import { itMw } from "@/lib/forecast";
import type { Scenario } from "@/lib/scenario";

export type Pile = "ready" | "claimed" | "open";

export interface InventoryItem {
  id: string;
  ticker: string;
  campus: string;
  label: string;
  place: string;
  pile: Pile;
  /** Critical IT, with gross and utility converted at the scenario rate. */
  itMw: number;
  statedMw: number;
  plotted: boolean;
}

function pileOf(ramp: Ramp): Pile {
  if (ramp.tenant) return "claimed";
  if (ramp.energized) return "ready";
  return "open";
}

/** Landlord megawatts that are not signed. IREN is a GPU cloud, so it stays out. */
export function inventory(companies: Company[], scenario: Scenario): InventoryItem[] {
  const items: InventoryItem[] = [];
  for (const company of companies) {
    if (company.model === "gpu-cloud" || !company.inBook) continue;
    for (const ramp of company.ramps) {
      if (ramp.tier !== "announced" && ramp.tier !== "pipeline") continue;
      const campus = company.campuses.find((c) => c.id === ramp.campus);
      // Every coordinate in the ledger is in the continental US, so a pin exists wherever a town was named.
      const plotted = campus?.lat != null && campus.lng != null;
      items.push({
        id: ramp.id,
        ticker: company.ticker,
        campus: ramp.campus,
        label: ramp.label,
        place: campus?.place ?? "",
        pile: pileOf(ramp),
        itMw: itMw(ramp, scenario),
        statedMw: ramp.mw,
        plotted,
      });
    }
  }
  return items.sort((a, b) => b.itMw - a.itMw);
}

export function pileTotal(items: InventoryItem[], pile: Pile): number {
  return items.filter((i) => i.pile === pile).reduce((a, i) => a + i.itMw, 0);
}
