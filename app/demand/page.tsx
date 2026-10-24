import type { Metadata } from "next";
import { DemandView } from "@/components/DemandView";

export const metadata: Metadata = {
  title: "Demand — Power to Compute",
  description: "US data-center power forecasts, the gap between what is scheduled and what has been built, and the hyperscalers and neoclouds signing the leases in this book.",
};

export default function Page() {
  return <DemandView />;
}
