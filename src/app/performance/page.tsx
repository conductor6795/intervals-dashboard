"use client";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Zap, Heart, Activity } from "lucide-react";
import { clsx } from "clsx";
import { useAthlete } from "@/hooks/useAthlete";
import { useWellness } from "@/hooks/useWellness";
import { calcAllMetrics } from "@/lib/calculations";
import { AthleteData } from "@/lib/types";

function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-2xl bg-dash-card border border-dash-border", className)} />;
}

function StatCard({ label, value, unit, sub, color = "text-white", icon }: {
  label: string; value: string | number | null; unit?: string;
  sub?: string; color?: string; icon?: React.ReactNode;
}) {
  return (
    <div className="bg-dash-card border border-dash-border rounded-2xl p-4 flex flex-col justify-between h-[110px]">
      <div className="flex items-center gap-1.5 text-[10px] text-dash-muted uppercase tracking-wider font-medium">
        {icon}{label}
      </div>
      <div className="flex items-end gap-1.5">
        <span className={clsx("text-2xl font-bold tabular-nums leading-none", color)}>{value ?? "–"}</span>
        {unit && <span className="text-dash-muted text-xs pb-0.5">{unit}</span>}
      </div>
      <p className="text-[10px] text-dash-muted min-h-[14px]">{sub ?? ""}</p>
    </div>
  );
}

/** Extrahiert Werte aus dem Athleten-Objekt, unabhängig von Feldnamen */
function extractAthleteValues(a: AthleteData | null) {
  if (!a) return { ftp: null, lthr: null, maxHR: null, restingHR: null, vo2max: null, weight: null };
  const num = (keys: string[]): number | null => {
    for (const k of keys) {
      const v = a[k];
      if (typeof v === "number" && v > 0) return v;
    }
    return null;
  };
  return {
    ftp:      num(["ftp", "threshold_power", "thresholdPower"]),
    lthr:     num(["lt_hr", "lthr", "ltHr", "lt_heart_rate"]),
    maxHR:    num(["max_hr", "maxHr", "max_heart_rate"]),
    restingHR:num(["rest_hr", "resting_hr", "restingHr", "resting_heart_rate"]),
    vo2max:   num(["vo2max", "vo2Max", "vo_2_max"]),
    weight:   num(["weight"]),
  };
}

/** Coggan Power Zones (7 Zonen) */
function powerZones(ftp: number) {
  return [
    { zone: "Z1", name: "Aktive Erholung",        range: [0,           ftp * 0.55], color: "#64748b" },
    { zone: "Z2", name: "Grundlagenausdauer",      range: [ftp * 0.55,  ftp * 0.75], color: "#22c55e" },
    { zone: "Z3", name: "Tempo",                   range: [ftp * 0.75,  ftp * 0.90], color: "#84cc16" },
    { zone: "Z4", name: "Schwelle (FTP)",           range: [ftp * 0.90,  ftp * 1.05], color: "#eab308" },
    { zone: "Z5", name: "VO2max",                  range: [ftp * 1.05,  ftp * 1.20], color: "#f97316" },
    { zone: "Z6", name: "Anaerobe Kapazität",      range: [ftp * 1.20,  ftp * 1.50], color: "#ef4444" },
    { zone: "Z7", name: "Neuromuskulär",           range: [ftp * 1.50,  Infinity],   color: "#a855f7" },
  ];
}

/** Coggan HR Zones */
function hrZones(lthr: number) {
  return [
    { zone: "Z1",  name: "Aktive Erholung",  range: [0,          lthr * 0.81], color: "#64748b" },
    { zone: "Z2",  name: "Aerob/GA",         range: [lthr * 0.81, lthr * 0.89], color: "#22c55e" },
    { zone: "Z3",  name: "Tempo",            range: [lthr * 0.89, lthr * 0.93], color: "#84cc16" },
    { zone: "Z4",  name: "Schwelle",         range: [lthr * 0.93, lthr * 1.00], color: "#eab308" },
    { zone: "Z5a", name: "Aerob-Anaerob",    range: [lthr * 1.00, lthr * 1.03], color: "#f97316" },
    { zone: "Z5b", name: "Anaerob",          range: [lthr * 1.03, lthr * 1.06], color: "#ef4444" },
    { zone: "Z5c", name: "Max",              range: [lthr * 1.06, Infinity],    color: "#a855f7" },
  ];
}

function ZoneRow({ zone, name, range, color, i }: { zone: string; name: string; range: [number,number]; color: string; i: number }) {
  return (
    <div className={clsx("flex items-center gap-4 px-5 py-3", i > 0 && "border-t border-dash-border")}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold shrink-0"
        style={{ backgroundColor: `${color}20`, color }}>
        {zone}
      </div>
      <p className="text-xs font-medium text-white flex-1">{name}</p>
      <p className="text-xs text-dash-muted tabular-nums shrink-0">
        {range[1] === Infinity
          ? `> ${Math.round(range[0])}`
          : `${Math.round(range[0])} – ${Math.round(range[1])}`}
      </p>
      <div className="hidden sm:block w-20 h-1.5 rounded-full bg-dash-border overflow-hidden shrink-0">
        <div className="h-full rounded-full" style={{ backgroundColor: color, width: "100%" }} />
      </div>
    </div>
  );
}

