"use client";

import type { Campus, Company } from "@/data/types";
import { leaseRateOf, type Block } from "@/lib/forecast";
import { tierLabel } from "@/lib/scenario";
import { tierVar } from "@/lib/palette";
import { mw, perMw, quarter, usdCompact } from "@/lib/format";
import { useScenario } from "@/components/ScenarioProvider";
import { Switch } from "@/components/ui";
import { Timeline } from "@/components/charts/Timeline";

const unitWord: Record<string, string> = { gross: "gross", utility: "utility", "leased-power": "leased", "critical-it": "IT", nameplate: "nameplate" };
const statusWord: Record<string, string> = {
  "in-service": "In service",
  delivering: "Delivering",
  construction: "Under construction",
  contracted: "Signed",
  planned: "Planned",
  mining: "Bitcoin mining",
  "pending-close": "Purchase pending",
  monetizing: "Being sold",
};

export function Sites({ company, blocks, today }: { company: Company; blocks: Block[]; today: number }) {
  const byCampus = new Map<string, Block[]>();
  for (const b of blocks) byCampus.set(b.ramp.campus, [...(byCampus.get(b.ramp.campus) ?? []), b]);
  const withRamps = company.campuses
    .filter((c) => byCampus.has(c.id))
    .sort((a, b) => weight(byCampus.get(b.id)!) - weight(byCampus.get(a.id)!));
  const rest = company.campuses.filter((c) => !byCampus.has(c.id));
  const source = Object.fromEntries(company.sources.map((s) => [s.id, s]));

  return (
    <>
      {withRamps.map((campus) => (
        <SiteCard key={campus.id} campus={campus} blocks={byCampus.get(campus.id)!} today={today} source={source} />
      ))}
      {rest.length ? (
        <div className="card card-pad">
          <h3 style={{ fontSize: 15 }}>Other sites</h3>
          <p className="note" style={{ marginTop: 2 }}>Mining sites, sites being sold and development land with no AI phase dated yet.</p>
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table className="data">
              <thead><tr><th>Site</th><th>Use</th><th className="r">Power</th><th>Notes</th></tr></thead>
              <tbody>
                {rest.map((c) => (
                  <tr key={c.id} id={`site-${c.id}`}>
                    <td><b>{c.name}</b><small>{c.place}</small></td>
                    <td>{Array.from(new Set(c.phases.map((p) => statusWord[p.status]))).join(", ")}</td>
                    <td className="r">{c.powerMw ? `${mw(c.powerMw)} ${unitWord[c.powerUnit ?? "gross"]}` : "—"}</td>
                    <td className="muted" style={{ maxWidth: 380 }}>{c.note ?? c.phases.find((p) => p.note)?.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </>
  );
}

function weight(list: Block[]): number {
  return list.reduce((a, b) => a + b.itMw * (b.ramp.tier === "live" ? 4 : b.ramp.tier === "contracted" ? 3 : b.ramp.tier === "announced" ? 2 : 1), 0);
}

function SiteCard({ campus, blocks, today, source }: { campus: Campus; blocks: Block[]; today: number; source: Record<string, { title: string; url: string; asOf: string }> }) {
  const { toggleRamp } = useScenario();
  const signed = blocks.filter((b) => b.ramp.tier === "live" || b.ramp.tier === "contracted").reduce((a, b) => a + b.itMw, 0);
  const open = blocks.filter((b) => b.ramp.tier === "announced" || b.ramp.tier === "pipeline").reduce((a, b) => a + b.itMw, 0);
  const rent = blocks.filter((b) => b.ramp.revenue != null).reduce((a, b) => a + b.revenue, 0);
  const capex = blocks.reduce((a, b) => a + b.capex, 0);
  const sorted = [...blocks].sort((a, b) => a.start - b.start);
  const otherPhases = campus.phases.filter((p) => p.status === "mining" || p.status === "monetizing" || p.status === "pending-close");

  return (
    <article className="card site" id={`site-${campus.id}`}>
      <div className="site-head">
        <div>
          <h3>{campus.name}</h3>
          <div className="place">{campus.place}{campus.powerMw ? ` · ${mw(campus.powerMw)} ${unitWord[campus.powerUnit ?? "gross"]} power` : ""}</div>
        </div>
        <div className="site-kpis">
          <div><span className="eyebrow">Signed IT</span><b>{signed ? mw(signed) : "—"}</b></div>
          <div><span className="eyebrow">Open or planned</span><b>{open ? mw(open) : "—"}</b></div>
          <div><span className="eyebrow">Disclosed rent</span><b>{rent ? `${usdCompact(rent)}/yr` : "—"}</b></div>
          <div><span className="eyebrow">Build cost</span><b>{usdCompact(capex)}</b></div>
        </div>
      </div>
      {campus.note ? <p className="site-note">{campus.note}</p> : null}
      <div className="timeline"><Timeline blocks={sorted} today={today} /></div>
      <div className="ramps">
        {sorted.map((b) => {
          const r = b.ramp;
          const rate = leaseRateOf(b);
          const src = source[r.source];
          return (
            <div key={r.id} className={b.enabled ? "ramp" : "ramp off"}>
              <div style={{ paddingTop: 2 }}><Switch on={b.enabled} onChange={() => toggleRamp(r)} label={`Include ${r.label} in the forecast`} /></div>
              <div className="cell name">
                <b>
                  {r.label}
                  <span className="pill"><i className="swatch" style={{ background: tierVar(r.tier), width: 8, height: 8 }} />{tierLabel[r.tier]}</span>
                  {b.enabled && b.weight < 1 ? <span className="pill est" title="Your chance that this site gets leased. Its rent and build cost both count at this share.">Counted at {Math.round(b.weight * 100)}%</span> : null}
                </b>
                {r.tenant ? <small className="ink-2" style={{ display: "block", marginTop: 2 }}>{r.tenant}</small> : null}
                {r.note ? <p>{r.note}</p> : null}
                {src ? <a className="ramp-src link" href={src.url} target="_blank" rel="noreferrer">{src.title}</a> : null}
              </div>
              <div className="cell">
                <span className="eyebrow">Capacity</span>
                <b>{mw(b.itMw)} IT</b>
                {r.unit === "gross" || r.unit === "utility" ? <small>{mw(r.mw)} {unitWord[r.unit]} at your conversion</small> : r.unit === "leased-power" ? <small>Leased power</small> : null}
              </div>
              <div className="cell">
                <span className="eyebrow">Online</span>
                <b>{quarter(b.start)}{b.full !== b.start ? ` → ${quarter(b.full)}` : ""}</b>
                <small>{r.timing === "company" ? "Company timeline" : "Our placement"}{b.start !== Date.parse(r.start) ? ", with your delay" : ""}</small>
              </div>
              <div className="cell">
                <span className="eyebrow">Rent, first full year</span>
                <b>{usdCompact(b.revenue / b.averageFactor)}/yr</b>
                <small>
                  {b.revenueFrom === "company" ? "From the company" : "Your rate"}
                  {rate ? ` · $${Math.round(rate)}/kW·mo` : ""}
                </small>
                {b.escalator ? (
                  <small>
                    Rises {(b.escalator * 100).toFixed(1).replace(/\.0$/, "")}% a year{b.escalatorFrom === "company" ? ", disclosed" : ", your assumption"}
                    {b.averageFactor > 1 ? `. Averages ${usdCompact(b.revenue)} over ${r.termYears ?? 15} years` : ""}
                  </small>
                ) : null}
                {r.contractValue ? <small>{usdCompact(r.contractValue)}{r.termYears ? ` over ${r.termYears} yrs` : ""}</small> : r.termYears ? <small>{r.termYears}-year term</small> : null}
                <small>{b.revenue ? `${Math.round((b.noi / b.revenue) * 100)}% margin` : ""}{b.noiFrom === "assumed margin" ? ", your assumption" : b.noiFrom === "company" ? ", disclosed NOI" : ", disclosed"}</small>
              </div>
              <div className="cell">
                <span className="eyebrow">Build cost</span>
                <b>{usdCompact(b.capex)}</b>
                <small>{b.itMw ? perMw(b.capex / b.itMw) : ""} · {b.capexFrom === "company" ? (b.capexKind === "landlord" ? "Landlord share" : b.capexKind === "gpu" ? "GPU capex" : "Disclosed") : b.capexKind === "gpu" ? "GPUs plus the building" : "Your assumption"}</small>
                {r.capexNote ? <small>{r.capexNote}</small> : null}
              </div>
            </div>
          );
        })}
      </div>
      {otherPhases.length ? (
        <div className="other-phases">
          Also on this site:
          <ul>{otherPhases.map((p) => <li key={p.id}>{p.name}{p.mw ? `, ${mw(p.mw)}` : ""} · {statusWord[p.status]}{p.note ? `. ${p.note}` : ""}</li>)}</ul>
        </div>
      ) : null}
    </article>
  );
}
