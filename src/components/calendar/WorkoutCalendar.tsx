"use client";
import { useState, useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  format,
  isSameMonth,
  isSameDay,
  parseISO,
  isWithinInterval,
} from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import { Activity, IntervalsEvent, ProRace } from "@/lib/types";
import { PRO_RACES_2026, RACE_CATEGORY_COLORS } from "@/lib/pro-races";

interface Props {
  activities: Activity[];
  events: IntervalsEvent[];
  showProRaces: boolean;
}

const SPORT_COLORS: Record<string, string> = {
  Ride: "#f97316",
  VirtualRide: "#fb923c",
  Run: "#10b981",
  VirtualRun: "#34d399",
  Swim: "#3b82f6",
  Strength: "#8b5cf6",
  Workout: "#6366f1",
  Walk: "#a3e635",
  Hike: "#84cc16",
  Other: "#6b7280",
};

function sportColor(type: string): string {
  return SPORT_COLORS[type] ?? SPORT_COLORS.Other;
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h${m > 0 ? m + "m" : ""}` : `${m}m`;
}

function formatDistance(m: number): string {
  return (m / 1000).toFixed(0) + " km";
}

export default function WorkoutCalendar({ activities, events, showProRaces }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selected, setSelected] = useState<Date | null>(null);

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

  function proRacesOnDay(day: Date): ProRace[] {
    if (!showProRaces) return [];
    return PRO_RACES_2026.filter((r) => {
      const start = parseISO(r.startDate);
      const end = parseISO(r.endDate);
      return isWithinInterval(day, { start, end });
    });
  }

  const selectedActs = selected ? actsByDate.get(format(selected, "yyyy-MM-dd")) ?? [] : [];
  const selectedEvts = selected ? eventsByDate.get(format(selected, "yyyy-MM-dd")) ?? [] : [];
  const selectedProRaces = selected ? proRacesOnDay(selected) : [];

  const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  return (
    <div className="rounded-xl border border-dash-border bg-dash-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-dash-border">
        <button
          onClick={() => setCurrentMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() - 1); return d; })}
          className="p-1.5 rounded-lg hover:bg-white/5 text-dash-muted hover:text-white transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <h2 className="text-white font-semibold">
          {format(currentMonth, "MMMM yyyy", { locale: de })}
        </h2>
        <button
          onClick={() => setCurrentMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() + 1); return d; })}
          className="p-1.5 rounded-lg hover:bg-white/5 text-dash-muted hover:text-white transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="flex">
        {/* Calendar grid */}
        <div className="flex-1">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-dash-border">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2 text-center text-[10px] text-dash-muted uppercase tracking-wider">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const acts = actsByDate.get(key) ?? [];
              const evts = eventsByDate.get(key) ?? [];
              const proRaces = proRacesOnDay(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = selected ? isSameDay(day, selected) : false;
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={key}
                  onClick={() => setSelected(isSelected ? null : day)}
                  className={clsx(
                    "min-h-[72px] p-1.5 border-b border-r border-dash-border cursor-pointer transition-colors",
                    !isCurrentMonth && "opacity-30",
                    isSelected ? "bg-indigo-600/20" : "hover:bg-white/3"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={clsx(
                        "text-xs w-5 h-5 flex items-center justify-center rounded-full",
                        isToday ? "bg-indigo-600 text-white font-bold" : "text-dash-muted"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    {/* Activities */}
                    {acts.slice(0, 2).map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center gap-1 px-1 py-0.5 rounded text-[9px] leading-tight"
                        style={{ backgroundColor: `${sportColor(a.type)}20`, color: sportColor(a.type) }}
                      >
                        <div
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: sportColor(a.type) }}
                        />
                        <span className="truncate">{a.name}</span>
                      </div>
                    ))}
                    {acts.length > 2 && (
                      <div className="text-[9px] text-dash-muted pl-1">+{acts.length - 2} mehr</div>
                    )}

                    {/* Events */}
                    {evts.slice(0, 1).map((e) => (
                      <div
                        key={String(e.id)}
                        className="flex items-center gap-1 px-1 py-0.5 rounded text-[9px] leading-tight bg-red-500/15 text-red-400"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                        <span className="truncate">{e.name}</span>
                      </div>
                    ))}

                    {/* Pro Races */}
                    {proRaces.slice(0, 1).map((r) => (
                      <div
                        key={r.name + r.startDate}
                        className="flex items-center gap-1 px-1 py-0.5 rounded text-[9px] leading-tight"
                        style={{
                          backgroundColor: `${RACE_CATEGORY_COLORS[r.category]}20`,
                          color: RACE_CATEGORY_COLORS[r.category],
                        }}
                      >
                        <div
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: RACE_CATEGORY_COLORS[r.category] }}
                        />
                        <span className="truncate">{r.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-64 border-l border-dash-border p-4 flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-white">
              {format(selected, "EEEE, d. MMMM", { locale: de })}
            </h3>

            {selectedActs.length === 0 && selectedEvts.length === 0 && selectedProRaces.length === 0 && (
              <p className="text-xs text-dash-muted">Keine Einträge</p>
            )}

            {selectedActs.map((a) => (
              <div key={a.id} className="rounded-lg p-3 border border-dash-border" style={{ borderLeftColor: sportColor(a.type), borderLeftWidth: 3 }}>
                <p className="text-xs font-medium text-white truncate mb-1">{a.name}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-dash-muted">
                  <span style={{ color: sportColor(a.type) }}>{a.type}</span>
                  {a.moving_time && <span>{formatDuration(a.moving_time)}</span>}
                  {a.distance && a.distance > 0 && <span>{formatDistance(a.distance)}</span>}
                  {a.average_heartrate && <span>{Math.round(a.average_heartrate)} bpm Ø</span>}
                  {a.average_watts && <span>{Math.round(a.average_watts)} W Ø</span>}
                  {a.icu_training_load && <span>TSS {Math.round(a.icu_training_load)}</span>}
                  {a.race && <span className="text-red-400 font-semibold">RENNEN</span>}
                </div>
              </div>
            ))}

            {selectedEvts.map((e) => (
              <div key={String(e.id)} className="rounded-lg p-3 border border-red-500/30 bg-red-500/10">
                <p className="text-xs font-medium text-red-400">{e.name}</p>
                {e.description && <p className="text-[10px] text-dash-muted mt-1">{e.description}</p>}
              </div>
            ))}

            {selectedProRaces.map((r) => (
              <div
                key={r.name + r.startDate}
                className="rounded-lg p-3 border"
                style={{
                  borderColor: `${RACE_CATEGORY_COLORS[r.category]}40`,
                  backgroundColor: `${RACE_CATEGORY_COLORS[r.category]}10`,
                }}
              >
                <p className="text-xs font-medium" style={{ color: RACE_CATEGORY_COLORS[r.category] }}>
                  {r.name}
                </p>
                <p className="text-[10px] text-dash-muted mt-0.5">
                  {r.category} · {r.country ?? ""}
                  {r.startDate !== r.endDate && ` · bis ${format(parseISO(r.endDate), "d. MMM", { locale: de })}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-t border-dash-border flex flex-wrap gap-3 text-[9px]">
        {Object.entries(SPORT_COLORS)
          .filter(([k]) => k !== "Other")
          .map(([k, v]) => (
            <span key={k} className="flex items-center gap-1 text-dash-muted">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: v }} />
              {k}
            </span>
          ))}
        <span className="flex items-center gap-1 text-dash-muted">
          <span className="w-2 h-2 rounded-full bg-red-500" /> Ereignis
        </span>
        <span className="flex items-center gap-1" style={{ color: RACE_CATEGORY_COLORS.Monument }}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: RACE_CATEGORY_COLORS.Monument }} />
          Monument
        </span>
        <span className="flex items-center gap-1" style={{ color: RACE_CATEGORY_COLORS.GrandTour }}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: RACE_CATEGORY_COLORS.GrandTour }} />
          Grand Tour
        </span>
      </div>
    </div>
  );
}
