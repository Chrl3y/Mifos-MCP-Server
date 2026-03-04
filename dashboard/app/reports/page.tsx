"use client";
import { useState } from "react";
import { BarChart3, Play, Download, RefreshCw } from "lucide-react";
import { callMcp } from "../../lib/api";

interface ReportRow {
  [key: string]: string | number;
}

const BUILT_IN_REPORTS = [
  { key: "par_aging",    label: "PAR Aging Report",           description: "Portfolio at risk bucketed by overdue days" },
  { key: "collection_efficiency", label: "Collection Efficiency", description: "Repayments collected vs expected this month" },
  { key: "disbursements", label: "Disbursements Log",         description: "All loan disbursements in date range" },
  { key: "outstanding_balances", label: "Outstanding Balances", description: "Total principal, interest, penalty outstanding" },
  { key: "officer_portfolio", label: "Officer Portfolio",     description: "Loan count and PAR by loan officer" },
  { key: "product_performance", label: "Product Performance", description: "Disbursement volume and collection rate by product" },
  { key: "overdue_loans", label: "Overdue Loans",             description: "All loans with overdue installments" },
  { key: "gl_summary",   label: "GL Account Summary",         description: "Balance per GL account as at today" },
];

export default function ReportsPage() {
  const [selected, setSelected] = useState(BUILT_IN_REPORTS[0].key);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [dateTo,   setDateTo]   = useState(new Date().toISOString().slice(0, 10));

  async function runReport() {
    setLoading(true);
    setError(null);
    setRows(null);
    try {
      const res = await callMcp("run_report", { reportName: selected, dateFrom, dateTo });
      // MCP returns text; try to parse tabular data
      const text = typeof res === "string" ? res : JSON.stringify(res, null, 2);
      // If JSON array returned, show as table; otherwise show raw text
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) { setRows(parsed); return; }
      } catch { /* not JSON */ }
      setRows([{ report_output: text }]);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function downloadCsv() {
    if (!rows?.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => `"${String(r[h]).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${selected}_${dateTo}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const rpt = BUILT_IN_REPORTS.find(r => r.key === selected)!;
  const columns = rows?.length ? Object.keys(rows[0]) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-brand rounded-lg"><BarChart3 size={20} className="text-white" /></div>
        <div>
          <h2 className="text-xl font-bold">Reports</h2>
          <p className="text-sm text-gray-500">Run Nova MFI standard reports via Fineract</p>
        </div>
      </div>

      {/* Report selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-1 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Available Reports</p>
          {BUILT_IN_REPORTS.map(r => (
            <button
              key={r.key}
              onClick={() => { setSelected(r.key); setRows(null); setError(null); }}
              className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${selected === r.key ? "border-brand bg-blue-50 text-brand font-semibold" : "border-gray-200 hover:border-gray-300 text-gray-700"}`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Report panel */}
        <div className="col-span-2 space-y-4">
          <div className="card">
            <p className="font-semibold">{rpt.label}</p>
            <p className="text-sm text-gray-500 mt-0.5">{rpt.description}</p>

            <div className="flex gap-3 mt-4 items-end flex-wrap">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">From</label>
                <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">To</label>
                <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
              <button onClick={runReport} disabled={loading} className="btn-primary flex items-center gap-2">
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                {loading ? "Running…" : "Run Report"}
              </button>
              {rows && (
                <button onClick={downloadCsv} className="btn-secondary flex items-center gap-2">
                  <Download size={14} /> Download CSV
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="card border-red-200 bg-red-50">
              <p className="text-sm text-red-700 font-medium">Error</p>
              <p className="text-xs text-red-600 mt-1 whitespace-pre-wrap">{error}</p>
            </div>
          )}

          {rows && (
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {columns.map(c => (
                        <th key={c} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{c.replace(/_/g, " ")}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {columns.map(c => (
                          <td key={c} className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{String(row[c])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-500">{rows.length} row{rows.length !== 1 ? "s" : ""}</div>
            </div>
          )}

          {!rows && !loading && !error && (
            <div className="card flex flex-col items-center justify-center py-16 text-center text-gray-400">
              <BarChart3 size={40} className="mb-3 opacity-30" />
              <p className="text-sm">Select a report and click <strong>Run Report</strong></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
