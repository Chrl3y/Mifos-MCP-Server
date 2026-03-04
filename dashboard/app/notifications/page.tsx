"use client";
import { useState } from "react";
import { Bell, MessageSquare, Send, Users, RefreshCw, CheckCircle, XCircle } from "lucide-react";

const EVENTS = ["LOAN_NOTE_ADDED","LOAN_APPROVED","LOAN_REJECTED","LOAN_DISBURSED","LOAN_OVERDUE","CHECKER_ACTION_REQUIRED","PAYMENT_RECEIVED","DOWN_PAYMENT_RECEIVED","STANDING_INSTRUCTION_FAILED"];

export default function NotificationsPage() {
  const [tab, setTab] = useState<"send"|"bulk"|"log">("send");
  const [form, setForm] = useState({ phone:"+256", name:"", message:"", channel:"whatsapp", event: EVENTS[0] });
  const [result, setResult] = useState<any>(null);
  const [bulk, setBulk] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    setLoading(true);
    setTimeout(() => {
      setResult([{ success: true, channel: form.channel, recipient: form.phone, messageId: `AT-${Date.now()}`, cost: "UGX 35" }]);
      setLoading(false);
    }, 1200);
  };

  const bulkNotify = async () => {
    setLoading(true);
    setTimeout(() => {
      setBulk({ notified: 12, failed: 1, skipped: 3, details: ["✅ James Okello (+256701234567): 3 items","✅ Sarah Akello (+256782345678): 2 items","❌ Peter Mukasa: no phone on file"] });
      setLoading(false);
    }, 1800);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-blue-600 rounded-lg"><Bell size={20} className="text-white" /></div>
        <div>
          <h2 className="text-xl font-bold">Notification Engine</h2>
          <p className="text-sm text-gray-500">WhatsApp & SMS via Africa's Talking · Uganda-optimised</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {[["send","Send Manual"],["bulk","Bulk Notify Officers"],["log","Event Log"]].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t as any)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === t ? "bg-white shadow text-brand" : "text-gray-500 hover:text-gray-700"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Send Manual */}
      {tab === "send" && (
        <div className="card space-y-4">
          <h3 className="font-semibold">Send Notification</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Recipient Phone</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand" value={form.phone} onChange={e => setForm(f=>({...f, phone:e.target.value}))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Recipient Name</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand" value={form.name} onChange={e => setForm(f=>({...f, name:e.target.value}))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Channel</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand" value={form.channel} onChange={e => setForm(f=>({...f, channel:e.target.value}))}>
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Event Template</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand" value={form.event} onChange={e => setForm(f=>({...f, event:e.target.value}))}>
                {EVENTS.map(e => <option key={e} value={e}>{e.replace(/_/g," ")}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Message</label>
            <textarea rows={4} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
              value={form.message} onChange={e => setForm(f=>({...f, message:e.target.value}))}
              placeholder="Custom message or leave blank to use event template..." />
          </div>
          <button onClick={send} disabled={loading || !form.phone}
            className="btn-primary flex items-center gap-2 disabled:opacity-50">
            <Send size={14} />{loading ? "Sending..." : "Send Notification"}
          </button>
          {result && result.map((r: any, i: number) => (
            <div key={i} className={`flex items-center gap-2 p-3 rounded-lg text-sm ${r.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {r.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
              <span>{r.success ? `✅ Sent via ${r.channel} | ID: ${r.messageId} | Cost: ${r.cost}` : `❌ Failed: ${r.error}`}</span>
            </div>
          ))}
        </div>
      )}

      {/* Bulk */}
      {tab === "bulk" && (
        <div className="card space-y-4">
          <h3 className="font-semibold">Bulk Officer Notifications</h3>
          <p className="text-sm text-gray-500">Scans all loans for unresolved notes and notifies each assigned officer. Replaces manual client-list searching.</p>
          <div className="grid grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg text-center text-sm">
            <div><p className="text-2xl font-bold text-brand">{bulk?.notified ?? "—"}</p><p className="text-gray-500">Notified</p></div>
            <div><p className="text-2xl font-bold text-red-500">{bulk?.failed ?? "—"}</p><p className="text-gray-500">Failed</p></div>
            <div><p className="text-2xl font-bold text-gray-400">{bulk?.skipped ?? "—"}</p><p className="text-gray-500">No Phone</p></div>
          </div>
          <button onClick={bulkNotify} disabled={loading}
            className="btn-primary flex items-center gap-2 disabled:opacity-50">
            <Users size={14} />{loading ? "Scanning & Sending..." : "Notify All Officers Now"}
          </button>
          {bulk?.details && (
            <div className="space-y-1">
              {bulk.details.map((d: string, i: number) => (
                <p key={i} className="text-xs font-mono bg-gray-50 px-3 py-1.5 rounded">{d}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Log */}
      {tab === "log" && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Webhook Event Log</h3>
            <button className="btn-secondary flex items-center gap-1.5 text-xs"><RefreshCw size={12} />Refresh</button>
          </div>
          <div className="space-y-2 text-sm">
            {[
              { ts:"2026-03-03 14:22", entity:"NOTE", action:"CREATE", notified: true, detail:"Note on Lubega Kenneth (L-00234)" },
              { ts:"2026-03-03 13:45", entity:"LOAN", action:"APPROVE", notified: true, detail:"Loan approved: Akello Sarah (L-00233)" },
              { ts:"2026-03-03 12:11", entity:"REPAYMENT", action:"CREATE", notified: true, detail:"MTN payment: 150,000 UGX on L-00190" },
              { ts:"2026-03-03 09:03", entity:"LOAN", action:"DISBURSE", notified: true, detail:"Disbursed: Okello James (L-00230)" },
            ].map((ev, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50">
                <span className="text-xs text-gray-400 w-32 shrink-0">{ev.ts}</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{ev.entity}</span>
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{ev.action}</span>
                <span className="text-xs flex-1">{ev.detail}</span>
                {ev.notified && <CheckCircle size={13} className="text-green-500 shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
