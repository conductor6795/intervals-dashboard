"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { de } from "date-fns/locale";
import { X, Search, Timer, Zap, Heart, Activity as ActivityIcon, TrendingUp } from "lucide-react";
import { clsx } from "clsx";
import { Activity } from "@/lib/types";

// ── Sport emojis ─────────────────────────────────────────────────────────────

function sportEmoji(a: Activity): string {
  const t = a.type;
  if (t === "Ride") {
    if (a.race)    return "🏆";
    if (a.commute) return "🚲";
    return "🚴";
  }
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

// ── Intensity classification ──────────────────────────────────────────────────

type IntensityKey = "z1" | "z2" | "tempo" | "sst" | "threshold" | "vo2max" | "race";

const INTENSITY_LABELS: Record<IntensityKey, string> = {
  z1: "Z1", z2: "Z2", tempo: "Tempo", sst: "SST", threshold: "Schwelle", vo2max: "VO2max", race: "Race",
};

function classifyIntensity(a: Activity): IntensityKey | null {
  if (a.race) return "race";
  const if_ = a.icu_intensity;
  if (if_ == null) return null;
  if (if_ < 0.55) return "z1";
  if (if_ < 0.75) return "z2";
  if (if_ < 0.85) return "tempo";
  if (if_ < 0.95) return "sst";
  if (if_ <= 1.05) return "threshold";
  return "vo2max";
}

// ── Duration helpers ──────────────────────────────────────────────────────────

type DurationBucket = "lt30" | "30to60" | "60to120" | "gt120";
const DURATION_LABELS: Record<DurationBucket, string> = {
  lt30: "< 30 min", "30to60": "30–60 min", "60to120": "1–2 h", gt120: "> 2 h",
};

function durationBucket(secs?: number): DurationBucket | null {
  if (secs == null) return null;
  const m = secs / 60;
  if (m < 30) return "lt30";
  if (m < 60) return "30to60";
  if (m < 120) return "60to120";
  return "gt120";
}

function fmtDuration(secs?: number): string {
  if (!secs) return "–";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m}min`;
}

function fmtDistance(m?: number): string {
  if (!m) return "";
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function npValue(a: Activity): number | null {
  return a.icu_weighted_average_watts ?? a.weighted_average_watts ?? a.norm_power ?? null;
}

// ── Chip ─────────────────────────────────────────────────────────────────────

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "shrink-0 px-3 py-1 rounded-full text-xs border transition-colors whitespace-nowrap",
        active
          ? "bg-indigo-600/30 text-indigo-300 border-indigo-500/60"
          : "bg-white/5 text-dash-muted border-dash-border hover:border-indigo-500/40 hover:text-white"
      )}
    >
      {label}
    </button>
  );
}

// ── MetricPill ────────────────────────────────────────────────────────────────

function MetricPill({ icon, value, label }: { icon: React.ReactNode; value: string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-dash-muted">
      {icon}
      <span className="text-white/80">{value}</span>
      {label && <span className="text-[10px]">{label}</span>}
    </span>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  activities: Activity[];
  onClose: () => void;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function ActivityListOverlay({ open, activities, onClose }: Props) {
  const [query, setQuery]                   = useState("");
  const [sportFilter, setSportFilter]       = useState<string | null>(null);
  const [intensityFilter, setIntensityFilter] = useState<IntensityKey | null>(null);
  const [durationFilter, setDurationFilter] = useState<DurationBucket | null>(null);
  const [dateFrom, setDateFrom]             = useState("");
  const [dateTo, setDateTo]                 = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const sportTypes = useMemo(() => {
    const s = new Set(activities.map((a) => a.type));
    return Array.from(s).sort();
  }, [activities]);

  const sorted = useMemo(
    () => [...activities].sort((a, b) => b.start_date_local.localeCompare(a.start_date_local)),
    [activities]
  );

  const filtered = useMemo(() => {
    let list = sorted;

    if (dateFrom) {
      const from = startOfDay(parseISO(dateFrom));
      list = list.filter((a) => parseISO(a.start_date_local) >= from);
    }
    if (dateTo) {
      const to = endOfDay(parseISO(dateTo));
      list = list.filter((a) => parseISO(a.start_date_local) <= to);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q));
    }
    if (sportFilter)     list = list.filter((a) => a.type === sportFilter);
    if (intensityFilter) list = list.filter((a) => classifyIntensity(a) === intensityFilter);
    if (durationFilter)  list = list.filter((a) => durationBucket(a.moving_time) === durationFilter);

    return list;
  }, [sorted, query, sportFilter, intensityFilter, durationFilter, dateFrom, dateTo]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--color-dash-bg, #0f1117)" }}>

      {/* ── Top bar: search + close ── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-dash-border">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dash-muted pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Aktivitäten suchen…"
            className="w-full pl-9 pr-4 py-2 text-sm bg-white/5 border border-dash-border rounded-xl text-white placeholder:text-dash-muted focus:outline-none focus:border-indigo-500/60 transition-colors"
          />
        </div>
        <button
          onClick={onClose}
          className="shrink-0 p-2 rounded-xl text-dash-muted hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Schließen"
        >
          <X size={18} />
        </button>
      </div>

      {/* ── Filter panel ── */}
      <div className="shrink-0 px-4 py-3 border-b border-dash-border space-y-2.5 bg-white/[0.02]">

        {/* Date range */}
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-[10px] text-dash-muted uppercase tracking-wider w-16">Zeitraum</span>
          <div className="flex items-center gap-2 flex-1">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="flex-1 min-w-0 px-2.5 py-1 text-xs bg-white/5 border border-dash-border rounded-lg text-white focus:outline-none focus:border-indigo-500/50 transition-colors [color-scheme:dark]"
              aria-label="Von"
            />
            <span className="text-dash-muted text-xs shrink-0">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="flex-1 min-w-0 px-2.5 py-1 text-xs bg-white/5 border border-dash-border rounded-lg text-white focus:outline-none focus:border-indigo-500/50 transition-colors [color-scheme:dark]"
              aria-label="Bis"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                className="shrink-0 text-dash-muted hover:text-white transition-colors"
                aria-label="Zeitraum zurücksetzen"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Sport type */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <span className="shrink-0 text-[10px] text-dash-muted uppercase tracking-wider w-16">Sportart</span>
          <Chip label="Alle" active={sportFilter === null} onClick={() => setSportFilter(null)} />
          {sportTypes.map((t) => (
            <Chip key={t} label={t} active={sportFilter === t} onClick={() => setSportFilter(t === sportFilter ? null : t)} />
          ))}
        </div>

        {/* Intensity */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <span className="shrink-0 text-[10px] text-dash-muted uppercase tracking-wider w-16">Intensität</span>
          <Chip label="Alle" active={intensityFilter === null} onClick={() => setIntensityFilter(null)} />
          {(Object.keys(INTENSITY_LABELS) as IntensityKey[]).map((k) => (
            <Chip
              key={k}
              label={INTENSITY_LABELS[k]}
              active={intensityFilter === k}
              onClick={() => setIntensityFilter(k === intensityFilter ? null : k)}
            />
          ))}
        </div>

        {/* Duration */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <span className="shrink-0 text-[10px] text-dash-muted uppercase tracking-wider w-16">Dauer</span>
          <Chip label="Alle" active={durationFilter === null} onClick={() => setDurationFilter(null)} />
          {(Object.keys(DURATION_LABELS) as DurationBucket[]).map((k) => (
            <Chip key={k} label={DURATION_LABELS[k]} active={durationFilter === k}
              onClick={() => setDurationFilter(k === durationFilter ? null : k)} />
          ))}
        </div>
      </div>

      {/* ── Count ── */}
      <div className="shrink-0 px-4 py-2 flex items-center gap-2 border-b border-dash-border/50">
        <ActivityIcon size={12} className="text-dash-muted" />
        <span className="text-[11px] text-dash-muted">
          {filtered.length} Aktivität{filtered.length !== 1 ? "en" : ""}
        </span>
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-dash-muted text-sm gap-2">
            <ActivityIcon size={32} className="opacity-20" />
            <span>Keine Aktivitäten gefunden</span>
          </div>
        ) : (
          filtered.map((a) => {
            const intensity = classifyIntensity(a);
            const date = parseISO(a.start_date_local);
            const np = npValue(a);
            const isZ2 = intensity === "z2";
            const hasPower = (a.average_watts ?? np) != null;

            return (
              <div
                key={a.id}
                className="rounded-xl border border-dash-border bg-white/[0.03] px-4 py-3 hover:border-indigo-500/30 transition-colors"
              >
                {/* ── Row 1: emoji + name + date ── */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg leading-none shrink-0" role="img">{sportEmoji(a)}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate leading-snug">{a.name}</p>
                      <p className="text-[10px] text-dash-muted mt-0.5">{a.type}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] font-medium text-white/70 leading-snug">
                      {format(date, "d. MMM yyyy", { locale: de })}
                    </p>
                    <p className="text-[10px] text-dash-muted">{format(date, "EEEE", { locale: de })}</p>
                  </div>
                </div>

                {/* ── Row 2: metrics ── */}
                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
                  {/* Dauer */}
                  <MetricPill
                    icon={<Timer size={11} />}
                    value={fmtDuration(a.moving_time)}
                  />

                  {/* Distanz */}
                  {a.distance ? (
                    <MetricPill
                      icon={<span className="text-[11px]">📍</span>}
                      value={fmtDistance(a.distance)}
                    />
                  ) : null}

                  {/* Avg HF */}
                  {a.average_heartrate ? (
                    <MetricPill
                      icon={<Heart size={11} className="text-red-400" />}
                      value={`${Math.round(a.average_heartrate)}`}
                      label="bpm"
                    />
                  ) : null}

                  {/* Avg Power */}
                  {a.average_watts ? (
                    <MetricPill
                      icon={<Zap size={11} className="text-yellow-400" />}
                      value={`${Math.round(a.average_watts)}W`}
                    />
                  ) : null}

                  {/* NP */}
                  {np && np !== a.average_watts ? (
                    <MetricPill
                      icon={<TrendingUp size={11} className="text-orange-400" />}
                      value={`${Math.round(np)}W`}
                      label="NP"
                    />
                  ) : null}

                  {/* Höhenmeter */}
                  {a.total_elevation_gain ? (
                    <MetricPill
                      icon={<span className="text-[11px]">↑</span>}
                      value={`${Math.round(a.total_elevation_gain)} m`}
                    />
                  ) : null}

                  {/* Decoupling – nur Z2 */}
                  {isZ2 && a.aerobic_decoupling != null ? (
                    <MetricPill
                      icon={<span className="text-[11px] text-blue-400">⇌</span>}
                      value={`${a.aerobic_decoupling.toFixed(1)}%`}
                      label="Decoupling"
                    />
                  ) : null}

                  {/* Load / TSS */}
                  {a.icu_training_load != null ? (
                    <MetricPill
                      icon={<span className="text-[11px] text-indigo-400">●</span>}
                      value={`${Math.round(a.icu_training_load)}`}
                      label="TSS"
                    />
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
