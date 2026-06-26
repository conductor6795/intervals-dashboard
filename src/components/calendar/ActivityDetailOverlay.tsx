"use client";
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import {
  ArrowLeft, ExternalLink, Zap, TrendingUp,
} from "lucide-react";
import { Activity, ZoneTime } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DetailData extends Activity {
  average_stride_length?: number;
  avg_ground_contact_time?: number;
  avg_vertical_oscillation?: number;
  avg_vertical_ratio?: number;
  avg_lr_balance?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ATHLETE_ID = process.env.NEXT_PUBLIC_INTERVALS_ATHLETE_ID ?? "";

function fmtTime(secs?: number) {
  if (!secs) return "–";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtPace(secs?: number, dist?: number) {
  if (!secs || !dist || dist < 100) return null;
  const pps = secs / (dist / 1000);
  return `${Math.floor(pps / 60)}:${String(Math.round(pps % 60)).padStart(2, "0")} /km`;
}

function fmtSpeed(ms?: number) {
  if (!ms) return null;
  return `${(ms * 3.6).toFixed(1)} km/h`;
}

function sportEmoji(a: Activity): string {
  const t = a.type;
  if (t === "Ride")        return a.race ? "🏆" : a.commute ? "🚲" : "🚴";
  if (t === "VirtualRide") return "🖥️";
  if (t === "Run")         return a.race ? "🏆" : "👟";
  if (t === "VirtualRun")  return "🏃";
  if (t === "Swim")        return "🏊";
  if (t === "Strength")    return "🏋️";
  if (t === "Walk")        return "🚶";
  if (t === "Hike")        return "🥾";
  if (t === "Workout")     return "⚡";
  return "🏅";
}

// icu_intensity is 0–100 (IF × 100)
function classifyIntensity(a: Activity): string | null {
  if (a.race) return "Race";
  const i = a.icu_intensity;
  if (i == null) return null;
  if (i < 55)  return "Z1";
  if (i < 75)  return "Z2";
  if (i < 85)  return "Tempo";
  if (i < 95)  return "SST";
  if (i <= 105) return "Schwelle";
  return "VO2max";
}

// ── Zone bar ─────────────────────────────────────────────────────────────────

const ZONE_COLORS: Record<string, string> = {
  Z1: "#6b7280", Z2: "#3b82f6", Z3: "#22c55e",
  Z4: "#eab308", Z5: "#f97316", SS: "#a855f7", Z6: "#ef4444", Z7: "#dc2626",
};

function ZoneBar({ zones }: { zones: ZoneTime[] }) {
  const total = zones.reduce((s, z) => s + z.secs, 0);
  if (total === 0) return null;
  return (
    <div className="space-y-1.5">
      {zones.filter((z) => z.secs > 0).map((z) => {
        const pct = (z.secs / total) * 100;
        const mm = Math.floor(z.secs / 60);
        return (
          <div key={z.id} className="flex items-center gap-2">
            <span className="text-[10px] text-dash-muted w-6 shrink-0">{z.id}</span>
            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct.toFixed(1)}%`, backgroundColor: ZONE_COLORS[z.id] ?? "#6b7280" }} />
            </div>
            <span className="text-[10px] text-dash-muted w-14 text-right shrink-0">{mm}min ({pct.toFixed(0)}%)</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Stat tile ─────────────────────────────────────────────────────────────────

function Stat({ label, value, sub, color }: {
  label: string; value: React.ReactNode; sub?: string; color?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-dash-muted uppercase tracking-wider">{label}</span>
      <span className={`text-lg font-bold leading-tight ${color ?? "text-white"}`}>{value ?? "–"}</span>
      {sub && <span className="text-[10px] text-dash-muted">{sub}</span>}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  activity: Activity | null;
  onClose: () => void;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function ActivityDetailOverlay({ activity, onClose }: Props) {
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activity) { setDetail(null); return; }
    setDetail(null);
    setLoading(true);
    fetch(`/api/activities/${activity.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.start_date_local) setDetail(d); })
      .finally(() => setLoading(false));
  }, [activity?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  if (!activity) return null;

  const a        = (detail?.start_date_local ? detail : null) ?? activity;
  const date     = parseISO(a.start_date_local);
  const isRun    = a.type === "Run" || a.type === "VirtualRun";
  const isCycle  = a.type === "Ride" || a.type === "VirtualRide";
  const intensity = classifyIntensity(a);
  const isZ2     = intensity === "Z2";
  const np       = a.icu_weighted_avg_watts;
  const ap       = a.icu_average_watts ?? a.average_watts;
  const pace     = isRun  ? fmtPace(a.moving_time, a.distance) : null;
  const speed    = fmtSpeed(a.average_speed);
  const isLoading = loading && !detail;

  const intervalsUrl = `https://intervals.icu/athlete/${ATHLETE_ID}/activities/${a.id}`;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: "var(--color-dash-bg, #0f1117)" }}>

      {/* ── Header ── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-dash-border">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-dash-muted hover:text-white transition-colors text-sm"
        >
          <ArrowLeft size={16} /> Zurück
        </button>
        <a
          href={intervalsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10 transition-colors"
        >
          <ExternalLink size={12} /> Intervals.icu
        </a>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">

          {/* Title */}
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xl">{sportEmoji(a)}</span>
              <span className="text-[11px] text-dash-muted">
                {format(date, "EEEE, d. MMMM yyyy · HH:mm", { locale: de })}
              </span>
              {intensity && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                  {intensity}
                </span>
              )}
              {a.icu_ftp && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-dash-muted border border-dash-border">
                  FTP {a.icu_ftp} W
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-white">{a.name}</h1>
            {a.description && (
              <p className="mt-1.5 text-xs text-dash-muted leading-relaxed">{a.description}</p>
            )}
          </div>

          {/* Summary grid */}
          {isLoading ? (
            <div className="h-24 rounded-2xl border border-dash-border bg-white/[0.02] flex items-center justify-center">
              <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {a.distance ? (
                <div className="rounded-xl border border-dash-border bg-white/[0.02] px-4 py-3">
                  <Stat label="Distanz" color="text-cyan-400"
                    value={a.distance >= 1000 ? `${(a.distance / 1000).toFixed(2)} km` : `${Math.round(a.distance)} m`} />
                </div>
              ) : null}
              <div className="rounded-xl border border-dash-border bg-white/[0.02] px-4 py-3">
                <Stat label="Zeit" color="text-cyan-400" value={fmtTime(a.moving_time)} />
              </div>
              {a.average_heartrate ? (
                <div className="rounded-xl border border-dash-border bg-white/[0.02] px-4 py-3">
                  <Stat label="Avg HF" color="text-red-400"
                    value={`${Math.round(a.average_heartrate)} bpm`}
                    sub={a.max_heartrate ? `Max ${a.max_heartrate} bpm` : undefined} />
                </div>
              ) : null}
              {a.total_elevation_gain ? (
                <div className="rounded-xl border border-dash-border bg-white/[0.02] px-4 py-3">
                  <Stat label="Höhenmeter" color="text-emerald-400" value={`${Math.round(a.total_elevation_gain)} m`} />
                </div>
              ) : null}
              {pace && (
                <div className="rounded-xl border border-dash-border bg-white/[0.02] px-4 py-3">
                  <Stat label="Pace" color="text-orange-400" value={pace} />
                </div>
              )}
              {speed && (
                <div className="rounded-xl border border-dash-border bg-white/[0.02] px-4 py-3">
                  <Stat label="Ø Tempo" color="text-orange-400" value={speed}
                    sub={a.max_speed ? `Max ${fmtSpeed(a.max_speed)}` : undefined} />
                </div>
              )}
              {a.calories ? (
                <div className="rounded-xl border border-dash-border bg-white/[0.02] px-4 py-3">
                  <Stat label="Kalorien" color="text-yellow-400" value={`${a.calories} kcal`} />
                </div>
              ) : null}
              {a.carbs_used ? (
                <div className="rounded-xl border border-dash-border bg-white/[0.02] px-4 py-3">
                  <Stat label="Carbs" color="text-amber-400" value={`${a.carbs_used} g`} />
                </div>
              ) : null}
              {a.average_temp != null ? (
                <div className="rounded-xl border border-dash-border bg-white/[0.02] px-4 py-3">
                  <Stat label="Temperatur" value={`${a.average_temp.toFixed(1)} °C`} />
                </div>
              ) : null}
            </div>
          )}

          {/* Power & Performance */}
          {(ap || np || a.icu_training_load || a.icu_efficiency_factor) && (
            <div className="rounded-2xl border border-dash-border bg-white/[0.02] px-5 py-4">
              <h2 className="text-[10px] uppercase tracking-wider text-dash-muted mb-4">Leistung & Performance</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
                {ap ? (
                  <Stat label="Avg Power" color="text-yellow-400"
                    value={<span className="flex items-center gap-1"><Zap size={14} />{Math.round(ap)} W</span>} />
                ) : null}
                {np ? (
                  <Stat label="NP" color="text-orange-400"
                    value={<span className="flex items-center gap-1"><TrendingUp size={14} />{Math.round(np)} W</span>} />
                ) : null}
                {a.icu_intensity != null ? (
                  <Stat label="IF" value={`${(a.icu_intensity / 100).toFixed(2)}`}
                    sub={`${Math.round(a.icu_intensity)}% FTP`} />
                ) : null}
                {a.icu_variability_index != null ? (
                  <Stat label="VI" value={a.icu_variability_index.toFixed(2)} />
                ) : null}
                {a.icu_efficiency_factor != null ? (
                  <Stat label="EF" color="text-blue-400" value={a.icu_efficiency_factor.toFixed(2)}
                    sub="NP / Avg HF" />
                ) : null}
                {isZ2 && a.decoupling != null ? (
                  <Stat label="Decoupling" color={Math.abs(a.decoupling) < 5 ? "text-emerald-400" : "text-orange-400"}
                    value={`${a.decoupling.toFixed(1)} %`} />
                ) : null}
                {a.icu_training_load != null ? (
                  <Stat label="Load / TSS" value={Math.round(a.icu_training_load)}
                    sub={[
                      a.power_load != null ? `Pwr ${a.power_load}` : null,
                      a.hr_load != null ? `HR ${a.hr_load}` : null,
                    ].filter(Boolean).join(" · ") || undefined} />
                ) : null}
                {a.polarization_index != null ? (
                  <Stat label="Pol. Index" value={a.polarization_index.toFixed(2)} />
                ) : null}
                {a.average_cadence ? (
                  <Stat label={isRun ? "Kadenz" : "Trittfreq."} value={`${Math.round(a.average_cadence)} rpm`} />
                ) : null}
              </div>
            </div>
          )}

          {/* Zone distribution */}
          {a.icu_zone_times && a.icu_zone_times.length > 0 && (
            <div className="rounded-2xl border border-dash-border bg-white/[0.02] px-5 py-4">
              <h2 className="text-[10px] uppercase tracking-wider text-dash-muted mb-4">Leistungszonen</h2>
              <ZoneBar zones={a.icu_zone_times} />
            </div>
          )}

          {/* HR zones */}
          {a.icu_hr_zone_times && a.icu_hr_zone_times.some((s) => s > 0) && (
            <div className="rounded-2xl border border-dash-border bg-white/[0.02] px-5 py-4">
              <h2 className="text-[10px] uppercase tracking-wider text-dash-muted mb-4">HF-Zonen</h2>
              <ZoneBar zones={a.icu_hr_zone_times.map((secs, i) => ({ id: `Z${i + 1}`, secs }))} />
            </div>
          )}

          {/* Running dynamics */}
          {isRun && detail && (
            detail.average_stride_length || detail.avg_ground_contact_time || detail.avg_vertical_oscillation
          ) ? (
            <div className="rounded-2xl border border-dash-border bg-white/[0.02] px-5 py-4">
              <h2 className="text-[10px] uppercase tracking-wider text-dash-muted mb-4">Running Dynamics</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
                {detail.average_stride_length ? (
                  <Stat label="Schrittlänge" value={`${(detail.average_stride_length / 100).toFixed(2)} m`} />
                ) : null}
                {detail.avg_ground_contact_time ? (
                  <Stat label="Bodenkontakt" value={`${Math.round(detail.avg_ground_contact_time)} ms`} />
                ) : null}
                {detail.avg_vertical_oscillation ? (
                  <Stat label="Vert. Oszi." value={`${detail.avg_vertical_oscillation.toFixed(1)} cm`} />
                ) : null}
                {detail.avg_vertical_ratio ? (
                  <Stat label="Vert. Ratio" value={`${detail.avg_vertical_ratio.toFixed(1)} %`} />
                ) : null}
                {detail.avg_lr_balance ? (
                  <Stat label="L/R Balance" value={`${detail.avg_lr_balance.toFixed(1)} %`} />
                ) : null}
              </div>
            </div>
          ) : null}

        </div>
      </div>
    </div>
  );
}
