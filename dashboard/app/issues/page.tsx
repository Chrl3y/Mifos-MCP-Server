"use client";
import { useState } from "react";
import { AlertCircle, Filter } from "lucide-react";
import issues from "../../lib/issues-data";

const P_COLORS: Record<string, string> = { CRITICAL:"badge-critical", HIGH:"badge-high", MEDIUM:"badge-medium", LOW:"badge-pass" };
const S_COLORS: Record<string, string> = { ESCALATED:"bg-red-100 text-red-700", "AWAITING DEV":"bg-orange-100 text-orange-700", IDENTIFIED:"bg-yellow-100 text-yellow-700", RESOLVED:"bg-green-100 text-green-700", "IN PROGRESS":"bg-blue-100 text-blue-700", OPEN:"bg-gray-100 text-gray-600", NEW:"bg-gray-100 text-gray-600" };

export default function IssuesPage() {
  const [filterDomain,   setFilterDomain]   = useState("All");
  const [filterPriority, setFilterPriority] = useState("All");
  const [expanded, setExpanded] = useState<string | null>(null);

  const domains   = ["All", ...Array.from(new Set(issues.map(i => i.domain)))];
  const priorities = ["All", "CRITICAL", "HIGH", "MEDIUM", "LOW"];

  const filtered = issues.filter(i =>
    (filterDomain   === "All" || i.domain   === filterDomain) &&
    (filterPriority === "All" || i.priority === filterPriority)
  );

  const counts = { CRITICAL: issues.filter(i=>i.priority==="CRITICAL").length, HIGH: issues.filter(i=>i.priority==="HIGH").length, MEDIUM: issues.filter(i=>i.priority==="MEDIUM").length };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-red-600 rounded-lg"><AlertCircle size={20} className="text-white" /></div>
        <div>
          <h2 className="text-xl font-bold">Issue Tracker</h2>
          <p className="text-sm text-gray-500">{issues.length} tracked issues — {counts.CRITICAL} critical, {counts.HIGH} high</p>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex gap-3 flex-wrap">
        {Object.entries(counts).map(([p,n]) => (
          <div key={p} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${P_COLORS[p]}`}>{n} {p}</div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <Filter size={14} className="text-gray-400" />
        <select className="border rounded-lg px-3 py-1.5 text-sm outline-none" value={filterDomain} onChange={e=>setFilterDomain(e.target.value)}>
          {domains.map(d=><option key={d} value={d}>{d}</option>)}
        </select>
        <select className="border rounded-lg px-3 py-1.5 text-sm outline-none" value={filterPriority} onChange={e=>setFilterPriority(e.target.value)}>
          {priorities.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <span className="text-xs text-gray-400">{filtered.length} issues</span>
      </div>

      {/* Issue list */}
      <div className="space-y-2">
        {filtered.map(issue => (
          <div key={issue.id} className="card cursor-pointer" onClick={()=>setExpanded(expanded===issue.id?null:issue.id)}>
            <div className="flex items-start gap-3">
              <div className="shrink-0 pt-0.5">
                <span className="text-xs font-mono text-gray-400">{issue.id}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${P_COLORS[issue.priority] ?? ""}`}>{issue.priority}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${S_COLORS[issue.status] ?? "bg-gray-100 text-gray-600"}`}>{issue.status}</span>
                  <span className="text-xs text-gray-400">{issue.domain} · {issue.category}</span>
                </div>
                <p className="font-semibold mt-1">{issue.title}</p>
                {expanded === issue.id && (
                  <div className="mt-3 space-y-2 text-sm">
                    <p className="text-gray-600">{issue.description}</p>
                    {issue.businessImpact && <p className="text-orange-700 text-xs bg-orange-50 p-2 rounded-lg"><strong>Business Impact:</strong> {issue.businessImpact}</p>}
                    {issue.rootCause      && <p className="text-gray-500 text-xs"><strong>Root Cause:</strong> {issue.rootCause}</p>}
                    {issue.suggestedFix   && <p className="text-blue-700 text-xs bg-blue-50 p-2 rounded-lg"><strong>Suggested Fix:</strong> {issue.suggestedFix}</p>}
                    {issue.assignedTo     && <p className="text-xs text-gray-400 mt-1">Assigned to: <strong>{issue.assignedTo}</strong></p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