export default function PerformancePage() {
  const { data: rawAthlete, loading: aLoading, error: aError } = useAthlete();
  const { data: wellness, loading: wLoading } = useWellness(14);
  const metrics = useMemo(() => calcAllMetrics(wellness), [wellness]);
  const today = wellness[wellness.length - 1];
  const [showDebug, setShowDebug] = useState(false);

  const loading = aLoading || wLoading;
  const athlete = rawAthlete as AthleteData | null;
  const { ftp, lthr, maxHR, restingHR, vo2max, weight } = extractAthleteValues(athlete);

  const estimatedVO2max = !vo2max && ftp && weight
    ? parseFloat(((ftp / weight) * 10.8 + 7).toFixed(1))
    : null;
  const displayVO2max = vo2max ?? estimatedVO2max;
  const vo2maxIsEstimated = !vo2max && estimatedVO2max != null;

  const hasAnyData = ftp || lthr || maxHR || vo2max;

  return (
    <>
      <header className="sticky top-0 z-10 bg-dash-bg/95 backdrop-blur border-b border-dash-border px-6 py-3 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-white">Leistungsdaten</h1>
        {aError && <span className="text-xs text-red-400">{aError}</span>}
      </header>

      <div className="p-6 space-y-6 max-w-[1200px]">

        {/* Kern-Leistungswerte */}
        <section>
          <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-4">Leistungsparameter</p>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[0,1,2,3].map(i => <Skeleton key={i} className="h-28" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="FTP" value={ftp} unit="W" icon={<Zap size={10} />} color="text-yellow-400"
                sub={ftp && weight ? `${(ftp / weight).toFixed(2)} W/kg` : ""} />
              <StatCard label={vo2maxIsEstimated ? "VO2max *" : "VO2max"} value={displayVO2max?.toFixed(1) ?? null}
                unit="mL/min/kg" icon={<Activity size={10} />} color="text-blue-400"
                sub={vo2maxIsEstimated ? "* Schätzung aus FTP" : "Gerät-Messung"} />
              <StatCard label="LTHR" value={lthr} unit="bpm" icon={<Heart size={10} />} color="text-red-400"
                sub={maxHR ? `Max HR: ${maxHR} bpm` : ""} />
              <StatCard label="Gewicht" value={weight?.toFixed(1) ?? null} unit="kg" color="text-purple-400"
                sub={ftp && weight ? `W/kg: ${(ftp / weight).toFixed(2)}` : ""} />
            </div>
          )}
        </section>

        {/* Aktuelle Form */}
        <section>
          <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-4">Aktuelle Form</p>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[0,1,2].map(i => <Skeleton key={i} className="h-28" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard label="CTL (Fitness)" value={today?.ctl?.toFixed(1) ?? null} color="text-blue-400"
                sub="42-Tage-EMA" />
              <StatCard
                label="TSB (Form)"
                value={today?.ctl != null && today?.atl != null ? (today.ctl - today.atl).toFixed(1) : null}
                color={(today?.ctl ?? 0) - (today?.atl ?? 0) >= 0 ? "text-emerald-400" : "text-orange-400"}
                sub={(today?.ctl ?? 0) - (today?.atl ?? 0) >= 5 ? "Frisch" : (today?.ctl ?? 0) - (today?.atl ?? 0) >= 0 ? "Neutral" : "Ermüdet"}
              />
              <StatCard label="Trainingsbereitschaft" value={metrics.trainingReadiness} unit="/100"
                color={metrics.trainingReadiness >= 75 ? "text-emerald-400" : metrics.trainingReadiness >= 50 ? "text-yellow-400" : "text-red-400"} />
            </div>
          )}
        </section>

        {/* Power Zones */}
        {!loading && ftp != null && (
          <section>
            <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-4">Wattzonen – FTP: {ftp} W</p>
            <div className="bg-dash-card border border-dash-border rounded-2xl overflow-hidden">
              {powerZones(ftp).map((z, i) => (
                <ZoneRow key={z.zone} zone={z.zone} name={z.name}
                  range={z.range as [number,number]} color={z.color} i={i} />
              ))}
            </div>
          </section>
        )}

        {/* HR Zones */}
        {!loading && lthr != null && (
          <section>
            <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-4">HF-Zonen – LTHR: {lthr} bpm</p>
            <div className="bg-dash-card border border-dash-border rounded-2xl overflow-hidden">
              {hrZones(lthr).map((z, i) => (
                <ZoneRow key={z.zone} zone={z.zone} name={z.name}
                  range={z.range as [number,number]} color={z.color} i={i} />
              ))}
            </div>
          </section>
        )}

        {/* Hinweis + Debug */}
        {!loading && (
          <section>
            {!hasAnyData && (
              <div className="p-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/5 text-xs text-dash-muted mb-4">
                <p className="text-yellow-400 font-medium mb-1">Keine Leistungsparameter gefunden</p>
                <p>Setze FTP und LTHR in intervals.icu → Einstellungen → Athletenprofil. VO2max wird von Garmin/Wahoo synchronisiert.</p>
              </div>
            )}
            {rawAthlete && (
              <button onClick={() => setShowDebug(v => !v)}
                className="flex items-center gap-2 text-[11px] text-dash-muted hover:text-white transition-colors">
                {showDebug ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                API-Rohdaten anzeigen (Debug)
              </button>
            )}
            {showDebug && rawAthlete && (
              <pre className="mt-3 p-4 rounded-2xl bg-dash-card border border-dash-border text-[10px] text-dash-muted overflow-auto max-h-64">
                {JSON.stringify(rawAthlete, null, 2)}
              </pre>
            )}
          </section>
        )}
      </div>
    </>
  );
}
