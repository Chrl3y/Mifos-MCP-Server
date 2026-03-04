"use client";
import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Users, DollarSign, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const AGING_COLORS: Record<string, string> = {
  "Current":    "#16a34a",
  "1-30 days":  "#65a30d",
  "31-60 days": "#d97706",
  "61-90 days": "#ea580c",
  "91-180 days":"#dc2626",
  "181+ days":  "#7f1d1d",
};

function StatCard({ label, value, sub, icon: Icon, color }: any) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${color}`}><Icon size={20} className="text-white" /></div>
      <div>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  const [snapshot, setSnapshot] = useState<any>(null);
  const [audits,   setAudits]   = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    // In production: fetch from webhook-server /api/mcp/get_portfolio_snapshot
    // Demo data shown when server not connected
    setSnapshot({
      asOfDate: new Date().toISOString().split("T")[0],
      totalActiveLoans: 248, totalOutstanding: 1_847_650_000,
      totalOverdue: 124_320_000, parRatio: 6.7, collectionEfficiency: 93.3,
      byProduct: {
        "HAOJUE": { count: 92, outstanding: 680_000_000, overdue: 45_000_000 },
        "SIMBA BOSS 110": { count: 78, outstanding: 560_000_000, overdue: 38_000_000 },
        "SIMBA RAPTOR":   { count: 45, outstanding: 360_000_000, overdue: 21_000_000 },
        "TVS":            { count: 33, outstanding: 247_650_000, overdue: 20_320_000 },
      },
      aging: {
        "Current":    { count: 198, outstanding: 1_620_000_000 },
        "1-30 days":  { count: 28,  outstanding: 140_000_000 },
        "31-60 days": { count: 12,  outstanding: 55_000_000 },
        "61-90 days": { count: 6,   outstanding: 20_000_000 },
        "91-180 days":{ count: 3,   outstanding: 9_000_000 },
        "181+ days":  { count: 1,   outstanding: 3_650_000 },
      },
    });
    setAudits([
      { checkName: "GL Mapping: HAOJUE", status: "PASS", message: "All 8 GL accounts mapped and active" },
      { checkName: "Standing Instructions", status: "WARNING", message: "3 SIs may fire before confirmed deposits" },
      { checkName: "PAR Ratio", status: "WARNING", message: "PAR 6.7% — above 5% threshold" },
      { checkName: "Freeze Candidates (ISS-013)", status: "FAIL", message: "1 loan overdue 180+ days still ACTIVE" },
    ]);
    setLoading(false);
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading portfolio...</div>;

  const fmt = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(0)}K` : n.toLocaleString();
  const agingData = Object.entries(snapshot.aging).map(([k, v]: any) => ({ bucket: k, count: v.count, outstanding: Math.round(v.outstanding / 1_000_000) }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Portfolio Overview</h2>
        <p className="text-sm text-gray-500">As of {snapshot.asOfDate}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Loans"        value={snapshot.totalActiveLoans}            icon={Users}        color="bg-brand" />
        <StatCard label="Total Outstanding"   value={`UGX ${fmt(snapshot.totalOutstanding)}`} icon={DollarSign}  color="bg-green-600" sub="Loan portfolio" />
        <StatCard label="PAR Ratio"           value={`${snapshot.parRatio}%`}              icon={TrendingDown} color={snapshot.parRatio > 10 ? "bg-red-600" : "bg-orange-500"} sub="Loans at risk" />
        <StatCard label="Collection Eff."     value={`${snapshot.collectionEfficiency}%`}  icon={TrendingUp}   color="bg-teal-600" sub="Repayment performance" />
      </div>

      {/* Aging + Audit side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Aging chart */}
        <div className="card">
          <h3 className="font-semibold mb-4">Loan Aging Buckets</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={agingData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number, n: string) => [n === "outstanding" ? `${v}M UGX` : v, n === "outstanding" ? "Outstanding" : "Loans"]} />
              <Bar dataKey="count" radius={[4,4,0,0]} name="Loans">
                {agingData.map((e, i) => <Cell key={i} fill={AGING_COLORS[e.bucket] ?? "#6b7280"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* System health checks */}
        <div className="card">
          <h3 className="font-semibold mb-4">System Health Checks</h3>
          <div className="space-y-2">
            {audits.map((a, i) => (
              <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-gray-50">
                {a.status === "PASS"    ? <CheckCircle size={16} className="text-green-600 mt-0.5 shrink-0" />
                 : a.status === "FAIL"  ? <AlertTriangle size={16} className="text-red-600 mt-0.5 shrink-0" />
                 : <Clock size={16} className="text-orange-500 mt-0.5 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold">{a.checkName}</p>
                  <p className="text-xs text-gray-500">{a.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* By Product table */}
      <div className="card">
        <h3 className="font-semibold mb-4">Portfolio by Product</h3>
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-gray-500 text-xs uppercase tracking-wide">
            <th className="pb-2">Product</th><th className="pb-2 text-right">Loans</th>
            <th className="pb-2 text-right">Outstanding (UGX)</th><th className="pb-2 text-right">Overdue (UGX)</th>
            <th className="pb-2 text-right">PAR %</th>
          </tr></thead>
          <tbody>
            {Object.entries(snapshot.byProduct).map(([prod, d]: any) => (
              <tr key={prod} className="border-b last:border-0 hover:bg-gray-50">
                <td className="py-2 font-medium">{prod}</td>
                <td className="py-2 text-right">{d.count}</td>
                <td className="py-2 text-right">{fmt(d.outstanding)}</td>
                <td className="py-2 text-right text-orange-600">{fmt(d.overdue)}</td>
                <td className="py-2 text-right">{d.outstanding > 0 ? ((d.overdue / d.outstanding) * 100).toFixed(1) : "0.0"}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
