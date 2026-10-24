import { promises as fs } from "fs";
import path from "path";
import { companies } from "@/data/ledger";
import type { MarketBook, Quote } from "@/data/types";
import { fetchQuote } from "@/lib/nasdaq";


const SNAP = path.join(process.cwd(), "data/snapshots/market.json");
const MAX_AGE = 15 * 60 * 1000;

let memory: { at: number; data: MarketBook } | null = null;
let inflight: Promise<MarketBook> | null = null;

export async function getMarket(opts?: { force?: boolean }): Promise<MarketBook> {
  if (!opts?.force && memory && Date.now() - memory.at < MAX_AGE) return memory.data;
  const snap = await readSnap();
  if (!opts?.force && snap && Date.now() - Date.parse(snap.fetchedAt) < MAX_AGE) {
    memory = { at: Date.now(), data: snap };
    return snap;
  }
  if (!opts?.force && snap && !inflight) {
    inflight = refreshMarket().finally(() => {
      inflight = null;
    });
    return { ...snap, stale: Date.now() - Date.parse(snap.fetchedAt) > 12 * 60 * 60 * 1000 };
  }
  if (inflight && !opts?.force) return inflight;
  try {
    return await refreshMarket();
  } catch (error) {
    if (snap) return { ...snap, stale: true, note: "Nasdaq did not answer. Showing the last snapshot." };
    throw error;
  }
}

export async function refreshMarket(): Promise<MarketBook> {
  const quotes: Quote[] = [];
  const tickers = companies.map((c) => c.ticker);
  const queue = [...tickers];
  async function worker() {
    for (;;) {
      const ticker = queue.shift();
      if (!ticker) return;
      quotes.push(await fetchQuote(ticker));
    }
  }
  const [btc] = await Promise.all([fetchBtc(), worker(), worker()]);
  quotes.sort((a, b) => tickers.indexOf(a.ticker) - tickers.indexOf(b.ticker));
  const book: MarketBook = {
    fetchedAt: new Date().toISOString(),
    source: "Nasdaq public quote, summary, history, and analyst target endpoints",
    stale: false,
    note: "Last sale and Street targets refresh from Nasdaq. Shares are market cap divided by the price shown. The megawatt ledger is not updated by this feed.",
    quotes,
    btc,
  };
  await fs.mkdir(path.dirname(SNAP), { recursive: true });
  await fs.writeFile(SNAP, JSON.stringify(book));
  memory = { at: Date.now(), data: book };
  return book;
}

/** Bitcoin spot from Coinbase's public price endpoint. Null when it does not answer, and the model falls back to the June 30 price. */
async function fetchBtc(): Promise<MarketBook["btc"]> {
  try {
    const res = await fetch("https://api.coinbase.com/v2/prices/BTC-USD/spot", { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { amount?: string } };
    const price = Number(body.data?.amount);
    return Number.isFinite(price) && price > 0 ? { price, asOf: new Date().toISOString() } : null;
  } catch {
    return null;
  }
}

/** The saved snapshot, for the static build. `npm run refresh` writes it. */
export async function readMarket(): Promise<MarketBook> {
  const snap = await readSnap();
  if (!snap) throw new Error("No market snapshot. Run `npm run refresh` first.");
  return snap;
}

async function readSnap(): Promise<MarketBook | null> {
  try {
    const raw = await fs.readFile(SNAP, "utf8");
    const parsed = JSON.parse(raw) as MarketBook;
    if (!parsed || !Array.isArray(parsed.quotes)) return null;
    return parsed;
  } catch {
    return null;
  }
}

