"use client";
import { useState } from "react";
import { GitBranch, Clock, AlertTriangle, ChevronRight, User } from "lucide-react";

const DEMO_QUEUE = [
  { loanId:1042, accountNo:"L-001042", clientName:"Lubega Kenneth", officerName:"James Okello", officerPhone:"+256701234567", noteText:"Adjust top-up calculation – principal only, NOT total outstanding", noteCreatedBy:"Credit Analyst", noteCreatedOn:"2026-03-01", actionType:"ADJUST", priority:"HIGH", loanStatus:"active", daysPending:2 },
  { loanId:1019, accountNo:"L-001019", clientName:"Anyayo Doreen",  officerName:"Sarah Akello",  officerPhone:"+256782345678", noteText:"Wallet-to-loan offset required before closure. Refer to Sharon for process.", noteCreatedBy:"Manager", noteCreatedOn:"2026-03-02", actionType:"REVIEW", priority:"MEDIUM", loanStatus:"active", daysPending:1 },
  { loanId:997,  accountNo:"L-000997", clientName:"Adongo Winnie",  officerName:"Sarah Akello",  officerPhone:"+256782345678", noteText:"Client savings balance sufficient. Proceed with clearance.", noteCreatedBy:"Checker", noteCreatedOn:"2026-03-02", actionType:"APPROVE", priority:"MEDIUM", loanStatus:"approved", daysPending:1 },
  { loanId:856,  accountNo:"L-000856", clientName:"Nakato Harriet", officerName:"Peter Byaruhanga",officerPhone:"", noteText:"Repossession assessment required. 214 days overdue.", noteCreatedBy:"Manager", noteCreatedOn:"2026-02-15", actionType:"REVIEW", priority:"HIGH", loanStatus:"active", daysPending:17 },
];

const PRIORITY_COLORS: Record<string, string> = { HIGH:"badge-critical", MEDIUM:"badge-high", LOW:"badge-medium" };
const ACTION_COLORS: Record<string, string> = { ADJUST:"bg-orange-100 text-orange-700", REVIEW:"bg-blue-100 text-blue-700", APPROVE:"bg-green-100 text-green-700", DISBURSE:"bg-purple-100 text-purple-700", OTHER:"bg-gray-100 text-gray-600" };

export default function WorkflowPage() {
  const [selected, setSelected] = useState<number | null>(null);
  const [notifyResult, setNotifyResult] = useState<string>("");

  const notify = (item: typeof DEMO_QUEUE[0]) => {
    if (!item.officerPhone) { setNotifyResult(`❌ No phone on file for ${item.officerName}`); return; }
    setNotifyResult(`✅ WhatsApp sent to ${item.officerName} (${item.officerPhone}) about ${item.clientName}`);
    setTimeout(() => setNotifyResult(""), 4000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500 rounded-lg"><GitBranch size={20} className="text-white" /></div>
          <div>
            <h2 className="text-xl font-bold">Action Queue</h2>
            <p className="text-sm text-gray-500">Loans with pending notes requiring officer action</p>
          </div>
        </div>
        <button className="btn-primary text-sm flex items-center gap-2">
          <User size={13} />Notify All Officers
        </button>
      </div>

      {notifyResult && (
        <div className={`p-3 rounded-lg text-sm ${notifyResult.startsWith("✅") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {notifyResult}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {DEMO_QUEUE.map(item => (
          <div key={item.loanId} className={`card cursor-pointer transition ${selected === item.loanId ? "ring-2 ring-brand" : "hover:shadow-md"}`}
            onClick={() => setSelected(selected === item.loanId ? null : item.loanId)}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORITY_COLORS[item.priority]}`}>{item.priority}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ACTION_COLORS[item.actionType]}`}>{item.actionType}</span>
                  <span className="text-xs text-gray-400">{item.accountNo}</span>
                </div>
                <p className="font-semibold mt-1.5">{item.clientName}</p>
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                  <User size={11} />{item.officerName} {!item.officerPhone && <span className="text-red-400">(no phone)</span>}
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className="flex items-center gap-1 text-xs text-orange-500">
                  <Clock size={11} />{item.daysPending}d pending
                </div>
              </div>
            </div>

            <div className="mt-3 bg-gray-50 rounded-lg p-2.5 text-xs text-gray-600 italic">
              "{item.noteText.length > 100 ? item.noteText.slice(0,100)+"..." : item.noteText}"
              <span className="block text-gray-400 mt-1 not-italic">— {item.noteCreatedBy}</span>
            </div>

            {selected === item.loanId && (
              <div className="mt-3 pt-3 border-t flex gap-2">
                <button onClick={(e) => { e.stopPropagation(); notify(item); }}
                  className="btn-primary text-xs flex items-center gap-1.5">
                  Notify Officer via WhatsApp
                </button>
                <button className="btn-secondary text-xs">Open Loan in Mifos</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
