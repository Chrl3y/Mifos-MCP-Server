"use client";
import { Bell, RefreshCw } from "lucide-react";

export default function Header() {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <div>
        <p className="text-sm text-gray-500">{new Date().toLocaleDateString("en-UG", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}</p>
      </div>
      <div className="flex items-center gap-3">
        <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="Refresh data">
          <RefreshCw size={16} />
        </button>
        <button className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="Notifications">
          <Bell size={16} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        <div className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center text-xs font-bold">N</div>
      </div>
    </header>
  );
}
