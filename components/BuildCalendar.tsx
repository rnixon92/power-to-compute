"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { Company, Tier } from "@/data/types";
import { calendar, shortQuarter, type Milestone } from "@/lib/calendar";
import { itMw } from "@/lib/forecast";
import { tierLabel } from "@/lib/scenario";
import { companyVar, tierVar } from "@/lib/palette";
import { mw } from "@/lib/format";
import { useHref, useScenario } from "@/components/ScenarioProvider";

const signedTier = (t: Tier) => t === "live" || t === "contracted";

function Mark({ m }: { m: Milestone }) {
  const color = tierVar(m.tier === "live" ? "contracted" : m.tier);
  const open = !signedTier(m.tier);
  return (
    <div className={`ms${m.passed ? " passed" : ""}`} title={`${m.ticker} · ${m.label} · ${mw(m.mw)} · ${m.detail}${m.estimate ? " · our placement" : ""}`}>
      <i className="ms-mark" aria-hidden="true" style={open ? { borderColor: color } : { background: color, borderColor: color }} />
      <span>
        {m.label}
        <small>{mw(m.mw)}{m.estimate ? " · est." : ""}{open ? ` · ${tierLabel[m.tier].toLowerCase()}` : ""}</small>
      </span>
    </div>
  );
}

/** Go-lives by quarter for the sites switched on in the scenario. One row per company with a signed AI lease. */
export function BuildCalendar({ companies, single = false }: { companies: Company[]; single?: boolean }) {
  const { scenario } = useScenario();
  const href = useHref();
  const cal = useMemo(() => calendar(companies, scenario), [companies, scenario]);
  const tiers = new Set(cal.rows.flatMap((r) => [...r.cells.flat(), ...r.later].map((m) => (signedTier(m.tier) ? "contracted" : m.tier))));

  return (
    <div>
      <div className="legend" style={{ marginBottom: 10 }}>
        {(["contracted", "announced", "pipeline"] as const).filter((t) => tiers.has(t)).map((t) => (
          <span key={t}>
            <i className="ms-mark" aria-hidden="true" style={t === "contracted" ? { background: tierVar(t), borderColor: tierVar(t) } : { borderColor: tierVar(t) }} />
            {t === "contracted" ? "Signed" : tierLabel[t]}
          </span>
        ))}
        <span>est. marks our date where the company gave a year or a half</span>
      </div>
      <div className="card table-wrap">
        <table className="data cal">
          <thead>
            <tr>
              {single ? null : <th className="cal-co">Company</th>}
              <th>Online today<small>On the ramp dates</small></th>
              {cal.cols.map((q, i) => (
                <th key={q.key} className={q.current ? "now" : undefined}>
                  {q.label}
                  {single ? null : <small>{cal.counts[i] === 1 ? "1 go-live" : `${cal.counts[i]} go-lives`}</small>}
                </th>
              ))}
              <th>Later</th>
            </tr>
          </thead>
          <tbody>
            {cal.rows.map((r) => (
              <tr key={r.company.ticker}>
                {single ? null : (
                  <td className="cal-co">
                    <Link href={href(`/companies/${r.company.ticker}`)} className="cal-name">
                      <i className="dot" style={{ background: companyVar(r.company.ticker) }} />
                      <b>{r.company.ticker}</b>
                    </Link>
                    <small>{mw(r.signed)} signed</small>
                  </td>
                )}
                <td>
                  {r.now ? (
                    <span title={`${mw(r.live)} reported in service. The rest is phases partway through their ramp.`}>
                      <b className="cal-live">{mw(r.now)}</b>
                      {Math.abs(r.now - r.live) > 1 ? <small>{r.live ? `${mw(r.live)} reported` : "Ramping"}</small> : null}
                    </span>
                  ) : <span className="muted">{r.first != null ? `First ${shortQuarter(r.first)}` : "—"}</span>}
                </td>
                {r.cells.map((cell, i) => (
                  <td key={cal.cols[i].key} className={cal.cols[i].current ? "now" : undefined}>
                    {cell.map((m) => <Mark key={m.id} m={m} />)}
                  </td>
                ))}
                <td>
                  {r.later.length ? (
                    <span className="muted" title={r.later.map((m) => `${m.label}, ${shortQuarter(m.t)}`).join("\n")}>
                      {r.later.length} more, from {shortQuarter(r.later[0].t)}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!single && cal.unsigned.length ? (
        <div className="cal-unsigned">
          <span className="eyebrow">Power, no signed AI lease yet</span>
          {cal.unsigned.map((c) => (
            <Link key={c.ticker} href={href(`/companies/${c.ticker}`)} className="cal-chip">
              <i className="dot" style={{ background: companyVar(c.ticker) }} />
              <b>{c.ticker}</b>
              <span>{mw(c.ramps.reduce((a, r) => a + itMw(r, scenario), 0))} of power you can switch on</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
