"use client";
import { clsx } from "clsx";
import { CVZone } from "@/lib/types";
import { HRV_PCT, HRV_CV } from "@/lib/athlete";

interface Props {
  zone: CVZone;
  label: string;
  advice: string;
  hrvPct: number | null;
  cv: number | null;
  tsb: number | null;
  hrv7: number | null;
  hrvFloorFlag?: boolean;
  hardTriggers?: string[];
}

const LADDER: { zone: CVZone; title: string; verdict: string; dot: string; activeBg: string; color: string }[] = [
  { zone: "green",  title: "Grün",   verdict: "Plan steht",          dot: "bg-emerald-500", activeBg: "bg-emerald-500", color: "text-emerald-400" },
  { zone: "yellow", title: "Gelb",   verdict: "Kein HIT – Z2 bleibt", dot: "bg-yellow-400",  activeBg: "bg-yellow-400",  color: "text-yellow-400" },
  { zone: "orange", title: "Orange", verdict: "Umfang reduzieren",   dot: "bg-orange-500",  activeBg: "bg-orange-500",  color: "text-orange-400" },
  { zone: "red",    title: "Rot",    verdict: "Erholung – Ersetzen",  dot: "bg-red-500",     activeBg: "bg-red-500",     color: "text-red-400" },
];

function hrvPctTag(p: number | null): string {
  if (p == null) return "–";
  const v = p.toFixed(0);
  if (p >= HRV_PCT.balanced) return `${v} % · ausbalanciert`;
  if (p >= HRV_PCT.neutral) return `${v} % · neutral`;
  if (p >= HRV_PCT.suppressed) return `${v} % · leicht gedrückt`;
  if (p >= HRV_PCT.critical) return `${v} % · strukturell niedrig`;
  return `${v} % · kritisch`;
}
function cvTag(cv: number | null): string {
  if (cv == null) return "–";
  const v = cv.toFixed(1);
  if (cv < HRV_CV.warn) return `${v} % · stabil`;
  if (cv <= HRV_CV.unstable) return `${v} % · Warnzone`;
  return `${v} % · instabil`;
}
function tsbTag(tsb: number | null): string {
  if (tsb == null) return "–";
  const v = tsb.toFixed(0);
  if (tsb > 0) return `${v} · frisch`;
  if (tsb >= -20) return `${v} · produktiv`;
  if (tsb >= -30) return `${v} · hoch belastet`;
  return `${v} · Überlastung`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-dash-muted">{label}</span>
      <span className="text-white font-medium tabular-nums">{value}</span>
    </div>
  );
}

export default function CVAmpel({ zone, label, advice, hrvPct, cv, tsb, hrv7, hrvFloorFlag = false, hardTriggers = [] }: Props) {
  const active = LADDER.find((z) => z.zone === zone);

  return (
    <div className="flex flex-col p-5 rounded-xl border border-dash-border bg-dash-card h-full">
      <span className="text-xs text-dash-muted uppercase tracking-wider mb-1">Tagescheck-Verdikt</span>
      <span className="text-[10px] text-dash-muted mb-4">hrv_pct (Veto) · CV · TSB — HRV korrigiert nur nach unten</span>

      {/* Verdikt-Leiter */}
      <div className="flex flex-col gap-1.5 mb-4">
        {LADDER.map((z) => (
          <div
            key={z.zone}
            className={clsx(
              "rounded-lg px-3 py-2 flex items-center gap-2.5 border transition-all",
              zone === z.zone
                ? `${z.activeBg} border-transparent text-white`
                : "border-dash-border bg-dash-bg text-dash-muted"
            )}
          >
            <div className={clsx("w-2 h-2 rounded-full flex-shrink-0", z.dot)} />
            <span className="text-[10px] font-semibold uppercase w-12 flex-shrink-0">{z.title}</span>
            <span className={clsx("text-[11px] leading-tight", zone === z.zone ? "text-white/85" : "")}>{z.verdict}</span>
          </div>
        ))}
      </div>

      {/* Treibende Signale */}
      <div className="mt-1 pt-3 border-t border-dash-border space-y-1">
        <Row label="hrv_pct (28-Tage-Perzentil)" value={hrvPctTag(hrvPct)} />
        <Row label="CV (7 Tage)" value={cvTag(cv)} />
        <Row label="TSB (Form)" value={tsbTag(tsb)} />
        <Row label="HRV7 (Ø 7 Tage)" value={hrv7 != null ? hrv7.toFixed(1) : "–"} />
      </div>

      {/* Verdikt + Hinweis */}
      <div className={clsx("mt-3 p-2.5 rounded-lg text-[11px] leading-snug", active ? `${active.activeBg}/15` : "bg-dash-bg")}>
        <p className={clsx("font-semibold mb-0.5", active?.color)}>{label}</p>
        <p className="text-dash-muted">{advice}</p>
      </div>

      {/* Aktive Hard-Trigger (Sofort-Deload) */}
      {hardTriggers.length > 0 && (
        <div className="mt-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400 mb-1">Hard-Trigger aktiv</p>
          <ul className="space-y-0.5">
            {hardTriggers.map((t) => (
              <li key={t} className="text-[11px] text-red-300/90 tabular-nums">• {t}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Absolut-Trend-Floor (Drift-Banner, kein Sofort-Deload) */}
      {hrvFloorFlag && (
        <div className="mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <p className="text-[11px] text-amber-300/90 leading-snug">
            <span className="font-semibold">Absolut-Drift:</span> hrv7 &gt; 12 % unter 60-Tage-Mittel.
            Kein Sofort-Deload — 2 Wochenchecks in Folge mit Flag → Deload-Prüfung.
          </p>
        </div>
      )}
    </div>
  );
}
