import type { Metadata } from "next";
import { DemandView } from "@/components/DemandView";

export const metadata: Metadata = {
  title: "Demand — Power to Compute",
  description: "US data-center electricity and power forecasts from EPRI, LBNL, Goldman Sachs and S&P, side by side, with AI token growth.",
};

export default function Page() {
  return <DemandView />;
}
