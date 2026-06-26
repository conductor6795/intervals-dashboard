"use client";
import {
  useState, useMemo, useRef, useEffect, useCallback,
} from "react";
import { format, parseISO, endOfDay } from "date-fns";
import { de } from "date-fns/locale";
import {
  X, Search, Timer, Zap, Heart, Activity as ActivityIcon,
  TrendingUp, Loader2,
} from "lucide-react";
import { clsx } from "clsx";
import { Activity } from "@/lib/types";
import ActivityDetailOverlay from "./ActivityDetailOverlay";

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_DAYS = 180;

// ── Sport emojis ──────────────────────────────────────────────────────────────

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

// ── Intensity ─────────────────────────────────────────────────────────────────

type IntensityKey = "z1" | "z2" | "tempo" | "sst" | "threshold" | "vo2max" | "race";
const INTENSITY_LABELS: Record<IntensityKey, string> = {
  z1: "Z1", z2: "Z2", tempo: "Tempo", sst: "SST",
  threshold: "Schwelle", vo2max: "VO2max", race: "Race",
};

// icu_intensity is 0–100 (IF × 100) from Intervals.icu
function classifyIntensity(a: Activity): IntensityKey | null {
  if (a.race) return "race";
  const i = a.icu_intensity;
  if (i == null) return null;
  if (i < 55)  return "z1";
  if (i < 75)  return "z2";
  if (i < 85)  return "tempo";
  if (i < 95)  return "sst";
  if (i <= 105) return "threshold";
  return "vo2max";
}

// ── Duration ──────────────────────────────────────────────────────────────────

type DurationBucket = "lt30" | "30to60" | "60to120" | "gt120";
const DURATION_LABELS: Record<DurationBucket, string> = {
  lt30: "< 30 min", "30to60": "30–60 min", "60to120": "1–2 h", gt120: "> 2 h",
};

function durationBucket(secs?: number): DurationBucket | null {
  if (secs == null) return null;
  const m = secs / 60;
  if (m < 30)  return "lt30";
  if (m < 60)  return "30to60";
  if (m < 120) return "60to120";
  return "gt120";
}

