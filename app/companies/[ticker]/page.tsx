import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProviderView } from "@/components/provider/ProviderView";
import { companies, companyByTicker } from "@/data/ledger";
import { MAP_H, MAP_W, statePaths } from "@/lib/geo";
import { readMarket } from "@/lib/market";
import { pinsFor } from "@/lib/pins";


export function generateStaticParams() {
  return companies.map((c) => ({ ticker: c.ticker }));
}

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }): Promise<Metadata> {
  const company = companyByTicker((await params).ticker);
  if (!company) return {};
  return { title: `${company.name === company.ticker ? company.ticker : `${company.ticker} · ${company.name}`} — Power to Compute`, description: company.summary };
}

export default async function Page({ params }: { params: Promise<{ ticker: string }> }) {
  const company = companyByTicker((await params).ticker);
  if (!company) notFound();
  const market = await readMarket();
  return <ProviderView company={company} market={market} states={statePaths()} pins={pinsFor([company])} mapSize={[MAP_W, MAP_H]} />;
}
