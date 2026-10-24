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

/** OpenAI's own comparison. Later press figures use a different revenue definition, so they stay off this series. */
export const openaiScale = {
  title: "OpenAI, A business that scales with the value of intelligence",
  url: "https://openai.com/index/a-business-that-scales-with-the-value-of-intelligence/",
  note: "Compute and annualized revenue, as OpenAI published them. Revenue in 2025 is $20B+.",
  points: [
    { year: 2023, computeGw: 0.2, arrBn: 2 },
    { year: 2024, computeGw: 0.6, arrBn: 6 },
    { year: 2025, computeGw: 1.9, arrBn: 20 },
  ],
};

export const nvidiaDc = {
  title: "NVIDIA, second quarter fiscal 2027 results",
  url: "https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Announces-Financial-Results-for-Second-Quarter-Fiscal-2027/default.aspx",
  quarterEnded: "2026-07-26",
  revenueBn: 89,
  yoy: 1.17,
  note: "Data-center revenue for the quarter. A global chip figure, read as a sign of demand.",
};

export const azureGrowth = {
  title: "Microsoft, fiscal fourth quarter 2026",
  url: "https://news.microsoft.com/source/2026/07/29/microsoft-cloud-and-ai-strength-fuels-fourth-quarter-results-4/",
  quarterEnded: "2026-06-30",
  yoy: 0.43,
  note: "Azure and other cloud services. A growth rate for cloud revenue.",
};

export const bcgShare = {
  title: "BCG, Breaking Barriers to Data Center Growth",
  url: "https://www.bcg.com/publications/2025/breaking-barriers-data-center-growth",
  from: 0.35,
  to: 0.45,
  year: 2028,
  note: "Amazon, Meta, Microsoft and Google. Share of global data-center power, from 35% toward 45% by 2028. About 60% of the growth from 2023 to 2028.",
};

export const pjmLoad = {
  title: "PJM Board, Large Load Additions problem statement",
  url: "https://www.pjm.com/-/media/DotCom/committees-groups/cifp-lla/2025/20251014/20251014-informational-only---critical-issue-fast-path---large-load-additions---problem-statement---updated---clean.pdf",
  asOf: "2025-10-14",
  peakGrowthGw: 32,
  dataCenterGw: 30,
  from: 2024,
  to: 2030,
  note: "About 30 GW of 32 GW of peak-load growth is data centers. The board says 2030 may still have unmet demand after the queue, no further retirements, and more demand response. It leaves the size of any shortfall open.",
};

export const dominionPlan = {
  title: "Dominion Energy load forecast, PJM Load Analysis Subcommittee",
  url: "https://www.pjm.com/-/media/DotCom/committees-groups/subcommittees/las/2026/20260929/20260929-item-5ai---dominion_energy.pdf",
  asOf: "2026-09-29",
  capacity2030Gw: 17.6,
  demand2030Gw: 7.8,
  note: "Contract capacity in the DOM zone by 2030. Coincident demand is 7.8 GW, because a new contract takes about five years to reach roughly 63% use.",
};

export const dominionQueue = {
  title: "Dominion large-load queue, as reported by Data Center Dynamics",
  url: "https://www.datacenterdynamics.com/en/news/dominion-files-large-load-connection-queue-plan-with-state-regulators/",
  asOf: "2026-02-16",
  requestsGw: 70,
  datedThrough2031Gw: 25,
  peakGw: 24.7,
  note: "Requests from customers waiting to connect. About 25 GW has a connection date through 2031. The system peak on record was 24.7 GW.",
};

export const ercotQueue = {
  title: "ERCOT large-load requests, as reported by the Belfer Center",
  url: "https://www.belfercenter.org/research-analysis/data-centers-texas-virginia-comparison",
  asOf: "2025-12",
  requestsGw: 226,
  requestsPriorGw: 63,
  newDemand2030Gw: 51,
  note: "ERCOT was monitoring about 226 GW of large-load requests in December 2025, up from 63 GW a year earlier. About three-quarters are data centers. Planners put about 51 GW of new demand in the 2030 forecast. Much of the queue is duplicate or speculative.",
};
