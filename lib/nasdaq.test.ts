import { describe, expect, it } from "vitest";
import { dailyMove } from "@/lib/nasdaq";

const closes = [
  { date: "2026-10-23", close: 14.68 },
  { date: "2026-10-26", close: 15.68 },
];

describe("daily move", () => {
  it("measures a live price during the session against the latest close", () => {
    const m = dailyMove(closes, 16.69, "2026-10-27");
    expect(m.price).toBe(16.69);
    expect(m.asOf).toBe("2026-10-27");
    expect(m.changePercent).toBeCloseTo((16.69 / 15.68 - 1) * 100, 6);
  });

  it("measures today's close against the close before it once the day is in the history", () => {
    const m = dailyMove([...closes, { date: "2026-10-27", close: 16.70 }], 16.70, "2026-10-27");
    expect(m.price).toBe(16.7);
    expect(m.changePercent).toBeCloseTo((16.7 / 15.68 - 1) * 100, 6);
  });
});