function fmtDuration(secs?: number) {
  if (!secs) return "–";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}min`;
}

function fmtDistance(m?: number) {
  if (!m) return "";
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function npValue(a: Activity): number | null {
  return a.icu_weighted_avg_watts ?? null;
}

// ── Chip ──────────────────────────────────────────────────────────────────────

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

// ── Infinite-scroll paging hook ───────────────────────────────────────────────
// Uses refs for mutable state so loadMore stays a stable reference —
// otherwise the IntersectionObserver gets recreated on every render and misses
// the sentinel after loading completes.

function usePagedActivities(seedActivities: Activity[]) {
  const [activities, setActivities] = useState<Activity[]>(() =>
    [...seedActivities].sort((a, b) => b.start_date_local.localeCompare(a.start_date_local))
  );
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Mutable state via refs → loadMore never needs to be recreated
  const loadingRef  = useRef(false);
  const hasMoreRef  = useRef(true);
  const seedOldest = seedActivities.length === 0 ? new Date() : parseISO(
    [...seedActivities].reduce((min, a) =>
      a.start_date_local < min ? a.start_date_local : min, seedActivities[0].start_date_local
    )
  );
  const windowEndRef = useRef<Date>(seedOldest);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    const newest = windowEndRef.current.toISOString().slice(0, 10);
    const next   = new Date(windowEndRef.current);
    next.setDate(next.getDate() - PAGE_DAYS);
    const oldest = next.toISOString().slice(0, 10);

    try {
      const res  = await fetch(`/api/activities?oldest=${oldest}&newest=${newest}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Activity[] = await res.json();

      if (data.length === 0) {
        hasMoreRef.current = false;
        setHasMore(false);
      } else {
        setActivities((prev) => {
          const ids   = new Set(prev.map((a) => a.id));
          const fresh = data.filter((a) => !ids.has(a.id));
          if (fresh.length === 0) {
            hasMoreRef.current = false;
            setHasMore(false);
            return prev;
          }
          return [...prev, ...fresh].sort((a, b) =>
            b.start_date_local.localeCompare(a.start_date_local)
          );
        });
        windowEndRef.current = next;
        if (data.length < 3) {
          hasMoreRef.current = false;
          setHasMore(false);
        }
      }
    } catch {
      /* silently ignore — user can scroll again */
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []); // stable — no deps needed thanks to refs

  return { activities, loading, hasMore, loadMore };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  activities: Activity[];   // seed from parent (most recent, already loaded)
  onClose: () => void;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function ActivityListOverlay({ open, activities: seed, onClose }: Props) {
  const [query, setQuery]                     = useState("");
  const [sportFilter, setSportFilter]         = useState<string | null>(null);
  const [intensityFilter, setIntensityFilter] = useState<IntensityKey | null>(null);
  const [durationFilter, setDurationFilter]   = useState<DurationBucket | null>(null);
  const [dateFrom, setDateFrom]               = useState("");
  const [dateTo, setDateTo]                   = useState("");
  const [selected, setSelected]               = useState<Activity | null>(null);

  const inputRef    = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollRef   = useRef<HTMLDivElement>(null);

  const { activities, loading, hasMore, loadMore } = usePagedActivities(seed);

  // Auto-focus search on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  // Escape closes
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && !selected) onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose, selected]);

  // Intersection observer — root = scroll container so it works inside overflow-y-auto
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root     = scrollRef.current;
    if (!sentinel || !root) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { root, rootMargin: "300px" }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [loadMore]); // loadMore is now stable (no deps)

  const sportTypes = useMemo(() => {
    const s = new Set(activities.map((a) => a.type));
    return Array.from(s).sort();
  }, [activities]);

  const filtered = useMemo(() => {
    let list = activities;
    if (dateFrom) {
      const from = parseISO(dateFrom);
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
  }, [activities, query, sportFilter, intensityFilter, durationFilter, dateFrom, dateTo]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--color-dash-bg, #0f1117)" }}>

        {/* ── Search + close ── */}
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
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Filters ── */}
        <div className="shrink-0 px-4 py-3 border-b border-dash-border space-y-2.5 bg-white/[0.015]">

          {/* Date range */}
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[10px] text-dash-muted uppercase tracking-wider w-16">Zeitraum</span>
            <div className="flex items-center gap-2 flex-1">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="flex-1 min-w-0 px-2.5 py-1 text-xs bg-white/5 border border-dash-border rounded-lg text-white focus:outline-none focus:border-indigo-500/50 transition-colors [color-scheme:dark]" />
              <span className="text-dash-muted text-xs shrink-0">–</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="flex-1 min-w-0 px-2.5 py-1 text-xs bg-white/5 border border-dash-border rounded-lg text-white focus:outline-none focus:border-indigo-500/50 transition-colors [color-scheme:dark]" />
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(""); setDateTo(""); }}
                  className="shrink-0 text-dash-muted hover:text-white transition-colors"><X size={12} /></button>
              )}
            </div>
          </div>

          {/* Sport */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            <span className="shrink-0 text-[10px] text-dash-muted uppercase tracking-wider w-16">Sportart</span>
            <Chip label="Alle" active={sportFilter === null} onClick={() => setSportFilter(null)} />
            {sportTypes.map((t) => (
              <Chip key={t} label={t} active={sportFilter === t}
                onClick={() => setSportFilter(t === sportFilter ? null : t)} />
            ))}
          </div>

          {/* Intensity */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            <span className="shrink-0 text-[10px] text-dash-muted uppercase tracking-wider w-16">Intensität</span>
            <Chip label="Alle" active={intensityFilter === null} onClick={() => setIntensityFilter(null)} />
            {(Object.keys(INTENSITY_LABELS) as IntensityKey[]).map((k) => (
              <Chip key={k} label={INTENSITY_LABELS[k]} active={intensityFilter === k}
                onClick={() => setIntensityFilter(k === intensityFilter ? null : k)} />
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
            {activities.length} Aktivität{activities.length !== 1 ? "en" : ""}{filtered.length !== activities.length ? ` · ${filtered.length} gefiltert` : ""}
          </span>
        </div>

        {/* ── List ── */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {filtered.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center h-48 text-dash-muted gap-2">
              <ActivityIcon size={32} className="opacity-20" />
              <span className="text-sm">Keine Aktivitäten gefunden</span>
            </div>
          ) : (
            filtered.map((a) => {
              const intensity = classifyIntensity(a);
              const isZ2 = intensity === "z2";
              const np   = npValue(a);
              const dec  = a.decoupling;

              return (
                <button
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className="w-full text-left rounded-xl border border-dash-border bg-white/[0.03] px-4 py-3 hover:border-indigo-500/40 hover:bg-white/[0.05] transition-colors"
                >
                  {/* Row 1: emoji + name + date */}
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
                        {format(parseISO(a.start_date_local), "d. MMM yyyy", { locale: de })}
                      </p>
                      <p className="text-[10px] text-dash-muted">
                        {format(parseISO(a.start_date_local), "EEEE", { locale: de })}
                      </p>
                    </div>
                  </div>

                  {/* Row 2: metrics */}
                  <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
                    <MetricPill icon={<Timer size={11} />} value={fmtDuration(a.moving_time)} />
                    {a.distance ? (
                      <MetricPill icon={<span className="text-[11px]">📍</span>} value={fmtDistance(a.distance)} />
                    ) : null}
                    {a.average_heartrate ? (
                      <MetricPill icon={<Heart size={11} className="text-red-400" />}
                        value={`${Math.round(a.average_heartrate)}`} label="bpm" />
                    ) : null}
                    {a.average_watts ? (
                      <MetricPill icon={<Zap size={11} className="text-yellow-400" />}
                        value={`${Math.round(a.average_watts)}W`} />
                    ) : null}
                    {np && np !== a.average_watts ? (
                      <MetricPill icon={<TrendingUp size={11} className="text-orange-400" />}
                        value={`${Math.round(np)}W`} label="NP" />
                    ) : null}
                    {a.total_elevation_gain ? (
                      <MetricPill icon={<span className="text-[11px]">↑</span>}
                        value={`${Math.round(a.total_elevation_gain)} m`} />
                    ) : null}
                    {isZ2 && dec != null ? (
                      <MetricPill icon={<span className="text-[11px] text-blue-400">⇌</span>}
                        value={`${dec.toFixed(1)}%`} label="Decoupling" />
                    ) : null}
                    {a.icu_training_load != null ? (
                      <MetricPill icon={<span className="text-[11px] text-indigo-400">●</span>}
                        value={`${Math.round(a.icu_training_load)}`} label="TSS" />
                    ) : null}
                  </div>
                </button>
              );
            })
          )}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="py-4 flex justify-center">
            {loading && <Loader2 size={18} className="text-dash-muted animate-spin" />}
            {!hasMore && activities.length > 0 && (
              <span className="text-[11px] text-dash-muted">Alle Aktivitäten geladen</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Detail overlay (on top) ── */}
      <ActivityDetailOverlay
        activity={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
