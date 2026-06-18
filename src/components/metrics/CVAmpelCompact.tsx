"use client";
import Link from "next/link";
import { clsx } from "clsx";
import { CVZone } from "@/lib/types";
import { ArrowRight } from "lucide-react";

interface Props {
  zone: CVZone;
  label: string;
  advice: string;
  hrvPct: number | null;
  cv: number | null;
  tsb: number | null;
}

const ZONE_CONFIG = {
  green:  { dot: "bg-emerald-500", text: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: "🟢" },
  yellow: { dot: "bg-yellow-400",  text: "text-yellow-400",  bg: "bg-yellow-400/10 border-yellow-500/20",  icon: "🟡" },
  orange: { dot: "bg-orange-500",  text: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20",  icon: "🟠" },
  red:    { dot: "bg-red-500",     text: "text-red-400",     bg: "bg-red-500/10 border-red-500/20",        icon: "🔴" },
};

export default function CVAmpelCompact({ zone, label, advice, hrvPct, cv, tsb }: Props) {
  const cfg = ZONE_CONFIG[zone];

  return (
    <Link href="/hrv">
      <div className={clsx("p-4 rounded-2xl border transition-all hover:opacity-90 cursor-pointer h-full flex flex-col", cfg.bg)}>
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={clsx("w-2.5 h-2.5 rounded-full", cfg.dot)} />
            <span className="text-[10px] text-dash-muted uppercase tracking-wider font-medium">Tagescheck-Verdikt</span>
          </div>
          <ArrowRight size={12} className="text-dash-muted" />
        </div>

        {/* Verdikt */}
        <p className={clsx("text-[15px] font-semibold leading-snug", cfg.text)}>
          {cfg.icon} {label}
        </p>
        <p className="text-[11px] text-dash-muted leading-snug mt-1">{advice}</p>

        {/* Kennzahlen */}
        <div className="flex gap-3 mt-auto pt-2 border-t border-white/5 text-[10px] text-dash-muted">
          {hrvPct != null && (
            <span>hrv_pct: <span className="text-white tabular-nums">{hrvPct.toFixed(0)} %</span></span>
          )}
          {cv != null && (
            <span>CV: <span className="text-white tabular-nums">{cv.toFixed(1)} %</span></span>
          )}
          {tsb != null && (
            <span>TSB: <span className="text-white tabular-nums">{tsb.toFixed(0)}</span></span>
          )}
        </div>
      </div>
    </Link>
  );
}
