"use client";
import { useState, useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { clsx } from "clsx";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { format, parseISO, startOfWeek, startOfMonth, getWeek, getMonth } from "date-fns";
import { de } from "date-fns/locale";

import { useWellness } from "@/hooks/useWellness";
import { WellnessDay } from "@/lib/types";

function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-2xl bg-dash-card border border-dash-border", className)} />;
}

const TOOLTIP_STYLE = { backgroundColor: "#131929", border: "1px solid #1e2d4a", borderRadius: 8, fontSize: 11 };
const TICK_STYLE = { fill: "#94a3b8", fontSize: 10 };

type Period = "week" | "month" | "year";

interface MetricConfig {
  key: keyof WellnessDay;
  label: string;
  color: string;
  unit: string;
  type?: "bar" | "line";
  domain?: [number | "auto", number | "auto"];
  transform?: (v: number) => number;
  decimals?: number;
}

const METRICS: MetricConfig[] = [
  { key: "restingHR", label: "Ruhepuls", color: "#ef4444", unit: " bpm", type: "line" },
  { key: "weight", label: "Gewicht", color: "#8b5cf6", unit: " kg", type: "line" },
  { key: "sleepSecs", label: "Schlaf", color: "#3b82f6", unit: " h", type: "line", domain: [4, 10], transform: (v) => parseFloat((v / 3600).toFixed(2)), decimals: 1 },
  { key: "sleepScore", label: "Schlaf-Score", color: "#06b6d4", unit: "", type: "line", domain: [0, 100] },
  { key: "fatigue", label: "Erschöpfung", color: "#f97316", unit: "/5", type: "bar", domain: [0, 5] },
  { key: "soreness", label: "Muskelkater", color: "#f43f5e", unit: "/5", type: "bar", domain: [0, 5] },
  { key: "mood", label: "Stimmung", color: "#10b981", unit: "/5", type: "bar", domain: [0, 5] },
  { key: "motivation", label: "Motivation", color: "#a3e635", unit: "/5", type: "bar", domain: [0, 5] },
];

function mean(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function buildRawData(wellness: WellnessDay[], metric: MetricConfig) {
  return wellness
    .map((d) => {
      const raw = d[metric.key];
      if (raw == null) return null;
      const v = metric.transform ? metric.transform(raw as number) : (raw as number);
      return { dateLabel: format(parseISO(d.id), "dd.MM.", { locale: de }), value: parseFloat(v.toFixed(metric.decimals ?? 1)), date: d.id };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);
}

function buildWeekData(wellness: WellnessDay[], metric: MetricConfig) {
  const byWeek: Record<string, number[]> = {};
  wellness.forEach((d) => {
    const raw = d[metric.key];
    if (raw == null) return;
    const v = metric.transform ? metric.transform(raw as number) : (raw as number);
    const weekStart = format(startOfWeek(parseISO(d.id), { locale: de }), "dd.MM.", { locale: de });
    if (!byWeek[weekStart]) byWeek[weekStart] = [];
    byWeek[weekStart].push(v);
  });
  return Object.entries(byWeek).map(([dateLabel, vals]) => ({
    dateLabel,
    value: parseFloat(mean(vals).toFixed(metric.decimals ?? 1)),
  }));
}

function buildMonthData(wellness: WellnessDay[], metric: MetricConfig) {
  const byMonth: Record<string, number[]> = {};
  wellness.forEach((d) => {
    const raw = d[metric.key];
    if (raw == null) return;
    const v = metric.transform ? metric.transform(raw as number) : (raw as number);
    const monthKey = format(parseISO(d.id), "MMM yy", { locale: de });
    if (!byMonth[monthKey]) byMonth[monthKey] = [];
    byMonth[monthKey].push(v);
  });
  return Object.entries(byMonth).map(([dateLabel, vals]) => ({
    dateLabel,
    value: parseFloat(mean(vals).toFixed(metric.decimals ?? 1)),
  }));
}

function MiniChart({ metric, wellness, period }: { metric: MetricConfig; wellness: WellnessDay[]; period: Period }) {
  const data = useMemo(() => {
    if (period === "week") return buildRawData(wellness.slice(-7), metric);
    if (period === "month") return buildWeekData(wellness.slice(-90), metric);
    return buildMonthData(wellness, metric);
  }, [wellness, metric, period]);

  if (data.length === 0) return null;

  const periodLabel = period === "week" ? "Diese Woche" : period === "month" ? "Letzte 3 Monate (Ø/Woche)" : "Letztes Jahr (Ø/Monat)";

  return (
    <div className="p-4 rounded-2xl border border-dash-border bg-dash-card">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-dash-muted uppercase tracking-wider font-medium">{metric.label}</span>
        <span className="text-[10px] text-dash-muted/60">{periodLabel}</span>
      </div>
      {/* Current value */}
      {data.length > 0 && (
        <p className="text-xl font-bold tabular-nums mb-3" style={{ color: metric.color }}>
          {data[data.length - 1].value}{metric.unit}
        </p>
      )}
      <ResponsiveContainer width="100%" height={100}>
        {metric.type === "bar" ? (
          <BarChart data={data} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
            <XAxis dataKey="dateLabel" tick={TICK_STYLE} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={TICK_STYLE} tickLine={false} axisLine={false} domain={metric.domain ?? ["auto", "auto"]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#e2e8f0" }} formatter={(v) => [`${v}${metric.unit}`, metric.label]} />
            <Bar dataKey="value" fill={metric.color} radius={[3, 3, 0, 0]} />
          </BarChart>
        ) : (
          <LineChart data={data} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
            <XAxis dataKey="dateLabel" tick={TICK_STYLE} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={TICK_STYLE} tickLine={false} axisLine={false} domain={metric.domain ?? ["auto", "auto"]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#e2e8f0" }} formatter={(v) => [`${v}${metric.unit}`, metric.label]} />
            <Line type="monotone" dataKey="value" stroke={metric.color} strokeWidth={2} dot={false} connectNulls />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

const PERIODS: { key: Period; label: string; days: number }[] = [
  { key: "week", label: "Woche", days: 7 },
  { key: "month", label: "Monat", days: 90 },
  { key: "year", label: "Jahr", days: 365 },
];

export default function WellnessPage() {
  const [period, setPeriod] = useState<Period>("month");
  const days = PERIODS.find((p) => p.key === period)?.days ?? 90;
  const { data: wellness, loading, error, refetch } = useWellness(days);

  return (
    <>
      <header className="sticky top-0 z-10 bg-dash-bg/95 backdrop-blur border-b border-dash-border px-6 py-3 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-white">Wellness</h1>
        <div className="flex items-center gap-3">
          {/* Zeitraum-Tabs */}
          <div className="flex items-center gap-1 bg-dash-card border border-dash-border rounded-xl p-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={clsx(
                  "text-[11px] px-3 py-1 rounded-lg transition-colors",
                  period === p.key ? "bg-indigo-600 text-white" : "text-dash-muted hover:text-white"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={refetch}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-dash-border text-dash-muted hover:text-white hover:border-indigo-500/50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      {error && (
        <div className="mx-6 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">{error}</div>
      )}

      <div className="p-6 max-w-[1400px]">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {METRICS.map((m) => (
              <MiniChart key={m.key as string} metric={m} wellness={wellness} period={period} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
