import type { Metadata } from "next";
import { book } from "@/data/ledger";
import { DemandView } from "@/components/DemandView";
import { MAP_H, MAP_W, statePaths } from "@/lib/geo";
import { pinsFor } from "@/lib/pins";

export const metadata: Metadata = {
  title: "Demand — Power to Compute",
  description: "US data-center power through 2030, the gap between grid requests and what gets connected, and the unsold power in this book.",
};

export default function Page() {
  return <DemandView states={statePaths()} pins={pinsFor(book)} mapSize={[MAP_W, MAP_H]} />;
}
