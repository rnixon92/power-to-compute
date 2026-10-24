export interface TwhPoint {
  year: number;
  low: number;
  mid: number;
  high: number;
}

/** EPRI Powering Intelligence 2026 dashboard, annual energy, TWh. */
export const epriTwh: TwhPoint[] = [
  { year: 2024, low: 177, mid: 184, high: 192 },
  { year: 2026, low: 251, mid: 301, high: 348 },
  { year: 2028, low: 333, mid: 459, high: 578 },
  { year: 2030, low: 384, mid: 596, high: 794 },
];

export const lbnl2030 = {
  referenceTwh: 649,
  lowTwh: 521,
  highTwh: 843,
  shareMid: 0.118,
  shareLow: 0.095,
  shareHigh: 0.153,
  title: "LBNL, United States Data Center Energy Usage Report: 2025 Update",
  url: "https://energyanalysis.lbl.gov/publications/united-states-data-center-energy-2025",
};

export const epriSource = {
  title: "EPRI, Powering Intelligence 2026",
  url: "https://powering-intelligence.epri.com/dashboard/",
  note: "Low counts most projects under construction and a quarter of those in advanced planning. High adds all advanced planning and 30% of early-stage projects. The 2030 range is about 9% to 17% of US electricity.",
};

export const goldman = {
  title: "Goldman Sachs Research, via Goldman Sachs Insights",
  url: "https://www.goldmansachs.com/insights/articles/us-data-center-power-demand-projected-to-double-by-2027",
  demandGw: [
    { year: 2025, gw: 31 },
    { year: 2026, gw: 41 },
    { year: 2027, gw: 66 },
  ],
  capacityEnd2027Gw: 95,
  utilization: 0.7,
  scheduledAdditionsGw: [
    { year: 2026, gw: 13.6 },
    { year: 2027, gw: 36.3 },
  ],
  realizedAdditionsGw: [
    { year: 2024, gw: 6.4 },
    { year: 2025, gw: 8.5 },
  ],
};

export const sp = {
  title: "451 Research / S&P Global, Datacenter Services & Infrastructure Market Monitor",
  url: "https://www.spglobal.com/energy/en/news-research/latest-news/electric-power/101425-data-center-grid-power-demand-to-rise-22-in-2025-nearly-triple-by-2030",
  note: "Utility power delivered to hyperscale, leased and crypto-mining data centers. A wider perimeter than Goldman's, so the two sit side by side.",
  gw: [
    { year: 2025, gw: 61.8 },
    { year: 2026, gw: 75.8 },
    { year: 2028, gw: 108 },
    { year: 2030, gw: 134.4 },
  ],
};

/** Schedule for the next two years minus what the previous two years actually delivered. */
export function goldmanBuildGap(): { built: number; scheduled: number; gap: number; demandGrowth: number } {
  const built = goldman.realizedAdditionsGw.reduce((a, r) => a + r.gw, 0);
  const scheduled = goldman.scheduledAdditionsGw.reduce((a, r) => a + r.gw, 0);
  const demand = goldman.demandGw;
  return {
    built,
    scheduled,
    gap: scheduled - built,
    demandGrowth: demand[demand.length - 1].gw - demand[0].gw,
  };
}

export function twhAverage2030(): { average: number; left: string; right: string } {
  const epri = epriTwh.find((p) => p.year === 2030)!;
  return {
    average: (epri.mid + lbnl2030.referenceTwh) / 2,
    left: `EPRI medium ${epri.mid} TWh`,
    right: `LBNL reference ${lbnl2030.referenceTwh} TWh`,
  };
}

export const openRouter = {
  title: "OpenRouter, The Token State of Play",
  url: "https://openrouter.ai/data/newsletter/the-token-state-of-play",
  note: "Weekly tokens routed through OpenRouter, reseller traffic removed. A read on how fast AI usage is growing.",
  points: [
    { weekOf: "2025-01-13", trillion: 0.5 },
    { weekOf: "2026-09-14", trillion: 128.4 },
  ],
};

export const openRouterRankings = {
  title: "OpenRouter rankings API, as totaled by The Latent",
  url: "https://thelatent.co/data/demand/openrouter-weekly-token-volume",
  weekOf: "2026-10-12",
  trillion: 164,
  note: "The public rankings series: top models plus everything else, from public endpoints. Runs a little above the newsletter figure.",
};
