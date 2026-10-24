"use client";

import Link from "next/link";
import { useState } from "react";
import { companies } from "@/data/ledger";
import type { MarketBook } from "@/data/types";
import { groupMove, kindLabel, reaction, type Dated } from "@/lib/events";
import { companyVar } from "@/lib/palette";
import { isoToLabel } from "@/lib/format";
import { useHref } from "@/components/ScenarioProvider";
import { Delta } from "@/components/ui";

function when(e: Dated): string {
  if (!e.monthOnly) return isoToLabel(e.date);
  const [y, m] = e.date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function EventList({ events, market, limit, showTicker }: { events: Dated[]; market: MarketBook; limit?: number; showTicker?: boolean }) {
  const href = useHref();
  const [all, setAll] = useState(false);
  const shown = limit && !all ? events.slice(0, limit) : events;
  const histories = market.quotes.map((q) => ({ ticker: q.ticker, history: q.history }));
  if (!events.length) return <div className="card card-pad note">Nothing dated in the ledger yet.</div>;
  return (
    <div className="card events">
      {shown.map((e, i) => {
        const company = companies.find((c) => c.ticker === e.ticker);
        const source = company?.sources.find((x) => x.id === e.source);
        const history = market.quotes.find((q) => q.ticker === e.ticker)?.history ?? [];
        const move = reaction(history, e);
        const group = move != null ? groupMove(histories, e) : null;
        return (
          <div className="event" key={`${e.ticker}-${e.date}-${i}`}>
            <span className="event-date tabular">{when(e)}</span>
            <div className="event-body">
              <div className="event-head">
                {showTicker ? (
                  <Link href={href(`/companies/${e.ticker}`)} className="event-ticker">
                    <i className="dot" style={{ background: companyVar(e.ticker) }} />
                    {e.ticker}
                  </Link>
                ) : null}
                <span className="pill">{kindLabel[e.kind]}</span>
                <b>{e.title}</b>
              </div>
              {e.detail ? <p>{e.detail}</p> : null}
              {source ? <a className="ramp-src link" href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : null}
            </div>
            <div className="event-move" title="Change from the last close before the news to five trading days after, next to the average of the other companies over the same days">
              {move != null ? (
                <>
                  <Delta value={move * 100} digits={0} />
                  <small>5 days after{group != null ? `, group ${group >= 0 ? "+" : "−"}${Math.abs(group * 100).toFixed(0)}%` : ""}</small>
                </>
              ) : (
                <small>{e.monthOnly ? "Day not given" : "Too recent"}</small>
              )}
            </div>
          </div>
        );
      })}
      {limit && events.length > limit ? (
        <div className="events-foot">
          <button type="button" className="btn ghost" onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show all ${events.length}`}</button>
        </div>
      ) : null}
    </div>
  );
}
