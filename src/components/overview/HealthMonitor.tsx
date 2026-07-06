"use client";
import { clsx } from "clsx";
import { ShieldCheck, ShieldAlert, ShieldQuestion, Activity as ActivityIcon } from "lucide-react";
import { HealthMonitorResult, HealthFlagLevel, HealthFlag } from "@/lib/healthMonitor";
import { GarminDay } from "@/hooks/useGarmin";

const LEVEL_DOT: Record<HealthFlagLevel, string> = {
  normal: "bg-emerald-400 border-emerald-200/40",
  attention: "bg-yellow-400 border-yellow-200/40",
  alert: "bg-red-500 border-red-200/40",
};
const LEVEL_TEXT: Record<HealthFlagLevel, string> = {
  normal: "text-emerald-400",
  attention: "text-yellow-400",
  alert: "text-red-400",
};

function OverallBadge({ overall, hasEnoughData }: { overall: HealthFlagLevel; hasEnoughData: boolean }) {
  if (!hasEnoughData) {
    return (
      <span className="flex items-center gap-1.5 text-[11px] text-dash-muted">
        <ShieldQuestion size={13} /> Zu wenig Daten
      </span>
    );
  }
  if (overall === "normal") {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
        <ShieldCheck size={13} /> Alles normal
      </span>
    );
  }
  const label = overall === "alert" ? "Auffällig" : "Beobachten";
  return (
    <span className={clsx("flex items-center gap-1.5 text-[11px] font-medium", LEVEL_TEXT[overall])}>
      <ShieldAlert size={13} /> {label}
    </span>
  );
}

/** Vertikale Leiste: Punkt sitzt je nach Position (0=unten/niedrig, 1=oben/hoch). */
function VerticalGauge({ flag }: { flag: HealthFlag }) {
  const topPct = (1 - flag.position) * 100; // 0 → oben (hoch)
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[8px] text-dash-muted/60 uppercase">Hoch</span>
      <div className="relative w-1.5 h-16 rounded-full bg-gradient-to-t from-sky-500/30 via-emerald-500/25 to-orange-500/30">
        {/* Normalband-Markierung (mittleres Drittel) */}
        <div className="absolute left-1/2 -translate-x-1/2 w-3 border-t border-b border-white/15" style={{ top: "40%", bottom: "40%" }} />
        <div
          className={clsx("absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border shadow", LEVEL_DOT[flag.level])}
          style={{ top: `${topPct}%` }}
        />
      </div>
      <span className="text-[8px] text-dash-muted/60 uppercase">Niedrig</span>
    </div>
  );
}

function stressZonePct(day: GarminDay | undefined) {
  if (!day) return null;
  const rest = day.stressRestSecs ?? 0;
  const low = day.stressLowSecs ?? 0;
  const med = day.stressMediumSecs ?? 0;
  const high = day.stressHighSecs ?? 0;
  const total = rest + low + med + high;
  if (total === 0) return null;
  return [
    { label: "Ruhe", secs: rest, color: "#334155" },
    { label: "Niedrig", secs: low, color: "#34d399" },
    { label: "Mittel", secs: med, color: "#facc15" },
    { label: "Hoch", secs: high, color: "#fb923c" },
  ].map((z) => ({ ...z, pct: (z.secs / total) * 100 }));
}

export default function HealthMonitor({
  result,
  garminToday,
}: {
  result: HealthMonitorResult;
  garminToday: GarminDay | undefined;
}) {
  const zones = stressZonePct(garminToday);

  return (
    <div className="bg-dash-card border border-dash-border rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium">Gesundheitsmonitor</p>
        <OverallBadge overall={result.overall} hasEnoughData={result.hasEnoughData} />
      </div>

      {!result.hasEnoughData ? (
        <p className="text-xs text-dash-muted">
          Noch keine 28-Tage-Baseline vorhanden (Ruhepuls, Atemfrequenz, Stress, SpO2). Läuft mit mehr Garmin-Sync-Historie an.
        </p>
      ) : result.flags.length === 0 ? (
        <p className="text-xs text-dash-muted">Keine vergleichbaren Werte für heute.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          {result.flags.map((f) => (
            <div key={f.key} className="flex items-center gap-3">
              <VerticalGauge flag={f} />
              <div className="min-w-0">
                <p className="text-[11px] text-white font-medium leading-tight">{f.label}</p>
                <p className="text-sm text-white font-bold tabular-nums leading-tight">{f.valueText}</p>
                <p className={clsx("text-[10px] font-semibold", LEVEL_TEXT[f.level])}>{f.status}</p>
                <p className="text-[9px] text-dash-muted">{f.baselineText}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stress heute */}
      <div className="pt-3 border-t border-dash-border">
        <div className="flex items-center gap-1.5 mb-2">
          <ActivityIcon size={11} className="text-dash-muted" />
          <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium">Stress heute</p>
          {garminToday?.stressAvg != null && (
            <span className="text-[10px] text-white font-semibold tabular-nums ml-auto">
              Ø {garminToday.stressAvg}{garminToday.stressMax != null && ` · max ${garminToday.stressMax}`}
            </span>
          )}
        </div>
        {zones ? (
          <>
            <div className="flex w-full h-2.5 rounded-full overflow-hidden mb-2">
              {zones.map((z) => z.pct > 0 && (
                <div key={z.label} style={{ width: `${z.pct}%`, backgroundColor: z.color }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {zones.map((z) => (
                <span key={z.label} className="flex items-center gap-1 text-[10px] text-dash-muted">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: z.color }} />
                  {z.label} {Math.round(z.pct)}%
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="text-[11px] text-dash-muted">Keine Stress-Zonenverteilung für heute verfügbar.</p>
        )}
      </div>
    </div>
  );
}
