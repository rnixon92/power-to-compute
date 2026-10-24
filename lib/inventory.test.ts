import { describe, expect, it } from "vitest";
import { book } from "@/data/ledger";
import { inventory } from "@/lib/inventory";
import { defaultScenario } from "@/lib/scenario";

const items = inventory(book, defaultScenario);
const ids = (pile: "ready" | "claimed" | "open") => items.filter((i) => i.pile === pile).map((i) => i.id);

describe("unsold inventory", () => {
  it("keeps IREN out and splits landlords into three piles", () => {
    expect(items.some((i) => i.ticker === "IREN")).toBe(false);
    expect(ids("ready")).toEqual(["mara-wolf", "mara-hannibal", "mara-garden", "mara-kearney", "mara-findlay"]);
    expect(ids("claimed")).toEqual(expect.arrayContaining(["hut-rofo", "corz-amd-option", "riot-amd-opt", "clsk-sealy", "clsk-brazoria", "clsk-brazoria-2"]));
    expect(ids("open")).toEqual(expect.arrayContaining(["cifr-colchis", "cifr-other", "wulf-muskie-1", "wulf-hawkeye", "glxy-rest", "riot-corsicana", "mara-matagorda"]));
    expect(ids("ready")).not.toContain("mara-matagorda");
    expect(ids("open")).not.toContain("hut-rofo");
  });

  it("leaves towns the company did not name off the map", () => {
    expect(items.find((i) => i.id === "cifr-ulysses")?.plotted).toBe(false);
    expect(items.find((i) => i.id === "cifr-colchis")?.plotted).toBe(false);
    expect(items.find((i) => i.id === "mara-wolf")?.plotted).toBe(true);
  });
});
