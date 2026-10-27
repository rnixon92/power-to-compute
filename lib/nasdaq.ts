import type { Quote } from "@/data/types";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function money(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || value === "N/A" || value.trim() === "") return null;
  const n = Number(value.replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function isoFromSlash(value: string): string | null {
  const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

function isoFromLong(value: string): string | null {
  const m = value.match(/([A-Z][a-z]{2}) (\d{1,2}), (\d{4})/);
  if (!m) return null;
  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  const month = months[m[1]];
  if (!month) return null;
  return `${m[3]}-${month}-${m[2].padStart(2, "0")}`;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json", "Accept-Language": "en-US,en;q=0.9" },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.json();
}

function empty(ticker: string, error: string): Quote {
  return {
    ticker, price: null, change: null, changePercent: null, asOf: null, volume: null,
    marketCap: null, shares: null, week52High: null, week52Low: null, summaryTarget: null,
    streetMean: null, streetLow: null, streetHigh: null, buy: null, hold: null, sell: null,
    history: [], streetHistory: [], error,
  };
}

/**
 * Price and the day's move. After the close, the history already has today's row, so the move is against the row
 * before it. During the session today's row is not there yet: the price is the live quote and the move is against
 * the latest close.
 */
export function dailyMove(closes: { date: string; close: number }[], livePrice: number | null, liveAsOf: string | null) {
  const latest = closes.at(-1) ?? null;
  const closed = latest != null && (!liveAsOf || latest.date >= liveAsOf);
  const price = closed ? latest.close : livePrice;
  const asOf = closed ? latest.date : liveAsOf;
  const prev = closed ? closes.at(-2) ?? null : latest;
  const change = price != null && prev ? price - prev.close : null;
  const changePercent = price != null && prev && prev.close ? (price / prev.close - 1) * 100 : null;
  return { price, asOf, change, changePercent };
}

export async function fetchQuote(ticker: string): Promise<Quote> {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const start = new Date(now.getTime() - 390 * 86_400_000).toISOString().slice(0, 10);
  try {
    const [info, summary, history, target] = await Promise.all([
      getJson(`https://api.nasdaq.com/api/quote/${ticker}/info?assetclass=stocks`).catch(() => null),
      getJson(`https://api.nasdaq.com/api/quote/${ticker}/summary?assetclass=stocks`).catch(() => null),
      getJson(`https://api.nasdaq.com/api/quote/${ticker}/historical?assetclass=stocks&fromdate=${start}&todate=${end}&limit=400`).catch(() => null),
      getJson(`https://api.nasdaq.com/api/analyst/${ticker}/targetprice`).catch(() => null),
    ]);

    const primary = asRecord(asRecord(info)?.data)?.primaryData;
    const summaryData = asRecord(asRecord(summary)?.data)?.summaryData;
    const rows = asRecord(asRecord(asRecord(history)?.data)?.tradesTable)?.rows;
    const overview = asRecord(asRecord(target)?.data)?.consensusOverview;
    const streetRows = asRecord(target)?.data && asRecord(asRecord(target)?.data)?.historicalConsensus;

    const closes = Array.isArray(rows)
      ? rows.flatMap((row) => {
          const rec = asRecord(row);
          const date = typeof rec?.date === "string" ? isoFromSlash(rec.date) : null;
          const close = money(rec?.close);
          return date && close != null ? [{ date, close }] : [];
        }).sort((a, b) => a.date.localeCompare(b.date))
      : [];

    const infoPrice = money(asRecord(primary)?.lastSalePrice);
    const infoAsOf = typeof asRecord(primary)?.lastTradeTimestamp === "string"
      ? isoFromLong(String(asRecord(primary)?.lastTradeTimestamp))
      : null;
    const { price, asOf, change: dayChange, changePercent } = dailyMove(closes, infoPrice, infoAsOf);
    const change = dayChange ?? money(asRecord(primary)?.netChange);
    const marketCap = money(asRecord(asRecord(summaryData)?.MarketCap)?.value);
    const range = String(asRecord(asRecord(summaryData)?.FiftTwoWeekHighLow)?.value ?? "");
    const [high, low] = range.split("/").map((part) => money(part));
    const streetHistory = Array.isArray(streetRows)
      ? streetRows.flatMap((row) => {
          const rec = asRecord(row);
          const z = asRecord(rec?.z);
          const date = typeof z?.date === "string" ? isoFromSlash(z.date) : null;
          const targetPrice = typeof rec?.y === "number" ? rec.y : null;
          return date && targetPrice != null ? [{ date, target: targetPrice }] : [];
        }).sort((a, b) => a.date.localeCompare(b.date))
      : [];
    const view = asRecord(overview);

    return {
      ticker,
      price,
      change,
      changePercent,
      asOf,
      volume: money(asRecord(primary)?.volume),
      marketCap,
      shares: price && marketCap ? marketCap / price : null,
      week52High: high ?? null,
      week52Low: low ?? null,
      summaryTarget: money(asRecord(asRecord(summaryData)?.OneYrTarget)?.value),
      streetMean: typeof view?.priceTarget === "number" ? view.priceTarget : null,
      streetLow: typeof view?.lowPriceTarget === "number" ? view.lowPriceTarget : null,
      streetHigh: typeof view?.highPriceTarget === "number" ? view.highPriceTarget : null,
      buy: typeof view?.buy === "number" ? view.buy : null,
      hold: typeof view?.hold === "number" ? view.hold : null,
      sell: typeof view?.sell === "number" ? view.sell : null,
      history: closes,
      streetHistory,
      error: price == null ? "Nasdaq returned no price" : undefined,
    };
  } catch (error) {
    return empty(ticker, error instanceof Error ? error.message : "Quote failed");
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}
