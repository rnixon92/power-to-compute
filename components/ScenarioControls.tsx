"use client";

import type { Ramp } from "@/data/types";
import { TIERS, matchPreset, presets, tierLabel, type PresetId } from "@/lib/scenario";
import { tierVar } from "@/lib/palette";
import { mw } from "@/lib/format";
import { useScenario } from "@/components/ScenarioProvider";
import { Segmented } from "@/components/ui";
import { isEnabled, itMw } from "@/lib/forecast";

/** Four tier switches, each showing how many megawatts it covers. */
export function TierToggles({ ramps }: { ramps: Ramp[] }) {
  const { scenario, setTier } = useScenario();
  return (
    <div className="tier-toggles" role="group" aria-label="Capacity included in the forecast">
      {TIERS.map((tier) => {
        const inTier = ramps.filter((r) => r.tier === tier);
        if (!inTier.length) return null;
        const total = inTier.reduce((a, r) => a + itMw(r, scenario), 0);
        const onCount = inTier.filter((r) => isEnabled(r, scenario)).length;
        const state = onCount === inTier.length ? true : onCount === 0 ? false : "mixed";
        return (
          <button
            key={tier}
            type="button"
            className="tier-toggle"
            aria-pressed={state === "mixed" ? "mixed" : state}
            style={{ "--tier-color": tierVar(tier) } as React.CSSProperties}
            onClick={() => setTier(tier, state !== true, ramps)}
            title={state === "mixed" ? "Some sites in this group are switched individually" : undefined}
          >
            <span className="box">
              {state === true ? <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5.2 4.2 7.4 8 3" stroke="var(--page)" strokeWidth="1.8" fill="none" /></svg> : state === "mixed" ? <svg width="8" height="2"><rect width="8" height="2" fill="currentColor" /></svg> : null}
            </span>
            {tierLabel[tier]}
            <small>{mw(total)}</small>
          </button>
        );
      })}
    </div>
  );
}

export function PresetPicker() {
  const { scenario, replace } = useScenario();
  const current = matchPreset(scenario);
  return (
    <Segmented<PresetId>
      label="Scenario preset"
      value={current}
      options={(Object.keys(presets) as PresetId[]).map((id) => ({ value: id, label: presets[id].label }))}
      onChange={(id) => replace(presets[id].apply(scenario))}
    />
  );
}
