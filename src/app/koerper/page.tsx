"use client";
import { useState, useEffect, useMemo } from "react";
import { RefreshCw, Scale } from "lucide-react";
import { clsx } from "clsx";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";
import { format, parseISO, subDays, addDays, differenceInDays } from "date-fns";
import { de } from "date-fns/locale";

import { useWellness } from "@/hooks/useWellness";
import { usePeriod } from "@/hooks/usePeriod";
import PeriodSelector from "@/components/ui/PeriodSelector";
import { WellnessDay } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChartPoint {
  date: string;
  dateLabel: string;
  weight: number | null;
  ma7: number | null;
  trend: number | null;
}

interface GoalStats {
  currentWeight: number;
  goalWeight: number;
  remainingKg: number;
  remainingDays: number;
  dailyKcal: number;
  goalReached: boolean;
}

// ── Data builders ─────────────────────────────────────────────────────────────

function buildChartData(
  wellness: WellnessDay[],
  displayDays: number,
  goalDateStr?: string,
): { chartData: ChartPoint[]; currentMa7: number | null; trendSlope: number | null } {
  const sorted = [...wellness].sort((a, b) => a.id.localeCompare(b.id));
  const allWithWeight = sorted.filter((d) => d.weight != null);

  if (allWithWeight.length === 0) {
    return { chartData: [], currentMa7: null, trendSlope: null };
  }

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const startStr = format(subDays(new Date(), displayDays - 1), "yyyy-MM-dd");

  // 7-day moving average: mean of all weight entries in the 7 calendar days up to `forDateStr`
  function calcMa7(forDateStr: string): number | null {
    const windowStart = format(subDays(parseISO(forDateStr), 6), "yyyy-MM-dd");
    const vals = allWithWeight
      .filter((d) => d.id >= windowStart && d.id <= forDateStr)
      .map((d) => d.weight!);
    return vals.length >= 2
      ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2))
      : null;
  }

  // Build historical points for the display window
  const displaySlice = sorted.filter((d) => d.id >= startStr && d.id <= todayStr);

  const points: ChartPoint[] = displaySlice.map((day) => ({
    date: day.id,
    dateLabel: format(parseISO(day.id), "dd.MM.", { locale: de }),
    weight: day.weight ?? null,
    ma7: calcMa7(day.id),
    trend: null,
  }));

  const currentMa7 = [...points].reverse().find((p) => p.ma7 != null)?.ma7 ?? null;

  // Linear regression over last 30 weight data points (all-time, for better accuracy)
  const regData = allWithWeight.slice(-30);
  if (regData.length < 3) {
    return { chartData: points, currentMa7, trendSlope: null };
  }

  const baseDateStr = regData[0].id;
  const pts = regData.map((d) => ({
    x: differenceInDays(parseISO(d.id), parseISO(baseDateStr)),
    y: d.weight!,
  }));
  const n = pts.length;
  const sumX  = pts.reduce((s, p) => s + p.x, 0);
  const sumY  = pts.reduce((s, p) => s + p.y, 0);
  const sumXY = pts.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = pts.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { chartData: points, currentMa7, trendSlope: null };

  const slope     = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  function projectedWeight(dateStr: string): number {
    const x = differenceInDays(parseISO(dateStr), parseISO(baseDateStr));
    return parseFloat((intercept + slope * x).toFixed(2));
  }

  // Add projection line if goalDate is in the future
  if (goalDateStr && goalDateStr > todayStr) {
    const lastMa7Idx = points.reduce((last, p, i) => (p.ma7 != null ? i : last), -1);

    if (lastMa7Idx >= 0) {
      // Anchor the trend line at the last MA7 point so the two lines connect visually
      points[lastMa7Idx].trend = points[lastMa7Idx].ma7;

      let curr = addDays(parseISO(points[lastMa7Idx].date), 1);
      while (format(curr, "yyyy-MM-dd") <= goalDateStr) {
        const currStr   = format(curr, "yyyy-MM-dd");
        const projValue = projectedWeight(currStr);
        const existing  = points.find((p) => p.date === currStr);
        if (existing) {
          existing.trend = projValue;
        } else {
          points.push({
            date: currStr,
            dateLabel: format(curr, "dd.MM.", { locale: de }),
            weight: null,
            ma7: null,
            trend: projValue,
          });
        }
        curr = addDays(curr, 1);
      }

      points.sort((a, b) => a.date.localeCompare(b.date));
    }
  }

  return { chartData: points, currentMa7, trendSlope: slope };
}

