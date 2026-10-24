import type { Tier } from "@/data/types";

/**
 * Categorical slots, fixed order. The holdings that matter most take the first three, then
 * the largest signed books. The palette has eight hues that stay distinct for colorblind readers.
 * Gray is for power with no signed AI lease (MARA) and for CLSK, the smallest signed book, which
 * shares the gray band in the stacked chart. Gray marks always carry their ticker.
 */
export const SLOT_ORDER = ["IREN", "WULF", "GLXY", "CORZ", "CIFR", "APLD", "HUT", "RIOT"];

export function hasSlot(ticker: string): boolean {
  return SLOT_ORDER.includes(ticker);
}

export function companyVar(ticker: string): string {
  const i = SLOT_ORDER.indexOf(ticker);
  return i >= 0 ? `var(--s${i + 1})` : "var(--s-watch)";
}

export function tierVar(tier: Tier): string {
  return `var(--tier-${tier})`;
}
