import type { Tier } from "@/data/types";

/** Categorical slots, fixed order. The holdings that matter most take the first three. RIOT and CLSK take the last two. */
export const SLOT_ORDER = ["IREN", "WULF", "GLXY", "CORZ", "CIFR", "APLD", "HUT", "MARA", "RIOT", "CLSK"];

export function companyVar(ticker: string): string {
  const i = SLOT_ORDER.indexOf(ticker);
  return i >= 0 ? `var(--s${i + 1})` : "var(--s-watch)";
}

export function tierVar(tier: Tier): string {
  return `var(--tier-${tier})`;
}