function computeGoalStats(
  currentMa7: number | null,
  goalWeightStr: string,
  goalDateStr: string,
): GoalStats | null {
  if (!currentMa7 || !goalWeightStr || !goalDateStr) return null;
  const goalWeight = parseFloat(goalWeightStr);
  if (isNaN(goalWeight)) return null;

  const todayStr      = format(new Date(), "yyyy-MM-dd");
  const remainingDays = differenceInDays(parseISO(goalDateStr), parseISO(todayStr));
  if (remainingDays <= 0) return null;

  const remainingKg = parseFloat((currentMa7 - goalWeight).toFixed(1));
  const goalReached = Math.abs(remainingKg) < 0.5;
  const dailyKcal   = goalReached
    ? 0
    : Math.round((Math.abs(remainingKg) * 7700) / remainingDays);

  return { currentWeight: currentMa7, goalWeight, remainingKg, remainingDays, dailyKcal, goalReached };
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  backgroundColor: "#131929",
  border: "1px solid #1e2d4a",
  borderRadius: 8,
  fontSize: 11,
};
const TICK_STYLE = { fill: "#94a3b8", fontSize: 10 };

// ── Sub-components ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function WeightTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const entries = (payload as Array<{ name: string; value: number | null; color: string }>)
    .filter((p) => p.value != null);
  if (entries.length === 0) return null;
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2 space-y-0.5">
      <p className="text-white/60 text-[10px] mb-1">{label}</p>
      {entries.map((e) => (
        <p key={e.name} style={{ color: e.color }} className="font-medium text-[11px]">
          {e.name}: {Number(e.value).toFixed(1)} kg
        </p>
      ))}
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={clsx("animate-pulse rounded-2xl bg-dash-card border border-dash-border", className)} />
  );
}

