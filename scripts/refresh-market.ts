import { refreshMarket } from "@/lib/market";

async function main() {
  const book = await refreshMarket();
  const priced = book.quotes.filter((q) => q.price != null).length;
  console.log(`Wrote ${priced}/${book.quotes.length} quotes at ${book.fetchedAt}`);
  for (const quote of book.quotes) {
    if (quote.error) console.log(`${quote.ticker}: ${quote.error}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
