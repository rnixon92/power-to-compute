import type { Company, CompanyEvent, DailyClose, EventKind } from "@/data/types";

export const kindLabel: Record<EventKind, string> = {
  lease: "Lease",
  financing: "Financing",
  delivery: "Delivered",
  power: "Power",
  deal: "Deal",
};

export interface Dated extends CompanyEvent {
  ticker: string;
}

/** Every event across the given companies, newest first. */
export function allEvents(list: Company[]): Dated[] {
  return list
    .flatMap((c) => (c.events ?? []).map((e) => ({ ...e, ticker: c.ticker })))
    .sort((a, b) => b.date.localeCompare(a.date) || a.ticker.localeCompare(b.ticker));
}

/**
 * How the stock moved from the last close before the event to `days` trading days after it.
 * Null when the history does not reach far enough either side, or the date is only a month.
 */
export function reaction(history: DailyClose[], e: CompanyEvent, days = 5): number | null {
  if (e.monthOnly || history.length < 2) return null;
  const after = history.findIndex((d) => d.date >= e.date);
  if (after <= 0) return null;
  const end = after + days - 1;
  if (end >= history.length) return null;
  return history[end].close / history[after - 1].close - 1;
}

/** Average move of the other companies over the same window, so a reaction can be read against the group. */
export function groupMove(histories: { ticker: string; history: DailyClose[] }[], e: Dated, days = 5): number | null {
  const moves = histories
    .filter((h) => h.ticker !== e.ticker)
    .map((h) => reaction(h.history, e, days))
    .filter((m): m is number => m != null);
  return moves.length ? moves.reduce((a, m) => a + m, 0) / moves.length : null;
}
