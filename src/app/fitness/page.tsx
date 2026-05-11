"use client";
import { useState, useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { clsx } from "clsx";
import {
  ComposedChart, Bar, Line, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { format, parseISO, startOfWeek } from "date-fns";
import { de } from "date-fns/locale";

import { useWellness } from "@/hooks/useWellness";
import { useActivities, useEvents } from "@/hooks/useActivities";
import { buildProgression, findProjectedPeak } from "@/lib/progression";
import { WellnessDay, Activity } from "@/lib/types";
import { usePeriod } from "@/hooks/usePeriod";
import PeriodSelector from "@/components/ui/PeriodSelector";
import GlossaryTooltip from "@/components/ui/Tooltip";

// ── Shared helpers ────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-2xl bg-dash-card border border-dash-border", className)} />;
}

function StatBadge({ label, value, color, sub }: { label: React.ReactNode; value: string; color: string; sub?: string }) {
  return (
    <div className="bg-dash-card border border-dash-border rounded-2xl p-4">
      <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-2">{label}</p>
      <p className={clsx("text-2xl font-bold tabular-nums", color)}>{value}</p>
      {sub && <p className="text-[10px] text-dash-muted mt-1">{sub}</p>}
    </div>
  );
}

const TOOLTIP_STYLE = {
  backgroundColor: "var(--dash-card)",
  border: "1px solid var(--dash-border)",
  borderRadius: 10,
  fontSize: 11,
};

// ── Strain + Hours weekly aggregation ────────────────────────────────────────

interface StrainHoursPoint {
  weekLabel: string;
  hours: number;
  avgStrain: number | null;
}

function buildStrainAndHoursData(
  wellness: WellnessDay[],
  activities: Activity[],
): StrainHoursPoint[] {
  // Activity hours per week
  const hoursByWeek = new Map<string, number>();
  for (const a of activities) {
    const key = format(
      startOfWeek(parseISO(a.start_date_local), { weekStartsOn: 1 }),
      "yyyy-MM-dd",
    );
    hoursByWeek.set(key, (hoursByWeek.get(key) ?? 0) + (a.moving_time ?? 0) / 3600);
  }

  // Average daily strain per week (strain ?? ctlLoad; exclude rest days with 0/null)
  const strainByWeek = new Map<string, { sum: number; count: number }>();
  for (const d of wellness) {
    const val = d.strain ?? d.ctlLoad ?? null;
    if (val == null || val <= 0) continue;
    const key = format(
      startOfWeek(parseISO(d.id), { weekStartsOn: 1 }),
      "yyyy-MM-dd",
    );
    const entry = strainByWeek.get(key) ?? { sum: 0, count: 0 };
    entry.sum += val;
    entry.count += 1;
    strainByWeek.set(key, entry);
  }

  // Union of all weeks that have at least activity hours
  const allKeys = new Set([
    ...hoursByWeek.keys(),
    ...strainByWeek.keys(),
  ]);

  return Array.from(allKeys)
    .sort()
    .map((key) => {
      const strainEntry = strainByWeek.get(key);
      return {
        weekLabel: format(parseISO(key), "dd.MM.", { locale: de }),
        hours: parseFloat((hoursByWeek.get(key) ?? 0).toFixed(1)),
        avgStrain: strainEntry
          ? parseFloat((strainEntry.sum / strainEntry.count).toFixed(1))
          : null,
      };
    })
    .filter((p) => p.hours > 0 || p.avgStrain != null);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FitnessPage() {
  const { period, setPeriod, days } = usePeriod("3m");
  const [showProgression, setShowProgression] = useState(true);

  const { data: wellness, loading: wLoading, error, refetch } = useWellness(days);
  const { activities, loading: aLoading } = useActivities(days);
  const { events } = useEvents();

  const loading = wLoading || aLoading;

  const today     = wellness[wellness.length - 1];
  const latestCTL = today?.ctl;
  const latestATL = today?.atl;
  const latestTSB = latestCTL != null && latestATL != null ? latestCTL - latestATL : null;

  const rampRate = useMemo(() => {
    if (wellness.length < 8) return null;
    const prev = wellness[wellness.length - 8]?.ctl;
    const curr = latestCTL;
    if (prev == null || curr == null) return null;
    return curr - prev;
  }, [wellness, latestCTL]);

  const { points: allPoints, lastPlannedDate } = useMemo(
    () => buildProgression(wellness, events),
    [wellness, events],
  );
  const peak = useMemo(() => findProjectedPeak(allPoints), [allPoints]);

  const historicalData = allPoints.filter((p) => !p.isProjected);
  const projectedData  = allPoints.filter((p) => p.isProjected);

  const chartData = useMemo(() => {
    const historical = historicalData.map((p) => ({
      dateLabel: p.dateLabel,
      CTL: p.ctl,
      ATL: p.atl,
      TSB: p.tsb,
      CTL_proj: null as number | null,
      ATL_proj: null as number | null,
      TSB_proj: null as number | null,
    }));

    if (!showProgression) return historical;

    if (historical.length > 0) {
      const last = historical[historical.length - 1];
      last.CTL_proj = last.CTL;
      last.ATL_proj = last.ATL;
      last.TSB_proj = last.TSB;
    }

    const projected = projectedData.map((p) => ({
      dateLabel: p.dateLabel,
      CTL: null as number | null,
      ATL: null as number | null,
      TSB: null as number | null,
      CTL_proj: p.ctl,
      ATL_proj: p.atl,
      TSB_proj: p.tsb,
    }));

    return [...historical, ...projected];
  }, [historicalData, projectedData, showProgression]);

  const strainHoursData = useMemo(
    () => buildStrainAndHoursData(wellness, activities),
    [wellness, activities],
  );

  // Does the strain data actually contain any non-null strain values?
  const hasStrainData = strainHoursData.some((p) => p.avgStrain != null);

  const hasProjection = projectedData.length > 0;

  return (
    <>
      <header className="sticky top-0 z-10 bg-dash-bg/95 backdrop-blur border-b border-dash-border px-6 py-3 flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-sm font-semibold text-white">Fitness-Trend</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <PeriodSelector value={period} onChange={setPeriod} />
          <button
            onClick={refetch}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-dash-border text-dash-muted hover:text-white disabled:opacity-50 transition-colors"
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

      <div className="p-6 space-y-6 max-w-[1400px]">

        {/* ── Aktuelle Werte ────────────────────────────────────────────── */}
        <section>
          <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-4">Aktuelle Werte</p>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatBadge
                label={<GlossaryTooltip term="CTL">CTL (Fitness)</GlossaryTooltip>}
                value={latestCTL != null ? latestCTL.toFixed(1) : "–"}
                color="text-blue-400"
              />
              <StatBadge
                label={<GlossaryTooltip term="ATL">ATL (Ermüdung)</GlossaryTooltip>}
                value={latestATL != null ? latestATL.toFixed(1) : "–"}
                color="text-orange-400"
              />
              <StatBadge
                label={<GlossaryTooltip term="TSB">TSB (Form)</GlossaryTooltip>}
                value={latestTSB != null ? latestTSB.toFixed(1) : "–"}
                color={latestTSB != null && latestTSB >= 0 ? "text-emerald-400" : "text-orange-400"}
                sub={latestTSB != null
                  ? (latestTSB >= 5 ? "Frisch – Wettkampfbereit" : latestTSB >= 0 ? "Neutral" : "Ermüdet")
                  : undefined}
              />
              <StatBadge
                label="Ramp Rate (7T)"
                value={rampRate != null ? `${rampRate > 0 ? "+" : ""}${rampRate.toFixed(1)}` : "–"}
                color={rampRate != null
                  ? (Math.abs(rampRate) <= 7 ? "text-emerald-400" : "text-yellow-400")
                  : "text-white"}
                sub={rampRate != null
                  ? (Math.abs(rampRate) <= 7 ? "Gesunder Aufbau" : "Hohe Änderungsrate")
                  : undefined}
              />
            </div>
          )}
        </section>

        {/* ── PMC Chart ─────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium">
              <GlossaryTooltip term="PMC">Performance Management Chart</GlossaryTooltip>
            </p>
            {!loading && hasProjection && (
              <div className="flex items-center gap-3">
                {showProgression && lastPlannedDate && (
                  <span className="text-[10px] text-dash-muted">
                    Prognose bis <span className="text-white">{lastPlannedDate}</span>
                  </span>
                )}
                <button
                  onClick={() => setShowProgression((v) => !v)}
                  className={clsx(
                    "flex items-center gap-2 text-[11px] px-3 py-1.5 rounded-xl border transition-colors",
                    showProgression
                      ? "border-indigo-500/60 bg-indigo-500/10 text-indigo-400"
                      : "border-dash-border text-dash-muted hover:text-white",
                  )}
                >
                  <span className={clsx(
                    "w-7 h-4 rounded-full flex items-center transition-colors",
                    showProgression ? "bg-indigo-600 justify-end pr-0.5" : "bg-dash-border justify-start pl-0.5",
                  )}>
                    <span className="w-3 h-3 rounded-full bg-white shadow-sm" />
                  </span>
                  Prognose
                </button>
              </div>
            )}
          </div>

          {showProgression && peak && !loading && (
            <div className="mb-4 p-3 rounded-xl border border-indigo-500/25 bg-indigo-500/5 flex items-center gap-3">
              <span className="text-base">📈</span>
              <p className="text-xs text-dash-muted">
                Projizierter Fitness-Peak am{" "}
                <span className="text-white font-medium">{peak.date}</span>
                {" · "}CTL ~<span className="text-indigo-400 font-medium">{peak.ctl.toFixed(0)}</span>
                {" · "}Gestrichelte Linien = Prognose
              </p>
            </div>
          )}

          {loading ? (
            <Skeleton className="h-80" />
          ) : (
            <div className="bg-dash-card border border-dash-border rounded-2xl p-5">
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tsbGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--dash-border)" />
                  <XAxis dataKey="dateLabel" tick={{ fill: "var(--dash-muted)", fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: "var(--dash-muted)", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#e2e8f0" }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "var(--dash-muted)", paddingTop: 8 }} />
                  <ReferenceLine y={0} stroke="var(--dash-muted)" strokeOpacity={0.3} />

                  <Area type="monotone" dataKey="TSB" name="TSB (Form)" stroke="#10b981" fill="url(#tsbGrad)" strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="CTL" name="CTL (Fitness)" stroke="#3b82f6" strokeWidth={2.5} dot={false} connectNulls />
                  <Line type="monotone" dataKey="ATL" name="ATL (Ermüdung)" stroke="#f97316" strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls />

                  {showProgression && (
                    <>
                      <Line type="monotone" dataKey="CTL_proj" name="CTL Prognose" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="6 4" dot={false} connectNulls legendType="none" />
                      <Line type="monotone" dataKey="ATL_proj" name="ATL Prognose" stroke="#f97316" strokeWidth={1.5} strokeDasharray="6 4" dot={false} connectNulls legendType="none" />
                      <Line type="monotone" dataKey="TSB_proj" name="TSB Prognose" stroke="#10b981" strokeWidth={1.5} strokeDasharray="6 4" dot={false} connectNulls legendType="none" />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* ── Strain & Aktivitätsdauer ───────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium">
              Strain &amp; Gesamtaktivitätsdauer — wöchentlich
            </p>
            {!hasStrainData && !loading && (
              <span className="text-[10px] text-dash-muted italic">
                Kein Strain-Feld in Wellness-Daten — Balken zeigen Stunden
              </span>
            )}
          </div>

          {loading ? (
            <Skeleton className="h-56" />
          ) : strainHoursData.length === 0 ? (
            <div className="bg-dash-card border border-dash-border rounded-2xl p-8 flex items-center justify-center">
              <p className="text-xs text-dash-muted">Keine Daten im gewählten Zeitraum</p>
            </div>
          ) : (
            <div className="bg-dash-card border border-dash-border rounded-2xl p-5">
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart
                  data={strainHoursData}
                  margin={{ top: 4, right: 8, left: -24, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--dash-border)" />
                  <XAxis
                    dataKey="weekLabel"
                    tick={{ fill: "var(--dash-muted)", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  {/* Left: training hours */}
                  <YAxis
                    yAxisId="hours"
                    tick={{ fill: "var(--dash-muted)", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                    unit="h"
                  />
                  {/* Right: avg strain */}
                  <YAxis
                    yAxisId="strain"
                    orientation="right"
                    tick={{ fill: "var(--dash-muted)", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                    hide={!hasStrainData}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={{ color: "#e2e8f0" }}
                    formatter={(value: number, name: string) => {
                      if (name === "Stunden") return [`${value.toFixed(1)} h`, name];
                      if (name === "Ø Strain") return [value.toFixed(1), name];
                      return [value, name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: "var(--dash-muted)", paddingTop: 8 }} />

                  {/* Bars: training hours */}
                  <Bar
                    yAxisId="hours"
                    dataKey="hours"
                    name="Stunden"
                    fill="#475569"
                    fillOpacity={0.85}
                    radius={[3, 3, 0, 0]}
                  />

                  {/* Line: average daily strain (only if data exists) */}
                  {hasStrainData && (
                    <Line
                      yAxisId="strain"
                      type="monotone"
                      dataKey="avgStrain"
                      name="Ø Strain"
                      stroke="#f97316"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#f97316", strokeWidth: 0 }}
                      connectNulls
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* ── Legende ───────────────────────────────────────────────────── */}
        <section className="p-5 rounded-2xl border border-dash-border bg-dash-card/50">
          <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-3">Erklärung</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs text-dash-muted">
            <div>
              <p className="text-blue-400 font-medium mb-1">CTL – Chronic Training Load</p>
              <p>42-Tage-EMA. Langfristige Fitness. Gesunder Aufbau: &lt; 7 CTL/Woche.</p>
            </div>
            <div>
              <p className="text-orange-400 font-medium mb-1">ATL – Acute Training Load</p>
              <p>7-Tage-EMA. Kurzfristige Ermüdung. Nach intensiven Blöcken erhöht.</p>
            </div>
            <div>
              <p className="text-emerald-400 font-medium mb-1">TSB – Training Stress Balance</p>
              <p>CTL − ATL. Negativ = ermüdet, positiv = frisch. Für Wettkämpfe ideal: +5 bis +20.</p>
            </div>
            <div>
              <p className="text-orange-400 font-medium mb-1">Strain (orange Linie)</p>
              <p>Durchschnittlicher täglicher Trainingsbelastungswert pro Woche (ctlLoad / Strain-Feld aus Wellness-API).</p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
