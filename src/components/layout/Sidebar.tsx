"use client";
import { Activity, BarChart2, Calendar, Heart, Settings, TrendingUp, Zap } from "lucide-react";
import { clsx } from "clsx";

const NAV = [
  { id: "overview", label: "Übersicht", icon: Zap },
  { id: "hrv", label: "HRV & Erholung", icon: Heart },
  { id: "fitness", label: "Fitness-Trend", icon: TrendingUp },
  { id: "wellness", label: "Wellness-Charts", icon: BarChart2 },
  { id: "calendar", label: "Kalender", icon: Calendar },
  { id: "activities", label: "Aktivitäten", icon: Activity },
  { id: "settings", label: "Einstellungen", icon: Settings },
];

interface Props {
  active: string;
  onSelect: (id: string) => void;
}

export default function Sidebar({ active, onSelect }: Props) {
  return (
    <aside className="fixed left-0 top-0 h-full w-52 bg-dash-card border-r border-dash-border flex flex-col z-20">
      <div className="p-4 border-b border-dash-border">
        <div className="flex items-center gap-2">
          <span className="text-indigo-400 text-xl">⚡</span>
          <span className="text-white font-semibold text-sm leading-tight">
            Intervals<br />
            <span className="text-indigo-400 text-xs font-normal">Dashboard</span>
          </span>
        </div>
      </div>
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className={clsx(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left",
              active === id
                ? "bg-indigo-600 text-white"
                : "text-dash-muted hover:text-white hover:bg-white/5"
            )}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
