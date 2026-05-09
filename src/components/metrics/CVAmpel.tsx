"use client";
import { clsx } from "clsx";
import { CVZone } from "@/lib/types";

interface Props {
  zone: CVZone;
  label: string;
  advice: string;
  trendRatio: number | null;
  cv: number | null;
  hrv7: number | null;
}

const ZONES: { zone: CVZone; aboveAvg: boolean; lowCV: boolean; title: string; color: string; activeBg: string; dot: string }[] = [
  {
    zone: "green",
    aboveAvg: true,
    lowCV: true,
    title: "Grün",
    color: "text-emerald-400",
    activeBg: "bg-emerald-500",
    dot: "bg-emerald-500",
  },
  {
    zone: "yellow",
    aboveAvg: true,
    lowCV: false,
    title: "Gelb",
    color: "text-yellow-400",
    activeBg: "bg-yellow-400",
    dot: "bg-yellow-400",
  },
  {
    zone: "orange",
    aboveAvg: false,
    lowCV: true,
    title: "Orange",
    color: "text-orange-400",
    activeBg: "bg-orange-500",
    dot: "bg-orange-500",
  },
  {
    zone: "red",
    aboveAvg: false,
    lowCV: false,
    title: "Rot",
    color: "text-red-400",
    activeBg: "bg-red-500",
    dot: "bg-red-500",
  },
];

const ZONE_LABELS: Record<CVZone, string> = {
  green: "Hart trainieren",
  yellow: "Moderat trainieren",
  orange: "Leicht trainieren",
  red: "Ruhetag",
};

export default function CVAmpel({ zone, label, advice, trendRatio, cv, hrv7 }: Props) {
  const activeZone = ZONES.find((z) => z.zone === zone);

  return (
    <div className="flex flex-col p-5 rounded-xl border border-dash-border bg-dash-card h-full">
      <span className="text-xs text-dash-muted uppercase tracking-wider mb-4">CV-Ampel</span>

      {/* 2×2 Grid */}
      <div className="grid grid-cols-2 gap-1.5 mb-4">
        {/* Zeile 1: HRV über Durchschnitt */}
        {ZONES.filter((z) => z.aboveAvg).map((z) => (
          <div
            key={z.zone}
            className={clsx(
              "rounded-lg p-2.5 flex flex-col gap-1 border transition-all",
              zone === z.zone
                ? `${z.activeBg} border-transparent text-white`
                : "border-dash-border bg-dash-bg text-dash-muted"
            )}
          >
            <div className="flex items-center gap-1.5">
              <div className={clsx("w-2 h-2 rounded-full", z.dot)} />
              <span className="text-[10px] font-semibold uppercase">{z.title}</span>
            </div>
            <span className={clsx("text-[9px] leading-tight", zone === z.zone ? "text-white/80" : "")}>
              {ZONE_LABELS[z.zone]}
            </span>
          </div>
        ))}
        {/* Zeile 2: HRV unter Durchschnitt */}
        {ZONES.filter((z) => !z.aboveAvg).map((z) => (
          <div
            key={z.zone}
            className={clsx(
              "rounded-lg p-2.5 flex flex-col gap-1 border transition-all",
              zone === z.zone
                ? `${z.activeBg} border-transparent text-white`
                : "border-dash-border bg-dash-bg text-dash-muted"
            )}
          >
            <div className="flex items-center gap-1.5">
              <div className={clsx("w-2 h-2 rounded-full", z.dot)} />
              <span className="text-[10px] font-semibold uppercase">{z.title}</span>
            </div>
            <span className={clsx("text-[9px] leading-tight", zone === z.zone ? "text-white/80" : "")}>
              {ZONE_LABELS[z.zone]}
            </span>
          </div>
        ))}
      </div>

      {/* Achsenbeschriftungen */}
      <div className="flex justify-between text-[9px] text-dash-muted mb-1 px-0.5">
        <span>↑ HRV über Ø (Zeile 1)</span>
        <span>CV &lt; 6,5 % | CV ≥ 6,5 %</span>
      </div>

      {/* Aktuelle Werte */}
      <div className="mt-3 pt-3 border-t border-dash-border space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-dash-muted">HRV7 (Ø 7 Tage)</span>
          <span className="text-white font-medium tabular-nums">{hrv7 != null ? hrv7.toFixed(1) : "–"}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-dash-muted">CV</span>
          <span className="text-white font-medium tabular-nums">{cv != null ? `${cv.toFixed(1)} %` : "–"}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-dash-muted">Trend-Ratio</span>
          <span className="text-white font-medium tabular-nums">{trendRatio != null ? `${trendRatio.toFixed(1)} %` : "–"}</span>
        </div>
      </div>

      {/* Empfehlung */}
      <div className={clsx("mt-3 p-2.5 rounded-lg text-[11px] leading-snug", activeZone ? `${activeZone.activeBg}/15` : "bg-dash-bg")}>
        <p className={clsx("font-semibold mb-0.5", activeZone?.color)}>{label}</p>
        <p className="text-dash-muted">{advice}</p>
      </div>
    </div>
  );
}
