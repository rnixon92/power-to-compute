import { companies } from "@/data/ledger";

export interface Filing {
  ticker: string;
  form: string;
  date: string;
  url: string;
  unread: boolean;
}

const FORMS = new Set(["8-K", "6-K", "10-Q", "10-K", "20-F"]);
const UA = "US-PSP research tracker (personal research project)";
let cache: { at: number; filings: Filing[] } | null = null;

export async function latestFilings(): Promise<Filing[]> {
  if (cache && Date.now() - cache.at < 6 * 60 * 60 * 1000) return cache.filings;
  const filings: Filing[] = [];
  await Promise.all(companies.map(async (company) => {
    try {
      const cik = String(company.cik).padStart(10, "0");
      const res = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) return;
      const body = await res.json() as {
        filings?: { recent?: { form?: string[]; filingDate?: string[]; accessionNumber?: string[]; primaryDocument?: string[] } };
      };
      const recent = body.filings?.recent;
      if (!recent?.form) return;
      for (let i = 0; i < recent.form.length && i < 40; i++) {
        const form = recent.form[i];
        if (!FORMS.has(form)) continue;
        const date = recent.filingDate?.[i];
        const accession = recent.accessionNumber?.[i]?.replace(/-/g, "");
        const doc = recent.primaryDocument?.[i];
        if (!date || !accession || !doc) continue;
        filings.push({
          ticker: company.ticker,
          form,
          date,
          url: `https://www.sec.gov/Archives/edgar/data/${company.cik}/${accession}/${doc}`,
          unread: date > company.reviewedAt,
        });
        break;
      }
    } catch {
      /* one ticker failing does not blank the strip */
    }
  }));
  cache = { at: Date.now(), filings };
  return filings;
}
