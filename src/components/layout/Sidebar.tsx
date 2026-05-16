"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, Calendar, FlaskConical, Heart, Scale, Settings, TrendingUp, Zap, X, Activity, GitCompare, Dumbbell, CheckSquare } from "lucide-react";
import { clsx } from "clsx";
import { useState, useEffect } from "react";
import { getPageSettings } from "@/lib/settings";

const NAV_ALWAYS = [
  { href: "/", label: "Übersicht", icon: Zap },
  { href: "/hrv", label: "HRV & Erholung", icon: Heart },
  { href: "/fitness", label: "Fitness-Trend", icon: TrendingUp },
  { href: "/habits", label: "Habits", icon: CheckSquare },
  { href: "/wellness", label: "Wellness", icon: BarChart2 },
  { href: "/compare", label: "Vergleich", icon: GitCompare },
  { href: "/calendar", label: "Kalender", icon: Calendar },
];

const NAV_TOGGLEABLE = [
  { href: "/training", label: "Training", icon: Dumbbell, id: "training" },
  { href: "/koerper",  label: "Körper & Ziele", icon: Scale, id: "koerper" },
  { href: "/analyse",  label: "Analyse", icon: FlaskConical, id: "analyse" },
];

interface Props {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = true, onClose }: Props) {
  const pathname = usePathname();
  const [pageSettings, setPageSettings] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV_TOGGLEABLE.map((p) => [p.id, true]))
  );

  useEffect(() => {
    setPageSettings(getPageSettings());
    const refresh = () => setPageSettings(getPageSettings());
    window.addEventListener("page-settings-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("page-settings-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const nav = [
    ...NAV_ALWAYS,
    ...NAV_TOGGLEABLE.filter((p) => pageSettings[p.id] !== false),
  ].sort((a, b) => {
    const order = ["/", "/hrv", "/fitness", "/training", "/wellness", "/koerper", "/analyse", "/compare", "/calendar"];
    return order.indexOf(a.href) - order.indexOf(b.href);
  });

  return (
    <aside
      className={clsx(
        "fixed left-0 top-0 h-full w-52 bg-dash-card border-r border-dash-border flex flex-col z-20",
        "transition-transform duration-200 ease-in-out",
        // Desktop: always visible. Mobile: toggle via transform.
        "lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      {/* Logo */}
      <div className="p-4 border-b border-dash-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--a-600)" }}>
            <Zap size={14} className="text-white" fill="white" />
          </div>
          <span className="text-white font-semibold text-sm leading-tight">
            Intervals<br />
            <span className="text-accent text-[11px] font-normal">Dashboard</span>
          </span>
        </div>
        {/* Close button – mobile only */}
        <button
          onClick={onClose}
          className="lg:hidden text-dash-muted hover:text-white transition-colors p-1"
        >
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150",
                active
                  ? "text-white shadow-lg"
                  : "text-dash-muted hover:text-white hover:bg-white/5"
              )}
              style={active ? { backgroundColor: "var(--a-600)", boxShadow: "0 4px 12px rgb(var(--a-900-hex,30 27 75)/0.4)" } : {}}
            >
              <Icon size={15} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-dash-border space-y-0.5">
        {(() => {
          const active = pathname.startsWith("/einstellungen");
          return (
            <Link
              href="/einstellungen"
              className={clsx(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150",
                active ? "text-white shadow-lg" : "text-dash-muted hover:text-white hover:bg-white/5"
              )}
              style={active ? { backgroundColor: "var(--a-600)", boxShadow: "0 4px 12px rgb(var(--a-900-hex,30 27 75)/0.4)" } : {}}
            >
              <Settings size={15} />
              Einstellungen
            </Link>
          );
        })()}
        <p className="text-[10px] text-dash-muted/40 text-center pt-1">intervals.icu Dashboard</p>
      </div>
    </aside>
  );
}
