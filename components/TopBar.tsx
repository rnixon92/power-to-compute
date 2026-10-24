"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { companies } from "@/data/ledger";
import type { Quote } from "@/data/types";
import { companyVar } from "@/lib/palette";
import { useHref } from "@/components/ScenarioProvider";
import { Delta } from "@/components/ui";

const links = [
  { href: "/", label: "Overview" },
  { href: "/demand", label: "Demand" },
  { href: "/method", label: "Method" },
];

export function TopBar({ quotes }: { quotes: Pick<Quote, "ticker" | "price" | "changePercent">[] }) {
  const path = usePathname();
  const href = useHref();
  return (
    <header className="topbar">
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
          <ThemeToggle />
        </div>
      </div>
      <div className="tape">
        <div className="wrap tape-row">
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
      </div>
    </header>
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
