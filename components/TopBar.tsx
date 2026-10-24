"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { companies } from "@/data/ledger";
import type { Quote } from "@/data/types";
import { companyVar } from "@/lib/palette";
import { scenarioChip } from "@/lib/scenario";
import { useHref, useScenario } from "@/components/ScenarioProvider";
import { Delta } from "@/components/ui";

const links = [
  { href: "/", label: "Overview" },
  { href: "/demand", label: "Demand" },
  { href: "/method", label: "Method" },
];

export function TopBar({ quotes }: { quotes: Pick<Quote, "ticker" | "price" | "changePercent">[] }) {
  const path = usePathname();
  const href = useHref();
  const { scenario, openPanel } = useScenario();
  const chip = scenarioChip(scenario);
  const bar = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const apply = () => document.documentElement.style.setProperty("--header-h", `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <header className="topbar" ref={bar}>
      <div className="wrap topbar-row">
        <Link href={href("/")} className="brand">
          Power to Compute
        </Link>
        <nav className="nav-links">
          {links.map((l) => {
            const on = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return <Link key={l.href} href={href(l.href)} className={on ? "on" : ""}>{l.label}</Link>;
          })}
        </nav>
        <div className="topbar-end">
          <button type="button" className="assume-btn" onClick={openPanel} aria-haspopup="dialog">
            <span>{chip.main}</span>
            <small>{chip.scope}</small>
          </button>
          <ThemeToggle />
        </div>
      </div>
      <Tape quotes={quotes} path={path} href={href} />
    </header>
  );
}

function Tape({ quotes, path, href }: { quotes: Pick<Quote, "ticker" | "price" | "changePercent">[]; path: string; href: (p: string) => string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false, narrow: false });

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => {
      const narrow = window.matchMedia("(max-width: 860px)").matches;
      setEdges({
        narrow,
        left: narrow && el.scrollLeft > 4,
        right: narrow && el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
      });
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, []);

  function scrollBy(dir: number) {
    scroller.current?.scrollBy({ left: dir * 240, behavior: "smooth" });
  }

  const cls = ["tape", edges.narrow ? "narrow" : "", edges.left ? "fade-left" : "", edges.right ? "fade-right" : ""].filter(Boolean).join(" ");

  return (
    <div className={cls}>
      {edges.narrow && edges.left ? <button type="button" className="tape-nav left" aria-label="Show earlier companies" onClick={() => scrollBy(-1)}>‹</button> : null}
      <div className="wrap tape-scroll" ref={scroller}>
        {companies.map((c) => {
          const q = quotes.find((x) => x.ticker === c.ticker);
          const on = path.toLowerCase() === `/companies/${c.ticker.toLowerCase()}`;
          return (
            <Link key={c.ticker} href={href(`/companies/${c.ticker}`)} className={on ? "on" : ""}>
              <i className="dot" style={{ background: companyVar(c.ticker) }} />
              <b>{c.ticker}</b>
              <span className="px tabular">{q?.price != null ? `$${q.price.toFixed(2)}` : "—"}</span>
              <Delta value={q?.changePercent ?? null} />
            </Link>
          );
        })}
      </div>
      {edges.narrow && edges.right ? <button type="button" className="tape-nav right" aria-label="Show more companies" onClick={() => scrollBy(1)}>›</button> : null}
    </div>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => {
    const stored = document.documentElement.dataset.theme as "light" | "dark" | undefined;
    setTheme(stored ?? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
  }, []);
  function flip() {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("psp-theme", next);
    } catch {
      /* private mode */
    }
    setTheme(next);
  }
  return (
    <button type="button" className="icon-btn" onClick={flip} aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}>
      {theme === "light" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      )}
    </button>
  );
}
