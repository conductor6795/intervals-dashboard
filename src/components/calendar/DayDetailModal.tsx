"use client";
import { useEffect } from "react";
import { format, addDays, subDays, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { X, ChevronLeft, ChevronRight, CalendarDays, ExternalLink } from "lucide-react";
import { Activity, WellnessDay } from "@/lib/types";

const SPORT_COLORS: Record<string, string> = {
  Ride: "#f97316", VirtualRide: "#fb923c", Run: "#10b981",
  VirtualRun: "#34d399", Swim: "#3b82f6", Strength: "#8b5cf6",
  Workout: "#6366f1", Walk: "#a3e635", Hike: "#84cc16", Other: "#6b7280",
};

function sportColor(t: string) { return SPORT_COLORS[t] ?? SPORT_COLORS.Other; }

function fmtDuration(secs: number) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h${m > 0 ? " " + m + "m" : ""}` : `${m}m`;
}

function MetricTile({
  label, value, unit, color, sub,
}: { label: string; value: string | null; unit?: string; color?: string; sub?: string }) {
  return (
    <div className="bg-dash-bg rounded-xl p-2.5 border border-dash-border flex flex-col gap-0.5 min-w-0">
      <p className="text-[9px] text-dash-muted uppercase tracking-wider leading-none truncate">{label}</p>
      {value != null ? (
        <p className="text-base font-bold tabular-nums leading-tight mt-0.5 truncate" style={{ color: color ?? "#fff" }}>
          {value}
          {unit && <span className="text-[10px] text-dash-muted font-normal ml-0.5">{unit}</span>}
        </p>
      ) : (
        <p className="text-sm text-dash-muted mt-0.5">–</p>
      )}
      {sub && <p className="text-[9px] text-dash-muted leading-none">{sub}</p>}
    </div>
  );
}

function Dots({ value, color }: { value: number | null | undefined; color: string }) {
  if (value == null) return <span className="text-xs text-dash-muted">–</span>;
  return (
    <span className="flex gap-0.5 items-center">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: i <= value ? color : "#1e2d4a" }} />
      ))}
    </span>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  date: Date;
  activities: Activity[];
  wellness: WellnessDay | null;
  onDateChange: (d: Date) => void;
  onSelectActivity: (a: Activity) => void;
}

export default function DayDetailModal({ open, onClose, date, activities, wellness, onDateChange, onSelectActivity }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onDateChange(subDays(date, 1));
      if (e.key === "ArrowRight") onDateChange(addDays(date, 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, date, onDateChange]);

  if (!open) return null;

  const w = wellness;
  const tsb = w?.ctl != null && w?.atl != null ? w.ctl - w.atl : null;
  const sleepH = w?.sleepSecs != null ? Math.floor(w.sleepSecs / 3600) : null;
  const sleepM = w?.sleepSecs != null ? Math.floor((w.sleepSecs % 3600) / 60) : null;
  const sleepStr = sleepH != null ? `${sleepH}h${sleepM! > 0 ? " " + sleepM + "m" : ""}` : null;
  const tsbColor = tsb == null ? undefined : tsb > 5 ? "#34d399" : tsb < -20 ? "#f87171" : "#fb923c";
  const tsbSub = tsb == null ? undefined : tsb > 5 ? "frisch" : tsb < -20 ? "hoch belastet" : "normal";
  const hasSubjective = w && (w.mood != null || w.fatigue != null || w.stress != null || w.soreness != null || w.motivation != null);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-2xl max-h-[90vh] flex flex-col border border-dash-border rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: "#131929" }}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-dash-border px-3 py-2.5 flex items-center gap-2" style={{ backgroundColor: "#131929" }}>
          <button onClick={() => onDateChange(subDays(date, 1))} title="Vorheriger Tag (←)" className="p-1.5 rounded-lg hover:bg-white/5 text-dash-muted hover:text-white transition-colors">
            <ChevronLeft size={15} />
          </button>

          {/* Klickbares Datum – öffnet nativen Datepicker */}
          <div className="relative flex-1 flex items-center justify-center gap-1.5 cursor-pointer group" title="Zu einem Datum springen">
            <p className="text-sm font-semibold text-white group-hover:text-indigo-400 transition-colors select-none">
              {format(date, "EEEE, d. MMMM yyyy", { locale: de })}
            </p>
            <CalendarDays size={12} className="text-dash-muted group-hover:text-indigo-400 transition-colors shrink-0" />
            <input
              type="date"
              value={format(date, "yyyy-MM-dd")}
              onChange={(e) => {
                if (!e.target.value) return;
                const d = parseISO(e.target.value);
                if (!isNaN(d.getTime())) onDateChange(d);
              }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full"
              aria-label="Zu einem Datum springen"
            />
          </div>

          <button onClick={() => onDateChange(addDays(date, 1))} title="Nächster Tag (→)" className="p-1.5 rounded-lg hover:bg-white/5 text-dash-muted hover:text-white transition-colors">
            <ChevronRight size={15} />
          </button>
          <button onClick={onClose} aria-label="Schließen" className="p-1.5 rounded-lg text-dash-muted hover:text-white transition-colors ml-1">
            <X size={15} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-5">

          {/* ── Wellness ── */}
          <section>
            <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-2">Wellness</p>
            {!w ? (
              <p className="text-xs text-dash-muted">Keine Wellness-Daten für diesen Tag verfügbar</p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <MetricTile label="HRV" value={w.hrv != null ? w.hrv.toFixed(1) : w.hrv4t != null ? w.hrv4t.toFixed(1) : null} unit="ms" color="#f472b6" />
                  <MetricTile label="Ruhepuls" value={w.restingHR != null ? Math.round(w.restingHR).toString() : null} unit="bpm" color="#f87171" />
                  <MetricTile label="CTL · Fitness" value={w.ctl != null ? w.ctl.toFixed(1) : null} color="#60a5fa" />
                  <MetricTile label="ATL · Ermüdung" value={w.atl != null ? w.atl.toFixed(1) : null} color="#fb923c" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <MetricTile label="TSB · Form" value={tsb != null ? `${tsb > 0 ? "+" : ""}${tsb.toFixed(1)}` : null} color={tsbColor} sub={tsbSub} />
                  <MetricTile label="Schlafdauer" value={sleepStr} color="#818cf8" />
                  <MetricTile label="Schlaf-Score" value={w.sleepScore != null ? String(w.sleepScore) : null} unit="/100" color="#818cf8" />
                  {w.readiness != null ? (
                    <MetricTile label="Readiness" value={String(w.readiness)} unit="/100" color="#facc15" />
                  ) : w.spO2Average != null ? (
                    <MetricTile label="SpO₂" value={w.spO2Average.toFixed(1)} unit="%" color="#34d399" />
                  ) : w.weight != null ? (
                    <MetricTile label="Gewicht" value={w.weight.toFixed(1)} unit="kg" color="#a78bfa" />
                  ) : (
                    <MetricTile label="Ramp Rate" value={w.rampRate != null ? w.rampRate.toFixed(1) : null} color="#94a3b8" />
                  )}
                </div>
                {(w.spO2Average != null || w.weight != null || w.rampRate != null) && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {w.spO2Average != null && <MetricTile label="SpO₂" value={w.spO2Average.toFixed(1)} unit="%" color="#34d399" />}
                    {w.weight != null && <MetricTile label="Gewicht" value={w.weight.toFixed(1)} unit="kg" color="#a78bfa" />}
                    {w.rampRate != null && <MetricTile label="Ramp Rate" value={w.rampRate.toFixed(1)} color="#94a3b8" />}
                    {w.sleepQuality != null && <MetricTile label="Schlaf-Qual." value={String(w.sleepQuality)} unit="/5" color="#818cf8" />}
                  </div>
                )}
                {hasSubjective && (
                  <div className="bg-dash-bg rounded-xl p-3 border border-dash-border">
                    <p className="text-[9px] text-dash-muted uppercase tracking-wider mb-2.5">Befinden (subjektiv)</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
                      {w.mood != null && <div className="flex items-center justify-between gap-2"><span className="text-xs text-dash-muted">Stimmung</span><Dots value={w.mood} color="#a78bfa" /></div>}
                      {w.motivation != null && <div className="flex items-center justify-between gap-2"><span className="text-xs text-dash-muted">Motivation</span><Dots value={w.motivation} color="#34d399" /></div>}
                      {w.fatigue != null && <div className="flex items-center justify-between gap-2"><span className="text-xs text-dash-muted">Erschöpfung</span><Dots value={w.fatigue} color="#fb923c" /></div>}
                      {w.stress != null && <div className="flex items-center justify-between gap-2"><span className="text-xs text-dash-muted">Stress</span><Dots value={w.stress} color="#f87171" /></div>}
                      {w.soreness != null && <div className="flex items-center justify-between gap-2"><span className="text-xs text-dash-muted">Muskelkater</span><Dots value={w.soreness} color="#fb923c" /></div>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── Trainings ── */}
          {activities.length > 0 ? (
            <section>
              <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-2">
                Trainings ({activities.length})
              </p>
              <div className="space-y-2">
                {activities.map((a) => (
                  <div
                    key={a.id}
                    onClick={(e) => { e.stopPropagation(); onSelectActivity(a); }}
                    className="rounded-xl p-3 border border-dash-border bg-dash-bg hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-colors group cursor-pointer"
                    style={{ borderLeftColor: sportColor(a.type), borderLeftWidth: 3 }}
                  >
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-xs font-semibold text-white leading-snug group-hover:text-indigo-300 transition-colors">{a.name}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {a.race && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-medium">RENNEN</span>
                        )}
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                          style={{ backgroundColor: `${sportColor(a.type)}22`, color: sportColor(a.type) }}
                        >
                          {a.type}
                        </span>
                        <a
                          href={`https://intervals.icu/activities/${a.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-0.5 rounded text-dash-muted hover:text-indigo-400 transition-colors"
                          title="Auf intervals.icu öffnen"
                        >
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    </div>
                    {/* Metrics grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-[10px]">
                      {a.moving_time && (
                        <span className="text-dash-muted">Dauer: <span className="text-white">{fmtDuration(a.moving_time)}</span></span>
                      )}
                      {a.distance != null && a.distance > 0 && (
                        <span className="text-dash-muted">Distanz: <span className="text-white">{(a.distance / 1000).toFixed(1)} km</span></span>
                      )}
                      {a.total_elevation_gain != null && a.total_elevation_gain > 0 && (
                        <span className="text-dash-muted">Höhenmeter: <span className="text-white">{Math.round(a.total_elevation_gain)} m</span></span>
                      )}
                      {a.average_heartrate && (
                        <span className="text-dash-muted">HF Ø: <span className="text-white">{Math.round(a.average_heartrate)} bpm</span></span>
                      )}
                      {a.max_heartrate && (
                        <span className="text-dash-muted">HF max: <span className="text-white">{Math.round(a.max_heartrate)} bpm</span></span>
                      )}
                      {a.average_watts && (
                        <span className="text-dash-muted">Leistung Ø: <span className="text-white">{Math.round(a.average_watts)} W</span></span>
                      )}
                      {a.max_watts && (
                        <span className="text-dash-muted">Leistung max: <span className="text-white">{Math.round(a.max_watts)} W</span></span>
                      )}
                      {a.icu_training_load && (
                        <span className="text-dash-muted">TSS: <span className="text-white font-medium">{Math.round(a.icu_training_load)}</span></span>
                      )}
                      {a.icu_intensity && (
                        <span className="text-dash-muted">IF: <span className="text-white">{(a.icu_intensity / 100).toFixed(2)}</span></span>
                      )}
                    </div>
                    {a.description && (
                      <p className="text-[10px] text-dash-muted mt-2 leading-relaxed border-t border-dash-border pt-2 line-clamp-3">
                        {a.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <p className="text-xs text-dash-muted text-center py-2">Kein Training an diesem Tag</p>
          )}
        </div>
      </div>
    </div>
  );
}
