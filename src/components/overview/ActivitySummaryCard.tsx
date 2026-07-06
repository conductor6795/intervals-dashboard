"use client";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { format, parseISO, startOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import { Dumbbell } from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";

import TrendArrow from "@/components/ui/TrendArrow";
import { Activity } from "@/lib/types";

interface WeekPoint {
  weekLabel: string;
  hours: number;
  load: number;
  weekStart: string;
}

function aggregateByWeek(activities: Activity[]): WeekPoint[] {
  const map = new Map<string, { hours: number; load: number }>();
  for (const a of activities) {
    const weekStart = startOfWeek(parseISO(a.start_date_local), { weekStartsOn: 1 });
    const key = format(weekStart, "yyyy-MM-dd");
    const entry = map.get(key) ?? { hours: 0, load: 0 };
    entry.hours += (a.moving_time ?? 0) / 3600;
    entry.load += a.icu_training_load ?? 0;
    map.set(key, entry);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => ({
      weekStart: key,
      weekLabel: format(parseISO(key), "dd.MM.", { locale: de }),
      hours: parseFloat(val.hours.toFixed(1)),
      load: Math.round(val.load),
    }));
}

const TOOLTIP_STYLE = { backgroundColor: "var(--dash-card)", border: "1px solid var(--dash-border)", borderRadius: 10, fontSize: 11 };

export default function ActivitySummaryCard({ activities }: { activities: Activity[] }) {
  const weeks = useMemo(() => aggregateByWeek(activities).slice(-8), [activities]);

  const thisWeek = weeks[weeks.length - 1];
  const lastWeek = weeks[weeks.length - 2];
  const loadTrend: "up" | "neutral" | "down" =
    thisWeek && lastWeek && lastWeek.load > 0
      ? thisWeek.load > lastWeek.load * 1.05 ? "up" : thisWeek.load < lastWeek.load * 0.95 ? "down" : "neutral"
      : "neutral";

  return (
    <Link href="/training" className="block bg-dash-card border border-dash-border rounded-2xl p-5 hover:border-white/20 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-[10px] text-dash-muted uppercase tracking-wider font-medium">
          <Dumbbell size={11} /> Aktivitätszusammenfassung
        </div>
        <span className="text-[10px] text-accent">Details →</span>
      </div>

      <div className="flex items-end gap-4 mb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xl font-bold tabular-nums text-white">{thisWeek?.load ?? 0}</span>
            <TrendArrow trend={loadTrend} positiveIsGood size={12} />
          </div>
          <p className="text-[10px] text-dash-muted">Belastung diese Woche</p>
        </div>
        <div>
          <span className="text-xl font-bold tabular-nums text-white">{thisWeek?.hours.toFixed(1) ?? "0.0"}</span>
          <span className="text-dash-muted text-xs ml-1">h</span>
          <p className="text-[10px] text-dash-muted">Trainingszeit diese Woche</p>
        </div>
      </div>

      {weeks.length > 0 ? (
        <div className="h-20 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeks} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="weekLabel" tick={{ fontSize: 9, fill: "var(--dash-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis hide domain={[0, "auto"]} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: "#e2e8f0" }}
                formatter={(v: number, name: string) => [name === "load" ? v : `${v} h`, name === "load" ? "Belastung" : "Stunden"]}
              />
              <Bar dataKey="load" fill="#6366f1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-xs text-dash-muted">Keine Aktivitäten im Zeitraum.</p>
      )}
      <p className={clsx("text-[10px] mt-1", loadTrend === "up" ? "text-orange-400" : loadTrend === "down" ? "text-blue-400" : "text-dash-muted")}>
        {lastWeek ? `Vorwoche: ${lastWeek.load} Belastung · ${lastWeek.hours.toFixed(1)} h` : "Noch keine Vorwoche zum Vergleich"}
      </p>
    </Link>
  );
}
