"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { Ramp, Tier } from "@/data/types";
import { decodeScenario, encodeScenario, type Scenario } from "@/lib/scenario";
import { isEnabled } from "@/lib/forecast";

interface Ctx {
  scenario: Scenario;
  set: (patch: Partial<Scenario>) => void;
  replace: (next: Scenario) => void;
  toggleRamp: (ramp: Ramp) => void;
  setTier: (tier: Tier, on: boolean, ramps: Ramp[]) => void;
  /** Switch a set of ramps on or off individually, leaving the tier defaults alone. */
  setRamps: (ramps: Ramp[], on: boolean) => void;
  panel: boolean;
  openPanel: () => void;
  closePanel: () => void;
  /** Overview totals, charts and comparisons. The ticker always includes IREN. */
  showIren: boolean;
  setShowIren: (on: boolean) => void;
  query: string;
}

const ScenarioContext = createContext<Ctx | null>(null);

export function ScenarioProvider({ children }: { children: React.ReactNode }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const [scenario, setScenario] = useState<Scenario>(() => decodeScenario(new URLSearchParams(params.toString())));
  const [panel, setPanel] = useState(false);
  // The overview compares landlords. IREN sells compute and is valued its own way, so it joins only when asked.
  const [showIren, setShowIren] = useState(() => params.get("iren") === "1");
  const query = useMemo(() => {
    const q = encodeScenario(scenario);
    if (!showIren) return q;
    return q ? `${q}&iren=1` : "iren=1";
  }, [scenario, showIren]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the address bar shareable without a navigation on every slider tick.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
      if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
        window.history.replaceState(window.history.state, "", url);
      }
    }, 150);
  }, [query, pathname]);

  const set = useCallback((patch: Partial<Scenario>) => setScenario((s) => ({ ...s, ...patch })), []);
  const replace = useCallback((next: Scenario) => setScenario(next), []);

  const toggleRamp = useCallback((ramp: Ramp) => {
    setScenario((s) => {
      const on = isEnabled(ramp, s);
      const byTier = s.tiers[ramp.tier];
      const without = { on: s.on.filter((id) => id !== ramp.id), off: s.off.filter((id) => id !== ramp.id) };
      if (on) return { ...s, ...without, off: byTier ? [...without.off, ramp.id] : without.off };
      return { ...s, ...without, on: byTier ? without.on : [...without.on, ramp.id] };
    });
  }, []);

  const setTier = useCallback((tier: Tier, value: boolean, ramps: Ramp[]) => {
    const ids = new Set(ramps.filter((r) => r.tier === tier).map((r) => r.id));
    setScenario((s) => ({
      ...s,
      tiers: { ...s.tiers, [tier]: value },
      on: s.on.filter((id) => !ids.has(id)),
      off: s.off.filter((id) => !ids.has(id)),
    }));
  }, []);

  const openPanel = useCallback(() => setPanel(true), []);
  const closePanel = useCallback(() => setPanel(false), []);

  const setRamps = useCallback((ramps: Ramp[], value: boolean) => {
    setScenario((s) => {
      let on = s.on.filter((id) => !ramps.some((r) => r.id === id));
      let off = s.off.filter((id) => !ramps.some((r) => r.id === id));
      for (const r of ramps) {
        if (s.tiers[r.tier] === value) continue;
        if (value) on = [...on, r.id];
        else off = [...off, r.id];
      }
      return { ...s, on, off };
    });
  }, []);

  const value = useMemo(
    () => ({ scenario, set, replace, toggleRamp, setTier, setRamps, panel, openPanel, closePanel, showIren, setShowIren, query }),
    [scenario, set, replace, toggleRamp, setTier, setRamps, panel, openPanel, closePanel, showIren, query],
  );
  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export function useScenario(): Ctx {
  const ctx = useContext(ScenarioContext);
  if (!ctx) throw new Error("useScenario needs ScenarioProvider");
  return ctx;
}

/** Carry the current scenario onto internal links. */
export function useHref() {
  const { query } = useScenario();
  return useCallback((path: string) => (query ? `${path}?${query}` : path), [query]);
}
