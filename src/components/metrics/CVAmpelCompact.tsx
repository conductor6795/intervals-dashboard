"use client";
import Link from "next/link";
import { clsx } from "clsx";
import { CVZone } from "@/lib/types";
import { ArrowRight } from "lucide-react";
import { getTrainingRecommendation } from "@/lib/trainingRecommendation";

interface Props {
  zone: CVZone;
  label: string;
  advice: string;
  trendRatio: number | null;
  cv: number | null;
  tsb: number | null;
  readiness: number | null;
  ctl: number | null;
  weeklyHours: number | null;
}

const ZONE_CONFIG = {
  green:  { dot: "bg-emerald-500", text: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  yellow: { dot: "bg-yellow-400",  text: "text-yellow-400",  bg: "bg-yellow-400/10 border-yellow-500/20" },
  orange: { dot: "bg-orange-500",  text: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20" },
  red:    { dot: "bg-red-500",     text: "text-red-400",     bg: "bg-red-500/10 border-red-500/20" },
};

const ZONE_TO_QUADRANT: Record<CVZone, string> = {
  green:  "hoch-steigend",
  yellow: "hoch-fallend",
  orange: "tief-steigend",
  red:    "tief-fallend",
};

export default function CVAmpelCompact({
  zone, label, trendRatio, cv,
  tsb, readiness, ctl, weeklyHours,
}: Props) {
  const cfg = ZONE_CONFIG[zone];
  const rec = getTrainingRecommendation(
    ZONE_TO_QUADRANT[zone],
    tsb,
    readiness,
    ctl,
    weeklyHours,
  );

  return (
    <Link href="/hrv">
      <div className={clsx("p-4 rounded-2xl border transition-all hover:opacity-90 cursor-pointer h-full flex flex-col", cfg.bg)}>
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={clsx("w-2.5 h-2.5 rounded-full", cfg.dot)} />
            <span className="text-[10px] text-dash-muted uppercase tracking-wider font-medium">CV-Ampel</span>
          </div>
          <ArrowRight size={12} className="text-dash-muted" />
        </div>

        {/* Zone-Label */}
        <p className={clsx("text-sm font-semibold mb-2", cfg.text)}>{label}</p>

        {/* Trainingsempfehlung */}
        <p className="text-[13px] font-semibold text-white leading-snug">{rec.icon} {rec.short}</p>
        <p className="text-[11px] text-dash-muted leading-snug mt-0.5">{rec.detail}</p>
        {rec.duration && (
          <p className="text-[11px] text-dash-muted mt-0.5">⏱ {rec.duration}</p>
        )}

        {/* Kennzahlen */}
        <div className="flex gap-3 mt-auto pt-2 border-t border-white/5 text-[10px] text-dash-muted">
          {trendRatio != null && (
            <span>Trend: <span className="text-white tabular-nums">{trendRatio.toFixed(0)} %</span></span>
          )}
          {cv != null && (
            <span>CV: <span className="text-white tabular-nums">{cv.toFixed(1)} %</span></span>
          )}
        </div>
      </div>
    </Link>
  );
}
