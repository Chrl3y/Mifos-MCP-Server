"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Calculator, AlertCircle, Bell, GitBranch, FileBarChart, Settings, Webhook, Users, BookOpen,
} from "lucide-react";

const nav = [
  { href: "/",                      label: "Portfolio",         icon: LayoutDashboard },
  { href: "/deposit-calculator",    label: "Deposit Calculator",icon: Calculator },
  { href: "/notifications",         label: "Notifications",     icon: Bell },
  { href: "/workflow",              label: "Action Queue",      icon: GitBranch },
  { href: "/reports",               label: "Reports",           icon: FileBarChart },
  { href: "/issues",                label: "Issue Tracker",     icon: AlertCircle },
  { href: "/admin",                 label: "Admin",             icon: Settings },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="w-56 bg-brand-dark text-white flex flex-col shrink-0">
      <div className="px-4 py-5 border-b border-brand">
        <p className="text-xs text-blue-300 font-medium uppercase tracking-widest">Nova MFI</p>
        <h1 className="text-base font-bold mt-0.5">System Doctor</h1>
      </div>
      <nav className="flex-1 py-4 space-y-0.5 px-2">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${active ? "bg-brand text-white font-semibold" : "text-blue-200 hover:bg-brand hover:text-white"}`}>
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-3 border-t border-brand text-xs text-blue-300">
        v1.0.0 · Mifos X / Fineract
      </div>
    </aside>
  );
}
