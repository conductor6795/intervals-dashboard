"use client";
import { useState, useMemo, useCallback } from "react";
import {
  startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, format, isSameMonth,
  isSameDay, parseISO, isWithinInterval,
} from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarCheck, Search, X as XIcon, CalendarDays } from "lucide-react";
import { clsx } from "clsx";
import { Activity, IntervalsEvent, ProRace, WellnessDay } from "@/lib/types";
import { PRO_RACES_2026, RACE_CATEGORY_COLORS } from "@/lib/pro-races";
import DayDetailModal from "./DayDetailModal";
import ActivityListOverlay from "./ActivityListOverlay";
import ActivityDetailOverlay from "./ActivityDetailOverlay";

interface Props {
  activities: Activity[];
  events: IntervalsEvent[];
  wellness: WellnessDay[];
  showProRaces: boolean;
}

const SPORT_COLORS: Record<string, string> = {
  Ride: "#f97316", VirtualRide: "#fb923c", Run: "#10b981",
  VirtualRun: "#34d399", Swim: "#3b82f6", Strength: "#8b5cf6",
  Workout: "#6366f1", Walk: "#a3e635", Hike: "#84cc16", Other: "#6b7280",
};

function sportColor(type: string) { return SPORT_COLORS[type] ?? SPORT_COLORS.Other; }

function sportEmoji(type: string, race?: boolean, commute?: boolean): string {
  if (type === "Ride")        return race ? "🏆" : commute ? "🚲" : "🚴";
  if (type === "VirtualRide") return "🖥️";
  if (type === "Run")         return race ? "🏆" : "👟";
  if (type === "VirtualRun")  return "🏃";
  if (type === "Swim")        return "🏊";
  if (type === "Strength")    return "🏋️";
  if (type === "Walk")        return "🚶";
  if (type === "Hike")        return "🥾";
  if (type === "Workout")     return "⚡";
  return "🏅";
}

/** Versucht einen Datumsstring zu parsen (TT.MM, TT.MM.YYYY, YYYY-MM-DD) */
function parseSearchDate(q: string): Date | null {
  const dmY = q.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/);
  if (dmY) {
    const year = dmY[3] ? parseInt(dmY[3]) : new Date().getFullYear();
    const d = new Date(year, parseInt(dmY[2]) - 1, parseInt(dmY[1]));
    if (!isNaN(d.getTime())) return d;
  }
  const iso = q.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = parseISO(q);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/** Parst Dauersuche: ">60", "<90", "45" → Filterfunction in Minuten */
function parseDurationFilter(q: string): ((mins: number) => boolean) | null {
  const m = q.match(/^([<>]?)(\d+)\s*(?:min|m)?$/i);
  if (!m) return null;
  const op = m[1], val = parseInt(m[2]);
  if (op === ">") return (x) => x > val;
  if (op === "<") return (x) => x < val;
  return (x) => Math.abs(x - val) <= 5;
}

