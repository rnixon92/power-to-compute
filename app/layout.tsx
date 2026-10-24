import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { Assumptions } from "@/components/Assumptions";
import { ScenarioProvider } from "@/components/ScenarioProvider";
import { TopBar } from "@/components/TopBar";
import { getMarket } from "@/lib/market";
import "./globals.css";

export const dynamic = "force-dynamic";

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
  const market = await getMarket();
  const quotes = market.quotes.map(({ ticker, price, changePercent }) => ({ ticker, price, changePercent }));
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${sans.variable} ${mono.variable}`}>
        <Suspense>
          <ScenarioProvider>
            <TopBar quotes={quotes} />
            <Assumptions />
            {children}
            <footer className="footer">
              <div className="wrap">
                <span>Research tracker. Company figures are their own disclosures, including forward-looking ones. Implied prices are your assumptions applied to those figures. Not investment advice.</span>
                <span>Prices from Nasdaq, refreshed every 15 minutes. Ledger reviewed 24 Oct 2026.</span>
              </div>
            </footer>
          </ScenarioProvider>
        </Suspense>
      </body>
    </html>
  );
}
