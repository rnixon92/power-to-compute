import type { MarketBook, Quote } from "@/data/types";

export function quoteFor(book: MarketBook, ticker: string): Quote | undefined {
  return book.quotes.find((q) => q.ticker === ticker);
}
