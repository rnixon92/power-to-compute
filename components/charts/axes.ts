export function yearTicks(t0: number, t1: number): number[] {
  const out: number[] = [];
  const y0 = new Date(t0).getUTCFullYear();
  const y1 = new Date(t1).getUTCFullYear();
  for (let y = y0; y <= y1 + 1; y++) {
    const t = Date.UTC(y, 0, 1);
    if (t >= t0 && t <= t1) out.push(t);
  }
  return out;
}

export function nearestIndex(times: number[], t: number): number {
  let lo = 0;
  let hi = times.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid;
    else hi = mid;
  }
  return Math.abs(times[hi] - t) < Math.abs(times[lo] - t) ? hi : lo;
}

/** Scale to what is switched on, letting a much larger ceiling run off the top instead of flattening the data. */
export function domainMax(shown: number, ceiling: number): number {
  if (shown <= 0) return Math.max(ceiling, 1);
  return Math.max(shown * 1.1, Math.min(ceiling, shown * 1.8));
}
