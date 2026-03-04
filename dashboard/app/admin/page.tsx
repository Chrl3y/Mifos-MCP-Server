"use client";
import { useState } from "react";
import { Settings, Users, Building2, CreditCard, Webhook, BookOpen, RefreshCw, Check, AlertCircle } from "lucide-react";
import { callMcp } from "../../lib/api";

type AdminSection = "loan-products" | "gl-accounts" | "users" | "staff" | "offices" | "payment-types" | "webhooks" | "charges";

interface ListItem {
  id?: number;
  name?: string;
  shortName?: string;
  displayName?: string;
  fullname?: string;
  username?: string;
  code?: string;
  [key: string]: unknown;
}

const SECTIONS: { key: AdminSection; label: string; icon: React.ReactNode; tool: string }[] = [
  { key: "loan-products",  label: "Loan Products",  icon: <CreditCard size={16} />,  tool: "list_loan_products"  },
  { key: "gl-accounts",    label: "GL Accounts",    icon: <BookOpen size={16} />,    tool: "list_gl_accounts"    },
  { key: "users",          label: "Users",           icon: <Users size={16} />,       tool: "list_users"          },
  { key: "staff",          label: "Staff",           icon: <Users size={16} />,       tool: "list_staff"          },
  { key: "offices",        label: "Offices",         icon: <Building2 size={16} />,   tool: "list_offices"        },
  { key: "payment-types",  label: "Payment Types",   icon: <CreditCard size={16} />,  tool: "list_payment_types"  },
  { key: "webhooks",       label: "Webhooks",        icon: <Webhook size={16} />,     tool: "list_webhooks"       },
  { key: "charges",        label: "Charges",         icon: <Settings size={16} />,    tool: "list_charges"        },
];

function itemLabel(item: ListItem): string {
  return item.name ?? item.displayName ?? item.fullname ?? item.username ?? item.shortName ?? item.code ?? String(item.id ?? "—");
}

export default function AdminPage() {
  const [active, setActive] = useState<AdminSection>("loan-products");
  const [data, setData] = useState<ListItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Webhook form
  const [whUrl, setWhUrl]       = useState("");
  const [whEvents, setWhEvents] = useState("LOAN_APPROVED");

  async function loadSection(section: AdminSection) {
    setActive(section);
    setData(null);
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const tool = SECTIONS.find(s => s.key === section)!.tool;
      const res = await callMcp(tool, {});
      // MCP returns text; parse if possible
      try {
        const parsed = JSON.parse(typeof res === "string" ? res : JSON.stringify(res));
        setData(Array.isArray(parsed) ? parsed : [parsed]);
      } catch {
        setData([{ name: String(res) }]);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function createWebhook() {
    if (!whUrl) return;
    setLoading(true);
    setError(null);
    try {
      await callMcp("create_webhook", { url: whUrl, events: whEvents.split(",").map(s => s.trim()) });
      setSuccess(`Webhook created → ${whUrl}`);
      await loadSection("webhooks");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function deleteWebhook(id: number) {
    if (!confirm(`Delete webhook ${id}?`)) return;
    setLoading(true);
    try {
      await callMcp("delete_webhook", { hookId: id });
      setSuccess(`Webhook ${id} deleted`);
      await loadSection("webhooks");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  const section = SECTIONS.find(s => s.key === active)!;
  const columns = data?.length ? Object.keys(data[0]).filter(k => ["id","name","displayName","fullname","username","shortName","code","active","enabled","currency"].includes(k)) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gray-700 rounded-lg"><Settings size={20} className="text-white" /></div>
        <div>
          <h2 className="text-xl font-bold">Fineract Admin</h2>
          <p className="text-sm text-gray-500">Manage loan products, GL accounts, users, webhooks and more</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Sidebar nav */}
        <div className="col-span-1 space-y-1">
          {SECTIONS.map(s => (
            <button
              key={s.key}
              onClick={() => loadSection(s.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all ${active === s.key ? "bg-gray-800 text-white font-medium" : "text-gray-600 hover:bg-gray-100"}`}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        {/* Content panel */}
        <div className="col-span-3 space-y-4">
          {/* Section header + load button */}
          <div className="card flex items-center justify-between">
            <div className="flex items-center gap-2">
              {section.icon}
              <span className="font-semibold">{section.label}</span>
            </div>
            <button onClick={() => loadSection(active)} disabled={loading} className="btn-secondary flex items-center gap-2">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              {data ? "Reload" : "Load"}
            </button>
          </div>

          {/* Webhook creation form */}
          {active === "webhooks" && (
            <div className="card space-y-3">
              <p className="font-medium text-sm">Register New Webhook</p>
              <div className="flex gap-3 flex-wrap">
                <input
                  value={whUrl} onChange={e=>setWhUrl(e.target.value)}
                  placeholder="https://your-server/webhook"
                  className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/30"
                />
                <input
                  value={whEvents} onChange={e=>setWhEvents(e.target.value)}
                  placeholder="LOAN_APPROVED, REPAYMENT_CREATE"
                  className="w-64 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/30"
                />
                <button onClick={createWebhook} className="btn-primary">Register</button>
              </div>
              <p className="text-xs text-gray-400">Separate multiple events with commas</p>
            </div>
          )}

          {error   && <div className="card border-red-200 bg-red-50 flex gap-2"><AlertCircle size={14} className="text-red-600 mt-0.5 shrink-0" /><p className="text-sm text-red-700">{error}</p></div>}
          {success && <div className="card border-green-200 bg-green-50 flex gap-2"><Check size={14} className="text-green-600 mt-0.5 shrink-0" /><p className="text-sm text-green-700">{success}</p></div>}

          {/* Data table */}
          {data && (
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {columns.map(c => (
                        <th key={c} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{c}</th>
                      ))}
                      {active === "webhooks" && <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {columns.map(c => (
                          <td key={c} className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{String(item[c] ?? "—")}</td>
                        ))}
                        {active === "webhooks" && (
                          <td className="px-4 py-2.5">
                            <button onClick={() => deleteWebhook(Number(item.id))} className="text-xs text-red-600 hover:underline">Delete</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-500">{data.length} record{data.length !== 1 ? "s" : ""} · {section.label}</div>
            </div>
          )}

          {!data && !loading && !error && (
            <div className="card flex flex-col items-center justify-center py-16 text-gray-400">
              <Settings size={40} className="mb-3 opacity-30" />
              <p className="text-sm">Click <strong>Load</strong> to fetch {section.label}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
