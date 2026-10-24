export function usd(n: number, digits = 0): string {
  const sign = n < 0 ? "−" : "";
  return sign + "$" + Math.abs(n).toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function usdCompact(n: number): string {
  const sign = n < 0 ? "−" : "";
  const v = Math.abs(n);
  if (v >= 1e12) return sign + "$" + trim(v / 1e12) + "T";
  if (v >= 1e9) return sign + "$" + trim(v / 1e9) + "B";
  if (v >= 1e6) return sign + "$" + trim(v / 1e6) + "M";
  if (v >= 1e3) return sign + "$" + trim(v / 1e3) + "k";
  return usd(n, 0);
}

function trim(n: number): string {
  const d = n >= 100 ? 0 : n >= 10 ? 1 : 2;
  return n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
}

export function px(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n < 0 ? "−" : "";
  return sign + "$" + Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function mw(n: number, digits = 0): string {
  if (Math.abs(n) >= 1000) return trim(n / 1000) + " GW";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits }) + " MW";
}

export function pct(n: number, digits = 0): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return sign + (Math.abs(n) * 100).toFixed(digits) + "%";
}

export function isoToLabel(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[m - 1]} ${d}, ${y}`;
}

export function sharesLabel(n: number | null): string {
  if (n == null) return "—";
  return trim(n / 1e6) + "M";
}

export function quarter(t: number | string): string {
  const d = typeof t === "number" ? new Date(t) : new Date(Date.parse(t));
  return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
}

export function monthYear(t: number): string {
  const d = new Date(t);
  return d.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function perMw(n: number): string {
  return `$${(n / 1e6).toFixed(n >= 10e6 ? 0 : 1)}M/MW`;
}

export function signedPct(n: number | null, digits = 0): string {
  return n == null || !Number.isFinite(n) ? "—" : pct(n, digits);
}

/** Axis labels: as few digits as the tick needs. */
export function mwTick(v: number): string {
  if (v === 0) return "0";
  return v >= 1000 ? `${+(v / 1000).toFixed(1)} GW` : `${Math.round(v)} MW`;
}

export function usdTick(v: number): string {
  if (v === 0) return "$0";
  if (Math.abs(v) >= 1e9) return `$${+(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `$${+(v / 1e6).toFixed(0)}M`;
  return `$${Math.round(v)}`;
}

/** An implied share price. Equity cannot go below zero, so a negative result reads as "Under $0". */
export function implied(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n > 0 ? px(n) : "Under $0";
}

export const UNDER_ZERO = "Debt, other claims and build cost still to spend come to more than the business is worth under these assumptions.";
