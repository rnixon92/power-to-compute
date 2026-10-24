import { promises as fs } from "fs";
import path from "path";
import { latestFilings } from "@/lib/edgar";
import { refreshMarket } from "@/lib/market";

/** Fetches prices and the latest SEC filings into data/snapshots for the next build. */
async function main() {
  const book = await refreshMarket();
  const priced = book.quotes.filter((q) => q.price != null).length;
  console.log(`Wrote ${priced}/${book.quotes.length} quotes at ${book.fetchedAt}, bitcoin ${book.btc ? `$${Math.round(book.btc.price)}` : "unavailable"}`);
  for (const quote of book.quotes) {
    if (quote.error) console.log(`${quote.ticker}: ${quote.error}`);
  }
  const filings = await latestFilings();
  const out = path.join(process.cwd(), "data/snapshots/filings.json");
  await fs.writeFile(out, JSON.stringify({ fetchedAt: new Date().toISOString(), filings }, null, 2) + "\n");
  console.log(`Wrote ${filings.length} filings, ${filings.filter((f) => f.unread).length} newer than the ledger`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
