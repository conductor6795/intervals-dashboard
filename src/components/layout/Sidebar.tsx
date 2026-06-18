"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart2, Calendar, FlaskConical, Heart, Scale, Settings,
  TrendingUp, Zap, X, Activity, GitCompare, Dumbbell, CheckSquare,
} from "lucide-react";
import { clsx } from "clsx";
import { useState, useEffect } from "react";
import { getPageSettings } from "@/lib/settings";

type NavItem = { href: string; label: string; icon: typeof Zap; id?: string };

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Übersicht",
    items: [{ href: "/", label: "Übersicht", icon: Zap }],
  },
  {
    title: "Training & Leistung",
    items: [
      { href: "/fitness",     label: "Fitness-Trend",  icon: TrendingUp },
      { href: "/training",    label: "Training",       icon: Dumbbell, id: "training" },
      { href: "/performance", label: "Leistungsdaten", icon: Activity },
      { href: "/calendar",    label: "Kalender",       icon: Calendar },
    ],
  },
  {
    title: "Erholung",
    items: [
      { href: "/hrv",      label: "HRV & Erholung", icon: Heart },
      { href: "/wellness", label: "Wellness",       icon: BarChart2 },
      { href: "/habits",   label: "Habits",         icon: CheckSquare },
    ],
  },
  {
    title: "Analyse",
    items: [
      { href: "/compare", label: "Vergleich",      icon: GitCompare },
      { href: "/analyse", label: "Analyse",        icon: FlaskConical, id: "analyse" },
      { href: "/koerper", label: "Körper & Ziele", icon: Scale, id: "koerper" },
    ],
  },
];

interface Props {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = true, onClose }: Props) {
  const pathname = usePathname();

  const [pageSettings, setPageSettings] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.id).map((i) => [i.id as string, true])
    )
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

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const linkClass = (active: boolean) =>
    clsx(
      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150",
      active ? "text-white shadow-lg" : "text-dash-muted hover:text-white hover:bg-white/5"
    );
  const activeStyle = (active: boolean) =>
    active
      ? { backgroundColor: "var(--a-600)", boxShadow: "0 4px 12px rgb(var(--a-900-hex,30 27 75)/0.4)" }
      : {};

  return (
    <aside
      className={clsx(
        "fixed left-0 top-0 h-full w-52 bg-dash-card border-r border-dash-border flex flex-col z-20",
        "transition-transform duration-200 ease-in-out",
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
        <button onClick={onClose} className="lg:hidden text-dash-muted hover:text-white transition-colors p-1">
          <X size={18} />
        </button>
      </div>

      {/* Nav — gruppiert */}
      <nav className="flex-1 p-3 overflow-y-auto">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((i) => !i.id || pageSettings[i.id] !== false);
          if (items.length === 0) return null;
          return (
            <div key={group.title} className="mb-4 last:mb-0">
              <p className="px-3 mb-1 text-[10px] text-dash-muted/70 uppercase tracking-wider font-medium">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {items.map(({ href, label, icon: Icon }) => {
                  const active = isActive(href);
                  return (
                    <Link key={href} href={href} className={linkClass(active)} style={activeStyle(active)}>
                      <Icon size={15} />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-dash-border space-y-0.5">
        <Link
          href="/einstellungen"
          className={linkClass(pathname.startsWith("/einstellungen"))}
          style={activeStyle(pathname.startsWith("/einstellungen"))}
        >
          <Settings size={15} />
          Einstellungen
        </Link>
        <p className="text-[10px] text-dash-muted/40 text-center pt-1">intervals.icu Dashboard</p>
      </div>
    </aside>
  );
}
