import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { Assumptions } from "@/components/Assumptions";
import { ScenarioProvider } from "@/components/ScenarioProvider";
import { TopBar } from "@/components/TopBar";
import { readMarket } from "@/lib/market";
import { companies } from "@/data/ledger";
import "./globals.css";


const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

const description = "Every AI data-center site, lease and build cost across the bitcoin miners turning power into compute, with a valuation model you can change.";

export const metadata: Metadata = {
  title: "Power to Compute",
  description,
  openGraph: { title: "Power to Compute", description, type: "website" },
  twitter: { card: "summary", title: "Power to Compute", description },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0c0e" },
    { media: "(prefers-color-scheme: light)", color: "#f6f6f3" },
  ],
};

const themeScript = `try{var t=localStorage.getItem("psp-theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const market = await readMarket();
  const quotes = market.quotes.map(({ ticker, price, changePercent }) => ({ ticker, price, changePercent }));
  const stamp = (iso: string, time: boolean) =>
    new Date(iso).toLocaleString("en-US", { day: "numeric", month: "short", year: "numeric", ...(time ? { hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" } : { timeZone: "UTC" }) });
  const reviewed = companies.reduce((a, c) => (c.reviewedAt > a ? c.reviewedAt : a), "");
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${sans.variable} ${mono.variable}`}>
        <Suspense>
          <ScenarioProvider>
            <TopBar quotes={quotes} />
            <Assumptions btc={market.btc ?? null} />
            {children}
            <footer className="footer">
              <div className="wrap">
                <span>Research tracker. Company figures are their own disclosures, including forward-looking ones. Implied prices are your assumptions applied to those figures. Not investment advice.</span>
                <span>Prices from Nasdaq as of {stamp(market.fetchedAt, true)}, refreshed through the US session and after the close. Ledger reviewed {stamp(reviewed, false)}.</span>
              </div>
            </footer>
          </ScenarioProvider>
        </Suspense>
      </body>
    </html>
  );
}