export default function WorkoutCalendar({ activities, events, wellness, showProRaces }: Props) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const actsByDate = useMemo(() => {
    const map = new Map<string, Activity[]>();
    activities.forEach((a) => {
      const key = a.start_date_local.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return map;
  }, [activities]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, IntervalsEvent[]>();
    events.forEach((e) => {
      const key = e.start_date_local.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return map;
  }, [events]);

  const wellnessByDate = useMemo(() => {
    const map = new Map<string, WellnessDay>();
    wellness.forEach((w) => map.set(w.id, w));
    return map;
  }, [wellness]);

  /** Tage die dem Suchbegriff entsprechen – null = kein Filter aktiv */
  const matchingDates = useMemo<Set<string> | null>(() => {
    const q = search.trim();
    if (!q) return null;

    // Datumssuche
    const dateHit = parseSearchDate(q);
    if (dateHit) return new Set([format(dateHit, "yyyy-MM-dd")]);

    // Dauersuche
    const durFn = parseDurationFilter(q);
    if (durFn) {
      const hits = new Set<string>();
      actsByDate.forEach((acts, key) => {
        if (acts.some((a) => a.moving_time != null && durFn(Math.round(a.moving_time / 60)))) hits.add(key);
      });
      return hits;
    }

    // Titelsuche
    const lower = q.toLowerCase();
    const hits = new Set<string>();
    actsByDate.forEach((acts, key) => {
      if (acts.some((a) => a.name.toLowerCase().includes(lower))) hits.add(key);
    });
    return hits;
  }, [search, actsByDate]);

  function proRacesOnDay(day: Date): ProRace[] {
    if (!showProRaces) return [];
    return PRO_RACES_2026.filter((r) => {
      const start = parseISO(r.startDate), end = parseISO(r.endDate);
      return isWithinInterval(day, { start, end });
    });
  }

  const handleDateChange = useCallback((d: Date) => {
    setSelectedDate(d);
    if (!isSameMonth(d, currentMonth)) {
      setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [currentMonth]);

  /** Kalender-Header: Datumspicker – springt direkt zu Monat + öffnet Modal */
  function handleDatePickerChange(value: string) {
    if (!value) return;
    const d = parseISO(value);
    if (isNaN(d.getTime())) return;
    setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelectedDate(d);
  }

  /** Suchfeld: bei Datum-Treffer direkt navigieren */
  function handleSearchChange(value: string) {
    setSearch(value);
    const d = parseSearchDate(value.trim());
    if (d) {
      setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
      setSelectedDate(d);
    }
  }

  const modalDate = selectedDate ?? today;
  const modalKey = format(modalDate, "yyyy-MM-dd");
  const modalActs = actsByDate.get(modalKey) ?? [];
  const modalWellness = wellnessByDate.get(modalKey) ?? null;

  const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  return (
    <>
      <div className="rounded-2xl border border-dash-border bg-dash-card overflow-hidden w-full flex flex-col flex-1 min-h-0">
        {/* ── Header ── */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-dash-border">
          <button
            onClick={() => setCurrentMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() - 1); return d; })}
            className="p-2 rounded-xl hover:bg-white/5 text-dash-muted hover:text-white transition-colors"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="flex items-center gap-3">
            {/* Klickbares Datum – öffnet nativen Datepicker */}
            <div className="relative flex items-center gap-1.5 cursor-pointer group" title="Zu einem Datum springen">
              <h2 className="text-white font-semibold text-sm group-hover:text-indigo-400 transition-colors select-none">
                {format(currentMonth, "MMMM yyyy", { locale: de })}
              </h2>
              <CalendarDays size={12} className="text-dash-muted group-hover:text-indigo-400 transition-colors" />
              <input
                type="date"
                value={format(currentMonth, "yyyy-MM-dd")}
                onChange={(e) => handleDatePickerChange(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full"
                aria-label="Zu einem Datum springen"
              />
            </div>

            {!isSameMonth(currentMonth, today) && (
              <button
                onClick={() => { setCurrentMonth(today); setSelectedDate(today); }}
                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 border border-indigo-500/30 transition-colors"
              >
                <CalendarCheck size={11} />
                Heute
              </button>
            )}
          </div>

          <button
            onClick={() => setCurrentMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() + 1); return d; })}
            className="p-2 rounded-xl hover:bg-white/5 text-dash-muted hover:text-white transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* ── Suchleiste ── */}
        <div className="shrink-0 px-4 py-2.5 border-b border-dash-border">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dash-muted pointer-events-none" />
            <input
              type="text"
              value={search}
              onFocus={() => setListOpen(true)}
              readOnly
              placeholder="Aktivitäten durchsuchen & filtern…"
              className="w-full pl-8 pr-8 py-1.5 text-xs bg-dash-bg border border-dash-border rounded-lg text-white placeholder:text-dash-muted focus:outline-none focus:border-indigo-500/50 transition-colors cursor-pointer"
            />
          </div>
        </div>

        {/* ── Kalender-Grid ── flex-1 fills all remaining height */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="shrink-0 grid grid-cols-7 border-b border-dash-border">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2 text-center text-[10px] text-dash-muted uppercase tracking-wider">{d}</div>
            ))}
          </div>

          {/* gridAutoRows: 1fr splits the available height equally across all rows */}
          <div className="grid grid-cols-7 flex-1 min-h-0" style={{ gridAutoRows: "1fr" }}>
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const acts  = actsByDate.get(key)   ?? [];
              const allEvts = eventsByDate.get(key) ?? [];
              // Hide planned events that are already covered by a completed activity of the same type
              const actTypeCount: Record<string, number> = {};
              acts.forEach((a) => { const t = a.type.toLowerCase(); actTypeCount[t] = (actTypeCount[t] ?? 0) + 1; });
              const usedTypeCount: Record<string, number> = {};
              const evts = allEvts.filter((e) => {
                const t = (e.type ?? "").toLowerCase();
                const covered = usedTypeCount[t] ?? 0;
                if (covered < (actTypeCount[t] ?? 0)) { usedTypeCount[t] = covered + 1; return false; }
                return true;
              });
              const proRaces = proRacesOnDay(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
              const isToday = isSameDay(day, today);
              const hasWellness = wellnessByDate.has(key);

              // Suchergebnis: nicht-treffende Tage abdunkeln
              const isFiltered = matchingDates != null && !matchingDates.has(key);
              const isMatch = matchingDates != null && matchingDates.has(key);

              return (
                <div
                  key={key}
                  onClick={() => {
                    if (isSelected) { setSelectedDate(null); } else { setSelectedDate(day); }
                  }}
                  className={clsx(
                    "min-h-[72px] p-1.5 border-b border-r border-dash-border cursor-pointer transition-all overflow-hidden",
                    !isCurrentMonth && "opacity-25",
                    isFiltered && "opacity-20",
                    isMatch && "ring-1 ring-inset ring-indigo-500/40",
                    isSelected ? "bg-indigo-600/15" : isToday ? "bg-indigo-600/5" : "hover:bg-white/3"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={clsx(
                      "text-xs w-6 h-6 flex items-center justify-center rounded-full leading-none",
                      isToday ? "bg-indigo-600 text-white font-bold" : isSelected ? "text-white font-medium" : "text-dash-muted"
                    )}>
                      {format(day, "d")}
                    </span>
                    {hasWellness && isCurrentMonth && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 shrink-0" title="Wellness-Daten vorhanden" />
                    )}
                  </div>

                  <div className="space-y-0.5">
                    {acts.slice(0, 2).map((a) => (
                      <div
                        key={a.id}
                        onClick={(e) => { e.stopPropagation(); setSelectedActivity(a); }}
                        className="flex items-center gap-1 px-1.5 py-1 rounded text-[10px] leading-tight hover:brightness-125 transition-all"
                        style={{ backgroundColor: `${sportColor(a.type)}22`, color: sportColor(a.type) }}
                      >
                        <span className="text-[11px] leading-none shrink-0">{sportEmoji(a.type, a.race, a.commute)}</span>
                        <span className="truncate hidden sm:block font-medium">{a.name}</span>
                      </div>
                    ))}
                    {acts.length > 2 && (
                      <div className="text-[10px] text-dash-muted pl-1">+{acts.length - 2}</div>
                    )}
                    {evts.slice(0, 1).map((e) => (
                      <div key={String(e.id)} className="flex items-center gap-1 px-1.5 py-1 rounded text-[10px] leading-tight bg-red-500/15 text-red-400">
                        <span className="text-[11px] leading-none shrink-0 opacity-80">{e.type ? sportEmoji(e.type) : "📅"}</span>
                        <span className="truncate hidden sm:block">{e.name}</span>
                      </div>
                    ))}
                    {proRaces.slice(0, 1).map((r) => (
                      <div
                        key={r.name + r.startDate}
                        className="flex items-center gap-1 px-1.5 py-1 rounded text-[10px] leading-tight"
                        style={{ backgroundColor: `${RACE_CATEGORY_COLORS[r.category]}20`, color: RACE_CATEGORY_COLORS[r.category] }}
                      >
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: RACE_CATEGORY_COLORS[r.category] }} />
                        <span className="truncate hidden sm:block">{r.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Legend ── */}
        <div className="shrink-0 px-4 py-2 border-t border-dash-border flex flex-wrap gap-2.5 text-[9px]">
          {Object.entries(SPORT_COLORS).filter(([k]) => k !== "Other").map(([k, v]) => (
            <span key={k} className="flex items-center gap-1 text-dash-muted">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: v }} />{k}
            </span>
          ))}
          <span className="flex items-center gap-1 text-dash-muted">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Ereignis
          </span>
          <span className="flex items-center gap-1 text-dash-muted">
            <span className="w-2 h-2 rounded-full bg-emerald-500/50" /> Wellness
          </span>
        </div>
      </div>

      {/* ── Day detail modal ── */}
      <DayDetailModal
        open={selectedDate != null}
        onClose={() => setSelectedDate(null)}
        date={modalDate}
        activities={modalActs}
        wellness={modalWellness}
        onDateChange={handleDateChange}
        onSelectActivity={(a) => setSelectedActivity(a)}
      />

      {/* ── Activity list overlay ── */}
      <ActivityListOverlay
        open={listOpen}
        activities={activities}
        onClose={() => setListOpen(false)}
      />

      {/* ── Activity detail (from calendar chip or day modal) ── */}
      <ActivityDetailOverlay
        activity={selectedActivity}
        onClose={() => setSelectedActivity(null)}
      />
    </>
  );
}
