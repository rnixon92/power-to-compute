"use client";

import Link from "next/link";
import { useState } from "react";
import { companyVar } from "@/lib/palette";
import { mw } from "@/lib/format";
import { useHref } from "@/components/ScenarioProvider";

export interface Pin {
  ticker: string;
  campus: string;
  name: string;
  place: string;
  x: number;
  y: number;
  signed: number;
  open: number;
  power?: number;
  tenants: string[];
}

export function UsMap({ states, pins, width, height, tickers, single }: { states: string[]; pins: Pin[]; width: number; height: number; tickers: string[]; single?: boolean }) {
  const href = useHref();
  const [only, setOnly] = useState<string | null>(null);
  const [hover, setHover] = useState<Pin | null>(null);
  const shown = pins.filter((p) => !only || p.ticker === only);
  const r = (p: Pin) => 4 + Math.sqrt(Math.max(p.signed + p.open, p.power ?? 0, 20)) * 0.42;
  const sorted = [...shown].sort((a, b) => r(b) - r(a));
  const focus = hover ?? null;

  return (
    <div className="map-wrap">
      <div className="map" style={{ position: "relative" }}>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="Map of US sites">
          {states.map((d, i) => <path key={i} className="state" d={d} />)}
          {sorted.map((p) => {
            const ringOnly = p.signed < 1;
            return (
              <Link key={`${p.ticker}-${p.campus}`} href={href(`/companies/${p.ticker}#site-${p.campus}`)}>
                <g
                  className={ringOnly ? "pin ring" : "pin"}
                  opacity={focus && focus !== p ? 0.35 : 1}
                  onPointerEnter={() => setHover(p)}
                  onPointerLeave={() => setHover(null)}
                >
                  <circle cx={p.x} cy={p.y} r={r(p) + 6} fill="transparent" stroke="none" />
                  <circle className="core" cx={p.x} cy={p.y} r={r(p)} fill={companyVar(p.ticker)} fillOpacity={0.85} style={ringOnly ? { stroke: companyVar(p.ticker) } : undefined} />
                </g>
              </Link>
            );
          })}
          {focus ? (
            <text x={focus.x} y={focus.y - r(focus) - 8} textAnchor="middle" style={{ fill: "var(--ink)", fontSize: 14, fontWeight: 600, paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 4 }}>
              {focus.name}
            </text>
          ) : null}
        </svg>
      </div>
      <div className="map-side">
        {focus ? (
          <div>
            <div className="eyebrow">{focus.ticker} · {focus.place}</div>
            <h3 style={{ fontSize: 18, marginTop: 4 }}>{focus.name}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
              <div><div className="eyebrow">Signed IT</div><b>{focus.signed ? mw(focus.signed) : "—"}</b></div>
              <div><div className="eyebrow">Open or planned</div><b>{focus.open ? mw(focus.open) : "—"}</b></div>
              {focus.power ? <div><div className="eyebrow">Site power</div><b>{mw(focus.power)}</b></div> : null}
            </div>
            {focus.tenants.length ? <p className="note" style={{ marginTop: 10 }}>{focus.tenants.join(", ")}</p> : null}
          </div>
        ) : (
          <div>
            <div className="eyebrow">How to read it</div>
            <p className="note" style={{ marginTop: 6 }}>Circle size is the site&apos;s capacity. Filled circles have a signed tenant. Rings are power still looking for one. Click a site to open its breakdown.</p>
          </div>
        )}
        {!single ? (
          <div className="legend" style={{ marginTop: "auto" }}>
            <button type="button" className={only == null ? "" : "off"} onClick={() => setOnly(null)}>All</button>
            {tickers.map((t) => (
              <button key={t} type="button" className={only && only !== t ? "off" : ""} onClick={() => setOnly(only === t ? null : t)}>
                <i className="dot" style={{ background: companyVar(t) }} /> {t}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
