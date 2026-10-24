import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Moved — Power to Compute" };

/** The old /market page. A static host cannot redirect, so this page forwards the browser. */
export default function MarketMoved() {
  return (
    <main className="wrap">
      <meta httpEquiv="refresh" content="0; url=../demand/" />
      <section className="hero">
        <h1>This page moved.</h1>
        <p className="lede"><Link className="link" href="/demand">Demand</Link> has the market and power figures now.</p>
      </section>
    </main>
  );
}