function StatCard({
  label,
  value,
  unit,
  color,
  sub,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
  sub?: string;
}) {
  return (
    <div className="bg-dash-card border border-dash-border rounded-2xl p-4 flex flex-col justify-between min-h-[96px]">
      <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium">{label}</p>
      <div>
        <div className="flex items-end gap-1">
          <span className={clsx("text-2xl font-bold tabular-nums leading-none", color)}>
            {value}
          </span>
          <span className="text-dash-muted text-xs pb-0.5">{unit}</span>
        </div>
        {sub && <p className="text-[10px] text-dash-muted/60 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function KoerperPage() {
  const { period, setPeriod, days } = usePeriod("30d");
  // Fetch 2 years so MA7 and regression are accurate across all period views
  const { data: wellness, loading, error, refetch } = useWellness(730);

  const [goalWeight, setGoalWeight] = useState("");
  const [goalDate, setGoalDate]     = useState("");

  useEffect(() => {
    setGoalWeight(localStorage.getItem("body-goal-weight") ?? "");
    setGoalDate(localStorage.getItem("body-goal-date") ?? "");
  }, []);

  const handleGoalWeight = (v: string) => {
    setGoalWeight(v);
    v ? localStorage.setItem("body-goal-weight", v) : localStorage.removeItem("body-goal-weight");
  };
  const handleGoalDate = (v: string) => {
    setGoalDate(v);
    v ? localStorage.setItem("body-goal-date", v) : localStorage.removeItem("body-goal-date");
  };

  const hasWeightData = useMemo(() => wellness.some((d) => d.weight != null), [wellness]);

  const { chartData, currentMa7, trendSlope } = useMemo(
    () => buildChartData(wellness, days, goalDate || undefined),
    [wellness, days, goalDate],
  );

  const goalStats = useMemo(
    () => computeGoalStats(currentMa7, goalWeight, goalDate),
    [currentMa7, goalWeight, goalDate],
  );

  // Y-axis domain: tight fit around all visible values + optional goal line
  const yDomain = useMemo((): [number | "auto", number | "auto"] => {
    const vals = chartData
      .flatMap((d) => [d.weight, d.ma7, d.trend])
      .filter((v): v is number => v != null);
    const gw = goalWeight ? parseFloat(goalWeight) : NaN;
    if (!isNaN(gw)) vals.push(gw);
    if (vals.length === 0) return ["auto", "auto"];
    return [
      parseFloat((Math.min(...vals) - 0.8).toFixed(1)),
      parseFloat((Math.max(...vals) + 0.8).toFixed(1)),
    ];
  }, [chartData, goalWeight]);

  const goalWeightNum = goalWeight ? parseFloat(goalWeight) : null;

  const slopeGPerDay = trendSlope != null
    ? Math.round(trendSlope * 1000)
    : null;

  return (
    <>
      <header className="sticky top-0 z-10 bg-dash-bg/95 backdrop-blur border-b border-dash-border px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-sm font-semibold text-white">Körper &amp; Ziele</h1>
          <p className="text-[10px] text-dash-muted">Gewichtsverlauf und Zielprojektionen</p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector value={period} onChange={setPeriod} />
          <button
            onClick={refetch}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-dash-border text-dash-muted hover:text-white hover:border-white/30 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      {error && (
        <div className="mx-6 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="p-6 max-w-[900px] space-y-6">

        {/* ── Zielkonfiguration ── */}
        <section>
          <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-3">
            Zielkonfiguration
          </p>
          <div className="rounded-2xl border border-dash-border bg-dash-card p-5">
            <div className="flex flex-wrap gap-6 items-end">
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] text-dash-muted uppercase tracking-wider">
                  Zielgewicht (kg)
                </span>
                <input
                  type="number"
                  step="0.1"
                  min="30"
                  max="250"
                  value={goalWeight}
                  onChange={(e) => handleGoalWeight(e.target.value)}
                  placeholder="z.B. 75.0"
                  className="bg-dash-bg border border-dash-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 w-36 tabular-nums placeholder:text-dash-muted/40"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] text-dash-muted uppercase tracking-wider">
                  Zieldatum
                </span>
                <input
                  type="date"
                  value={goalDate}
                  onChange={(e) => handleGoalDate(e.target.value)}
                  className="bg-dash-bg border border-dash-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 w-44 [color-scheme:dark]"
                />
              </label>

              {slopeGPerDay != null && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-dash-muted uppercase tracking-wider">
                    Aktueller Trend
                  </span>
                  <div className="flex items-center h-[38px]">
                    <span
                      className={clsx(
                        "text-sm font-semibold tabular-nums",
                        slopeGPerDay < 0 ? "text-emerald-400"
                          : slopeGPerDay > 0 ? "text-orange-400"
                          : "text-dash-muted",
                      )}
                    >
                      {slopeGPerDay > 0 ? "+" : ""}
                      {slopeGPerDay} g/Tag
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Gewichtsentwicklung ── */}
        <section>
          <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-3">
            Gewichtsentwicklung
          </p>

          {loading ? (
            <Skeleton className="h-[340px]" />
          ) : !hasWeightData ? (
            <div className="rounded-2xl border border-dash-border bg-dash-card p-10 flex flex-col items-center gap-3 text-center">
              <Scale size={30} className="text-dash-muted/40" />
              <div>
                <p className="text-sm font-medium text-white mb-1">Keine Gewichtsdaten</p>
                <p className="text-xs text-dash-muted max-w-xs">
                  Gewicht in intervals.icu erfassen:{" "}
                  <span className="text-white/70">Wellness → Körpergewicht täglich eintragen.</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dash-border bg-dash-card p-5">
              {/* Legend */}
              <div className="flex items-center gap-5 mb-4 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-400/70" />
                  <span className="text-[10px] text-dash-muted">Messung</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-0.5 bg-yellow-400 rounded" />
                  <span className="text-[10px] text-dash-muted">7-Tage-Ø</span>
                </div>
                {goalDate && goalDate > format(new Date(), "yyyy-MM-dd") && (
                  <div className="flex items-center gap-1.5">
                    <svg width="20" height="4">
                      <line x1="0" y1="2" x2="20" y2="2" stroke="#60a5fa" strokeWidth="2" strokeDasharray="5 3" />
                    </svg>
                    <span className="text-[10px] text-dash-muted">Projektion</span>
                  </div>
                )}
              </div>

              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={chartData} margin={{ top: 8, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
                  <XAxis
                    dataKey="dateLabel"
                    tick={TICK_STYLE}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={TICK_STYLE}
                    tickLine={false}
                    axisLine={false}
                    domain={yDomain}
                    width={40}
                    tickFormatter={(v: number) => v.toFixed(1)}
                  />
                  <Tooltip content={<WeightTooltip />} cursor={{ stroke: "#334155", strokeWidth: 1 }} />

                  {/* Goal weight horizontal reference line */}
                  {goalWeightNum != null && !isNaN(goalWeightNum) && (
                    <ReferenceLine
                      y={goalWeightNum}
                      stroke="#eab308"
                      strokeDasharray="4 3"
                      strokeOpacity={0.35}
                      label={{
                        value: `Ziel ${goalWeightNum.toFixed(1)} kg`,
                        position: "insideTopRight",
                        fill: "#ca8a04",
                        fontSize: 10,
                        dy: -6,
                      }}
                    />
                  )}

                  {/* Today reference line (when projection extends beyond today) */}
                  {goalDate && goalDate > format(new Date(), "yyyy-MM-dd") && (
                    <ReferenceLine
                      x={format(new Date(), "dd.MM.", { locale: de })}
                      stroke="#475569"
                      strokeWidth={1}
                      strokeDasharray="3 3"
                    />
                  )}

                  {/* Scatter-like dots for individual measurements */}
                  <Line
                    type="linear"
                    dataKey="weight"
                    name="Messung"
                    stroke="transparent"
                    strokeWidth={0}
                    dot={{ r: 3.5, fill: "#94a3b8", strokeWidth: 0, fillOpacity: 0.75 }}
                    activeDot={{ r: 5, fill: "#e2e8f0", strokeWidth: 0 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />

                  {/* 7-day moving average — yellow solid */}
                  <Line
                    type="monotone"
                    dataKey="ma7"
                    name="7-Tage-Ø"
                    stroke="#eab308"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4, fill: "#eab308", strokeWidth: 0 }}
                    connectNulls
                    isAnimationActive={false}
                  />

                  {/* Projection — blue dashed */}
                  <Line
                    type="monotone"
                    dataKey="trend"
                    name="Projektion"
                    stroke="#60a5fa"
                    strokeWidth={1.5}
                    strokeDasharray="6 3"
                    dot={false}
                    activeDot={{ r: 4, fill: "#60a5fa", strokeWidth: 0 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* ── Ziel-Progression ── */}
        {!loading && (goalStats ? (
          <section>
            <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-3">
              Ziel-Progression
            </p>
            {goalStats.goalReached ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
                <p className="text-sm font-semibold text-emerald-400">Ziel erreicht!</p>
                <p className="text-xs text-dash-muted mt-1">
                  Dein aktuelles Trendgewicht liegt bei deinem Zielgewicht.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="Trend-Gewicht"
                  value={goalStats.currentWeight.toFixed(1)}
                  unit="kg"
                  color="text-yellow-400"
                />
                <StatCard
                  label="Zielgewicht"
                  value={goalStats.goalWeight.toFixed(1)}
                  unit="kg"
                  color="text-blue-400"
                />
                <StatCard
                  label="Verbleibend"
                  value={`${goalStats.remainingKg > 0 ? "−" : "+"}${Math.abs(goalStats.remainingKg).toFixed(1)}`}
                  unit="kg"
                  color={goalStats.remainingKg > 0 ? "text-orange-400" : "text-emerald-400"}
                  sub={`${goalStats.remainingDays} Tage`}
                />
                <StatCard
                  label={goalStats.remainingKg > 0 ? "Kaloriendefizit" : "Kalorienüberschuss"}
                  value={goalStats.dailyKcal.toLocaleString("de-DE")}
                  unit="kcal/Tag"
                  color="text-purple-400"
                  sub="Schätzwert (7700 kcal/kg)"
                />
              </div>
            )}
          </section>
        ) : goalWeight && goalDate && hasWeightData ? (
          <p className="text-xs text-dash-muted/60 text-center">
            Zieldatum liegt in der Vergangenheit – bitte ein zukünftiges Datum wählen.
          </p>
        ) : null)}

      </div>
    </>
  );
}
