"use client";
import { useState } from "react";
import { Calculator, Send, Copy, CheckCheck } from "lucide-react";

const PRODUCTS = ["HAOJUE","SIMBA_BOSS_110","SIMBA_RAPTOR","TVS","HONDA"];
const CHANNELS = ["MTN","AIRTEL","YO","CASH","BANK"];

interface BreakdownLine { name: string; glCode: string; direction: "DR"|"CR"; amount: number; note: string; }
interface Result {
  productKey: string; productLabel: string; clientName: string; loanAccountNo: string;
  transactionDate: string; currency: string; loanAmount: number; downPayment: number;
  totalReceived: number; lines: BreakdownLine[]; totalDr: number; totalCr: number;
  balanced: boolean; walletAmount: number; summary: string;
}

export default function DepositCalculatorPage() {
  const [form, setForm] = useState({
    productKey: "HAOJUE", totalReceived: "", loanAmount: "",
    paymentChannel: "MTN", clientName: "", loanAccountNo: "",
    transactionDate: new Date().toISOString().split("T")[0],
  });
  const [result, setResult]   = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [posted,  setPosted]  = useState(false);
  const [copied,  setCopied]  = useState(false);
  const [error,   setError]   = useState("");

  const fmt = (n: number) => n.toLocaleString("en-UG");

  const calculate = async () => {
    setLoading(true); setError(""); setResult(null); setPosted(false);
    try {
      const res = await fetch("/api/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, totalReceived: Number(form.totalReceived), loanAmount: Number(form.loanAmount) }),
      });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Calculation failed");
    } finally { setLoading(false); }
  };

  const postToGL = async () => {
    if (!result) return;
    setLoading(true);
    try {
      const res = await fetch("/api/post-gl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ breakdown: { ...result, transactionDate: form.transactionDate, currency: "UGX" } }),
      });
      if (!res.ok) throw new Error(await res.text());
      setPosted(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Post failed");
    } finally { setLoading(false); }
  };

  const copyTable = () => {
    if (!result) return;
    const header = "Account                      | GL Code | DR (UGX)        | CR (UGX)";
    const sep    = "-".repeat(70);
    const rows   = result.lines.map(l =>
      `${(l.name).padEnd(28)} | ${l.glCode.padEnd(7)} | ${(l.direction==="DR"?fmt(l.amount):"").padStart(15)} | ${(l.direction==="CR"?fmt(l.amount):"").padStart(15)}`
    );
    const foot = `${"TOTAL".padEnd(28)} | ${"".padEnd(7)} | ${fmt(result.totalDr).padStart(15)} | ${fmt(result.totalCr).padStart(15)}`;
    navigator.clipboard.writeText([header,sep,...rows,sep,foot].join("\n"));
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-brand rounded-lg"><Calculator size={20} className="text-white" /></div>
        <div>
          <h2 className="text-xl font-bold">Deposit Breakdown Calculator</h2>
          <p className="text-sm text-gray-500">Split incoming payment into correct GL posting lines</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="card lg:col-span-1 space-y-4">
          <h3 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Payment Details</h3>

          {(["productKey","paymentChannel"] as const).map(key => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{key==="productKey"?"Product":"Payment Channel"}</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand outline-none"
                value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}>
                {(key==="productKey"?PRODUCTS:CHANNELS).map(o => <option key={o} value={o}>{o.replace(/_/g," ")}</option>)}
              </select>
            </div>
          ))}

          {([
            ["Total Received (UGX)", "totalReceived", "Amount client paid"],
            ["Loan Amount (UGX)",    "loanAmount",    "Approved loan value"],
            ["Client Name",          "clientName",    ""],
            ["Loan Account No",      "loanAccountNo", ""],
            ["Transaction Date",     "transactionDate",""],
          ] as const).map(([label,key,ph]) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input
                type={key.includes("Date")?"date":"text"} placeholder={ph as string}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand outline-none"
                value={form[key as keyof typeof form]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}

          <button
            onClick={calculate}
            disabled={!form.totalReceived || !form.loanAmount || loading}
            className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
            <Calculator size={15} />{loading ? "Calculating..." : "Calculate Breakdown"}
          </button>

          {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg">{error}</p>}
        </div>

        {/* Result */}
        <div className="lg:col-span-2 space-y-4">
          {result ? (
            <>
              <div className={`card border-l-4 ${result.balanced?"border-green-500":"border-red-500"}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{result.productLabel}</p>
                    <p className="text-sm text-gray-500">{result.clientName} · {result.loanAccountNo}</p>
                    <p className="text-sm text-gray-500">Total received: UGX {fmt(result.totalReceived)}</p>
                  </div>
                  <span className={result.balanced?"badge-pass":"badge-fail"}>
                    {result.balanced?"✅ BALANCED":"❌ IMBALANCED"}
                  </span>
                </div>
              </div>

              <div className="card overflow-x-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-sm">GL Posting Breakdown</h3>
                  <div className="flex gap-2">
                    <button onClick={copyTable} className="btn-secondary flex items-center gap-1.5 text-xs">
                      {copied?<CheckCheck size={13}/>:<Copy size={13}/>}{copied?"Copied!":"Copy Table"}
                    </button>
                    {result.balanced && (
                      <button onClick={postToGL} disabled={loading||posted} className="btn-primary flex items-center gap-1.5 text-xs disabled:opacity-50">
                        <Send size={13}/>{posted?"✅ Posted to GL":loading?"Posting...":"Post to Fineract GL"}
                      </button>
                    )}
                  </div>
                </div>

                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="pb-2 w-2/5">Account</th>
                    <th className="pb-2 text-right">DR (UGX)</th>
                    <th className="pb-2 text-right">CR (UGX)</th>
                    <th className="pb-2 text-right">Amount</th>
                    <th className="pb-2">Basis</th>
                  </tr></thead>
                  <tbody>
                    {result.lines.map((line,i) => (
                      <tr key={i} className={`border-b last:border-0 hover:bg-gray-50 ${line.direction==="DR"?"font-medium":""}`}>
                        <td className="py-2">
                          <p className="font-medium">{line.name}</p>
                          <p className="text-xs text-gray-400">GL {line.glCode}</p>
                        </td>
                        <td className="py-2 text-right text-brand">{line.direction==="DR"?fmt(line.amount):""}</td>
                        <td className="py-2 text-right text-gray-600">{line.direction==="CR"?fmt(line.amount):""}</td>
                        <td className="py-2 text-right font-medium">{fmt(line.amount)}</td>
                        <td className="py-2 text-xs text-gray-400">{line.note}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="border-t-2 font-bold text-sm">
                    <td className="pt-2">TOTAL</td>
                    <td className="pt-2 text-right text-brand">{fmt(result.totalDr)}</td>
                    <td className="pt-2 text-right">{fmt(result.totalCr)}</td>
                    <td colSpan={2}/>
                  </tr></tfoot>
                </table>

                {result.walletAmount > 0 && (
                  <div className="mt-3 p-2.5 bg-blue-50 rounded-lg text-xs text-blue-700">
                    💳 Loan Repayment Wallet: <strong>UGX {fmt(result.walletAmount)}</strong>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="card flex flex-col items-center justify-center h-64 text-gray-400">
              <Calculator size={40} className="mb-3 opacity-30"/>
              <p className="text-sm">Enter payment details and click Calculate</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
