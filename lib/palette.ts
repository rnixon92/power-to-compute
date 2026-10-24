import type { Tier } from "@/data/types";

/**
 * Categorical slots, fixed order. The holdings that matter most take the first three.
 * The palette has eight hues that stay distinct for colorblind readers. Companies past
 * the eighth share a neutral gray and are always shown with their ticker beside the mark.
 */
export const SLOT_ORDER = ["IREN", "WULF", "GLXY", "CORZ", "CIFR", "APLD", "HUT", "MARA"];

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
