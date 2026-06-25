"use client";
import { useMemo, useState, useEffect } from "react";
import { clsx } from "clsx";
import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { format, parseISO, startOfWeek } from "date-fns";
import { de } from "date-fns/locale";

import { useActivities } from "@/hooks/useActivities";
import { usePeriod } from "@/hooks/usePeriod";
import PeriodSelector from "@/components/ui/PeriodSelector";
import { Activity } from "@/lib/types";

// ── Weekly aggregation ────────────────────────────────────────────────────────

interface WeekPoint {
  weekLabel: string;
  sessions: number;
  hours: number;
}

function aggregateByWeek(activities: Activity[]): WeekPoint[] {
  const map = new Map<string, { sessions: number; hours: number }>();
  for (const a of activities) {
    const weekStart = startOfWeek(parseISO(a.start_date_local), { weekStartsOn: 1 });
    const key = format(weekStart, "yyyy-MM-dd");
    const entry = map.get(key) ?? { sessions: 0, hours: 0 };
    entry.sessions += 1;
    entry.hours += (a.moving_time ?? 0) / 3600;
    map.set(key, entry);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => ({
      weekLabel: format(parseISO(key), "dd.MM.", { locale: de }),
      sessions: val.sessions,
      hours: parseFloat(val.hours.toFixed(1)),
    }));
}

// ── Chart component ───────────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  backgroundColor: "var(--dash-card)",
  border: "1px solid var(--dash-border)",
  borderRadius: 10,
  fontSize: 11,
};

interface SportChartProps {
  label: string;
  data: WeekPoint[];
  barColor: string;
  lineColor: string;
  extra?: React.ReactNode;
  chartHeight?: number;
}

function SportChart({ label, data, barColor, lineColor, extra, chartHeight = 180 }: SportChartProps) {
  const totalSessions = data.reduce((s, d) => s + d.sessions, 0);
  const totalHours    = data.reduce((s, d) => s + d.hours, 0);
  const weeks         = data.length;
  const avgSessions   = weeks > 0 ? (totalSessions / weeks).toFixed(1) : "–";
  const avgHours      = weeks > 0 ? (totalHours   / weeks).toFixed(1) : "–";

  return (
    <section>
      {/* Title row */}
      <div className="flex items-start justify-between mb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: barColor }} />
          <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium">{label}</p>
          {extra}
        </div>
        <div className="flex items-center gap-4 text-[10px] text-dash-muted shrink-0">
          <span>
            <span className="text-white font-semibold tabular-nums">{totalSessions}</span> Sessions
          </span>
          <span>
            <span className="text-white font-semibold tabular-nums">{totalHours.toFixed(1)}</span> Std
          </span>
          <span className="hidden sm:inline">
            Ø <span className="text-white font-semibold tabular-nums">{avgSessions}</span> Sess/Wo
          </span>
          <span className="hidden sm:inline">
            Ø <span className="text-white font-semibold tabular-nums">{avgHours}</span> Std/Wo
          </span>
        </div>
      </div>

      {/* Chart or empty state */}
      {data.length === 0 ? (
        <div className="bg-dash-card border border-dash-border rounded-2xl p-8 flex items-center justify-center">
          <p className="text-xs text-dash-muted">Keine Aktivitäten im gewählten Zeitraum</p>
        </div>
      ) : (
        <div className="bg-dash-card border border-dash-border rounded-2xl p-5">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <ComposedChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--dash-border)" />
              <XAxis
                dataKey="weekLabel"
                tick={{ fill: "var(--dash-muted)", fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="left"
                tick={{ fill: "var(--dash-muted)", fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={24}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: "var(--dash-muted)", fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#e2e8f0" }} />
              <Legend wrapperStyle={{ fontSize: 10, color: "var(--dash-muted)", paddingTop: 6 }} />
              <Bar
                yAxisId="left"
                dataKey="sessions"
                name="Sessions"
                fill={barColor}
                fillOpacity={0.75}
                radius={[3, 3, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="hours"
                name="Stunden"
                stroke={lineColor}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={clsx("animate-pulse rounded-2xl bg-dash-card border border-dash-border", className)} />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TrainingPage() {
  const { period, setPeriod, days } = usePeriod("3m");
  const { activities, loading } = useActivities(days);
  const [showCommutes, setShowCommutes] = useState(false);

  // Diagnose: zeigt Feldstruktur der ersten Aktivitäten in der Browser-Konsole.
  // Prüfe hier ob das Pendel-Feld "commute", "is_commute" o.ä. heißt.
  useEffect(() => {
    if (activities.length > 0) {
      console.log("[Pendel-Diagnose] Erste 3 Aktivitäten:", activities.slice(0, 3));
      const rides = activities.filter((a) => a.type === "Ride" || a.type === "VirtualRide");
      if (rides.length > 0) console.log("[Pendel-Diagnose] Erste Ride:", rides[0]);
    }
  }, [activities]);

  // 2×2 grid sports
  const gridData = useMemo(() => {
    const bikeActs = activities.filter(
      (a) => (a.type === "Ride" || a.type === "VirtualRide") && (showCommutes || !a.commute),
    );
    const runActs = activities.filter(
      (a) => a.type === "Run" || a.type === "VirtualRun",
    );
    const gymActs = activities.filter(
      (a) => a.type === "WeightTraining" || a.type === "Workout",
    );
    return {
      bike: aggregateByWeek(bikeActs),
      run:  aggregateByWeek(runActs),
      gym:  aggregateByWeek(gymActs),
    };
  }, [activities, showCommutes]);

  // Gesamt-Chart always includes commutes
  const totalData = useMemo(() => aggregateByWeek(activities), [activities]);

  const commuteToggle = (
    <button
      onClick={() => setShowCommutes((v) => !v)}
      className={clsx(
        "text-[10px] px-2 py-0.5 rounded-lg border transition-colors",
        showCommutes
          ? "border-orange-500/40 text-orange-400 bg-orange-500/10"
          : "border-dash-border text-dash-muted hover:text-white",
      )}
    >
      {showCommutes ? "Pendeln ausblenden" : "Pendeln einblenden"}
    </button>
  );

  return (
    <>
      <header className="sticky top-0 z-10 bg-dash-bg/95 backdrop-blur border-b border-dash-border px-3 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-sm font-semibold text-white">Training</h1>
        <PeriodSelector value={period} onChange={setPeriod} />
      </header>

      <div className="p-3 sm:p-6 space-y-8 w-full">
        {loading ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-56" />)}
            </div>
            <Skeleton className="h-56" />
          </>
        ) : (
          <>
            {/* Grid: Rennrad · Laufen · Gym */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <SportChart
                label="Rennrad"
                data={gridData.bike}
                barColor="#f97316"
                lineColor="#fdba74"
                extra={commuteToggle}
              />
              <SportChart
                label="Laufen"
                data={gridData.run}
                barColor="#22c55e"
                lineColor="#86efac"
              />
              <SportChart
                label="Gym / Kraft"
                data={gridData.gym}
                barColor="#14b8a6"
                lineColor="#5eead4"
              />
            </div>

            {/* Full-width Gesamt-Chart */}
            <SportChart
              label="Gesamtaktivität — Alle Sportarten"
              data={totalData}
              barColor="#6366f1"
              lineColor="#a5b4fc"
              chartHeight={200}
            />
          </>
        )}
      </div>
    </>
  );
}
