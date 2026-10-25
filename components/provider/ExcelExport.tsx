"use client";

import { useState } from "react";
import type { Company } from "@/data/types";
import type { Ctx, Valuation } from "@/lib/forecast";
import { useScenario } from "@/components/ScenarioProvider";

/** Downloads the lease DCF, as set on screen, as a workbook with live formulas. The library loads on the first click. */
export function ExcelExport({ company, ctx, value }: { company: Company; ctx: Ctx; value: Valuation }) {
  const { scenario } = useScenario();
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");

  async function download() {
    setState("busy");
    try {
      const [{ default: ExcelJS }, { buildWorkbook, workbookName }] = await Promise.all([import("exceljs"), import("@/lib/excel")]);
      const wb = buildWorkbook(ExcelJS, { company, scenario, ctx, value, url: window.location.href });
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = workbookName(company);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      setState("idle");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="card card-pad excel-card">
      <div>
        <h3 style={{ fontSize: 15 }}>Take the model with you</h3>
        <p className="note" style={{ marginTop: 4 }}>
          The lease DCF as you have it set, in a workbook with live formulas: every assumption, every site and the balance sheet, month by month to 2050. Change a cell and it recalculates. Works in Excel and Google Sheets.
        </p>
        {state === "failed" ? <p className="note" style={{ marginTop: 6, color: "var(--down)" }}>The download did not start. Try again, or use another browser.</p> : null}
      </div>
      <button type="button" className="btn" onClick={download} disabled={state === "busy"} aria-busy={state === "busy"}>
        {state === "busy" ? "Building the workbook…" : "Download as Excel"}
      </button>
    </div>
  );
}
