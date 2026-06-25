"use client";
import { useState, useMemo } from "react";
import { clsx } from "clsx";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import {
  format, parseISO,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  subWeeks, subMonths, subQuarters, startOfQuarter, endOfQuarter,
  isWithinInterval,
} from "date-fns";
import { de } from "date-fns/locale";
import { useWellness } from "@/hooks/useWellness";
import { WellnessDay } from "@/lib/types";
import { getHRV, buildDailyMetrics } from "@/lib/calculations";

function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-2xl bg-dash-card border border-dash-border", className)} />;
}

interface MetricDef {
  id: string;
  label: string;
  color: string;
  colorB: string;
  unit: string;
  getValue: (d: WellnessDay, idx: number, all: WellnessDay[]) => number | null;
}

const METRICS: MetricDef[] = [
  { id: "hrv",      label: "HRV (täglich)",     color: "#6366f1", colorB: "#a5b4fc", unit: "ms",  getValue: (d) => getHRV(d) },
  { id: "hrv7",     label: "HRV7 (Ø 7T)",       color: "#818cf8", colorB: "#c7d2fe", unit: "ms",  getValue: (_, i, all) => buildDailyMetrics(all.slice(0, i + 1)).slice(-1)[0]?.hrv7 ?? null },
  { id: "rhr",      label: "Ruhepuls",           color: "#ef4444", colorB: "#fca5a5", unit: "bpm", getValue: (d) => d.restingHR ?? null },
  { id: "ctl",      label: "CTL (Fitness)",      color: "#3b82f6", colorB: "#93c5fd", unit: "",    getValue: (d) => d.ctl ?? null },
  { id: "atl",      label: "ATL (Ermüdung)",     color: "#f97316", colorB: "#fdba74", unit: "",    getValue: (d) => d.atl ?? null },
  { id: "tsb",      label: "TSB (Form)",         color: "#10b981", colorB: "#6ee7b7", unit: "",    getValue: (d) => (d.ctl != null && d.atl != null) ? d.ctl - d.atl : null },
  { id: "sleep",    label: "Schlaf (h)",         color: "#22d3ee", colorB: "#a5f3fc", unit: "h",   getValue: (d) => d.sleepSecs != null ? parseFloat((d.sleepSecs / 3600).toFixed(2)) : null },
  { id: "sleeps",   label: "Schlaf-Score",       color: "#0ea5e9", colorB: "#7dd3fc", unit: "",    getValue: (d) => d.sleepScore ?? null },
  { id: "weight",   label: "Gewicht (kg)",       color: "#a78bfa", colorB: "#ddd6fe", unit: "kg",  getValue: (d) => d.weight ?? null },
];

const PERIODS_TWO = [
  { label: "2 Wo.", days: 14 },
  { label: "30 T.", days: 30 },
  { label: "90 T.", days: 90 },
  { label: "6 Mo.", days: 180 },
];

type CompareMode = "two-metrics" | "timeframe";
type TimeframePreset = "week" | "month" | "quarter" | "custom";

const TIMEFRAME_PRESETS: { id: TimeframePreset; label: string }[] = [
  { id: "week",    label: "Diese Woche / Letzte" },
  { id: "month",   label: "Dieser Monat / Letzter" },
  { id: "quarter", label: "Dieses Quartal / Letztes" },
  { id: "custom",  label: "Benutzerdefiniert" },
];

function getPresetRanges(preset: Exclude<TimeframePreset, "custom">): {
  a: { start: Date; end: Date };
  b: { start: Date; end: Date };
} {
  const today = new Date();
  switch (preset) {
    case "week":
      return {
        a: { start: startOfWeek(today, { weekStartsOn: 1 }), end: today },
        b: {
          start: startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 }),
          end: endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 }),
        },
      };
    case "month":
      return {
        a: { start: startOfMonth(today), end: today },
        b: {
          start: startOfMonth(subMonths(today, 1)),
          end: endOfMonth(subMonths(today, 1)),
        },
      };
    case "quarter":
      return {
        a: { start: startOfQuarter(today), end: today },
        b: {
          start: startOfQuarter(subQuarters(today, 1)),
          end: endOfQuarter(subQuarters(today, 1)),
        },
      };
  }
}

function filterPeriod(wellness: WellnessDay[], start: Date, end: Date) {
  return wellness.filter((d) => {
    const date = parseISO(d.id);
    return isWithinInterval(date, { start, end });
  });
}

const TOOLTIP_STYLE = {
  backgroundColor: "var(--dash-card)",
  border: "1px solid var(--dash-border)",
  borderRadius: 10,
  fontSize: 11,
};

const selectCls =
  "w-full bg-dash-bg border border-dash-border rounded-xl px-3 py-2 text-xs text-white " +
  "appearance-none cursor-pointer focus:outline-none focus:border-indigo-500 transition-colors";

const dateCls =
  "w-full bg-dash-bg border border-dash-border rounded-xl px-3 py-2 text-xs text-white " +
  "focus:outline-none focus:border-indigo-500 transition-colors [color-scheme:dark]";

export default function ComparePage() {
  const [mode, setMode] = useState<CompareMode>("two-metrics");
  const [period, setPeriod] = useState(30);
  const [metric1Id, setMetric1Id] = useState("hrv");
  const [metric2Id, setMetric2Id] = useState("ctl");

  const [tfMetricId, setTfMetricId] = useState("hrv");
  const [tfPreset, setTfPreset] = useState<TimeframePreset>("month");
  const [customA, setCustomA] = useState({ start: "", end: "" });
  const [customB, setCustomB] = useState({ start: "", end: "" });

  const { data: wellnessShort, loading: l1, error: e1 } = useWellness(period);
  const { data: wellnessLong, loading: l2, error: e2 } = useWellness(400);

  const loading = mode === "two-metrics" ? l1 : l2;
  const error = e1 ?? e2;

  const metric1 = METRICS.find((m) => m.id === metric1Id)!;
  const metric2 = METRICS.find((m) => m.id === metric2Id)!;
  const tfMetric = METRICS.find((m) => m.id === tfMetricId)!;

  const twoMetricsData = useMemo(() => {
    return wellnessShort.map((d, i) => ({
      dateLabel: format(parseISO(d.id), "dd.MM.", { locale: de }),
      [metric1Id]: metric1.getValue(d, i, wellnessShort),
      [metric2Id]: metric2.getValue(d, i, wellnessShort),
    }));
  }, [wellnessShort, metric1Id, metric2Id, metric1, metric2]);

  const timeframeData = useMemo(() => {
    const today = new Date();
    const fallbackA = { start: startOfMonth(today), end: today };
    const fallbackB = { start: startOfMonth(subMonths(today, 1)), end: endOfMonth(subMonths(today, 1)) };

    let ranges: { a: { start: Date; end: Date }; b: { start: Date; end: Date } };
    if (tfPreset === "custom") {
      ranges = {
        a: {
          start: customA.start ? new Date(customA.start) : fallbackA.start,
          end: customA.end ? new Date(customA.end) : fallbackA.end,
        },
        b: {
          start: customB.start ? new Date(customB.start) : fallbackB.start,
          end: customB.end ? new Date(customB.end) : fallbackB.end,
        },
      };
    } else {
      ranges = getPresetRanges(tfPreset);
    }

    const periodA = filterPeriod(wellnessLong, ranges.a.start, ranges.a.end);
    const periodB = filterPeriod(wellnessLong, ranges.b.start, ranges.b.end);
    const maxLen = Math.max(periodA.length, periodB.length);

    const rows = Array.from({ length: maxLen }, (_, i) => ({
      day: `T+${i + 1}`,
      periodA: periodA[i] != null ? tfMetric.getValue(periodA[i], i, periodA) : null,
      periodB: periodB[i] != null ? tfMetric.getValue(periodB[i], i, periodB) : null,
    }));

    const fmtD = (d: Date) => format(d, "dd.MM.yy", { locale: de });
    return {
      rows,
      labelA: `${fmtD(ranges.a.start)} – ${fmtD(ranges.a.end)}`,
      labelB: `${fmtD(ranges.b.start)} – ${fmtD(ranges.b.end)}`,
    };
  }, [wellnessLong, tfMetricId, tfPreset, tfMetric, customA, customB]);

  const stats = useMemo(() => {
    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

    if (mode === "two-metrics") {
      const v1 = twoMetricsData.map((d) => d[metric1Id] as number | null).filter((v): v is number => v != null);
      const v2 = twoMetricsData.map((d) => d[metric2Id] as number | null).filter((v): v is number => v != null);
      return {
        a: { avg: avg(v1), min: v1.length ? Math.min(...v1) : null, max: v1.length ? Math.max(...v1) : null, label: metric1.label, unit: metric1.unit, color: metric1.color },
        b: { avg: avg(v2), min: v2.length ? Math.min(...v2) : null, max: v2.length ? Math.max(...v2) : null, label: metric2.label, unit: metric2.unit, color: metric2.color },
      };
    } else {
      const vA = timeframeData.rows.map((d) => d.periodA).filter((v): v is number => v != null);
      const vB = timeframeData.rows.map((d) => d.periodB).filter((v): v is number => v != null);
      return {
        a: { avg: avg(vA), min: vA.length ? Math.min(...vA) : null, max: vA.length ? Math.max(...vA) : null, label: timeframeData.labelA, unit: tfMetric.unit, color: tfMetric.color },
        b: { avg: avg(vB), min: vB.length ? Math.min(...vB) : null, max: vB.length ? Math.max(...vB) : null, label: timeframeData.labelB, unit: tfMetric.unit, color: tfMetric.colorB },
      };
    }
  }, [mode, twoMetricsData, metric1Id, metric2Id, metric1, metric2, timeframeData, tfMetric]);

  const fmt = (v: number | null, unit: string) =>
    v != null ? `${v.toFixed(1)}${unit}` : "–";

  return (
    <>
      <header className="sticky top-0 z-10 bg-dash-bg/95 backdrop-blur border-b border-dash-border px-3 sm:px-6 py-3 flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-sm font-semibold text-white">Vergleich</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-dash-card border border-dash-border rounded-xl p-1">
            {(["two-metrics", "timeframe"] as CompareMode[]).map((m, idx) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={clsx(
                  "text-[11px] px-3 py-1.5 rounded-lg transition-colors",
                  mode === m ? "bg-indigo-600 text-white" : "text-dash-muted hover:text-white"
                )}
              >
                {idx === 0 ? "Zwei Metriken" : "Zeitraum-Vergleich"}
              </button>
            ))}
          </div>
          {mode === "two-metrics" && (
            <div className="flex items-center gap-1 bg-dash-card border border-dash-border rounded-xl p-1">
              {PERIODS_TWO.map((p) => (
                <button
                  key={p.days}
                  onClick={() => setPeriod(p.days)}
                  className={clsx(
                    "text-[11px] px-2.5 py-1 rounded-lg transition-colors",
                    period === p.days ? "bg-indigo-600 text-white" : "text-dash-muted hover:text-white"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {error && (
        <div className="mx-6 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="p-3 sm:p-6 space-y-6 w-full">
        {mode === "two-metrics" ? (
          <>
            <section>
              <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-3">
                Metriken auswählen
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-dash-card border border-dash-border rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: metric1.color }} />
                    <span className="text-xs text-white font-medium">Metrik 1</span>
                  </div>
                  <div className="relative">
                    <select value={metric1Id} onChange={(e) => setMetric1Id(e.target.value)} className={selectCls}>
                      {METRICS.map((m) => (
                        <option key={m.id} value={m.id} disabled={m.id === metric2Id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-dash-muted text-[10px]">▼</div>
                  </div>
                </div>

                <div className="bg-dash-card border border-dash-border rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: metric2.color }} />
                    <span className="text-xs text-white font-medium">Metrik 2</span>
                  </div>
                  <div className="relative">
                    <select value={metric2Id} onChange={(e) => setMetric2Id(e.target.value)} className={selectCls}>
                      {METRICS.map((m) => (
                        <option key={m.id} value={m.id} disabled={m.id === metric1Id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-dash-muted text-[10px]">▼</div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-4">
                {metric1.label} vs. {metric2.label}
              </p>
              {loading ? (
                <Skeleton className="h-72" />
              ) : (
                <div className="bg-dash-card border border-dash-border rounded-2xl p-5">
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={twoMetricsData} margin={{ top: 5, right: 15, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--dash-border)" />
                      <XAxis dataKey="dateLabel" tick={{ fill: "var(--dash-muted)", fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis yAxisId="left" tick={{ fill: "var(--dash-muted)", fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: "var(--dash-muted)", fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#e2e8f0" }} />
                      <Legend wrapperStyle={{ fontSize: 11, color: "var(--dash-muted)", paddingTop: 8 }} />
                      <Line yAxisId="left" type="monotone" dataKey={metric1Id} name={metric1.label} stroke={metric1.color} strokeWidth={2.5} dot={false} connectNulls />
                      <Line yAxisId="right" type="monotone" dataKey={metric2Id} name={metric2.label} stroke={metric2.color} strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            <section>
              <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-3">
                Metrik &amp; Zeitraum
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="bg-dash-card border border-dash-border rounded-2xl p-4">
                  <p className="text-xs text-dash-muted mb-2">Metrik</p>
                  <div className="relative">
                    <select value={tfMetricId} onChange={(e) => setTfMetricId(e.target.value)} className={selectCls}>
                      {METRICS.map((m) => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-dash-muted text-[10px]">▼</div>
                  </div>
                </div>

                <div className="bg-dash-card border border-dash-border rounded-2xl p-4">
                  <p className="text-xs text-dash-muted mb-2">Vergleichsperiode</p>
                  <div className="flex flex-wrap gap-1.5">
                    {TIMEFRAME_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setTfPreset(p.id)}
                        className={clsx(
                          "text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors",
                          tfPreset === p.id
                            ? "bg-indigo-600 border-indigo-500 text-white"
                            : "border-dash-border text-dash-muted hover:text-white"
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {tfPreset === "custom" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-dash-card border border-dash-border rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tfMetric.color }} />
                      <p className="text-xs text-white font-medium">Zeitraum A</p>
                    </div>
                    <div className="space-y-2">
                      <input
                        type="date"
                        value={customA.start}
                        onChange={(e) => setCustomA((p) => ({ ...p, start: e.target.value }))}
                        className={dateCls}
                      />
                      <input
                        type="date"
                        value={customA.end}
                        onChange={(e) => setCustomA((p) => ({ ...p, end: e.target.value }))}
                        className={dateCls}
                      />
                    </div>
                  </div>

                  <div className="bg-dash-card border border-dash-border rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tfMetric.colorB }} />
                      <p className="text-xs text-white font-medium">Zeitraum B</p>
                    </div>
                    <div className="space-y-2">
                      <input
                        type="date"
                        value={customB.start}
                        onChange={(e) => setCustomB((p) => ({ ...p, start: e.target.value }))}
                        className={dateCls}
                      />
                      <input
                        type="date"
                        value={customB.end}
                        onChange={(e) => setCustomB((p) => ({ ...p, end: e.target.value }))}
                        className={dateCls}
                      />
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section>
              <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-4">
                {tfMetric.label} – Zeitraum-Vergleich (Tag-für-Tag normiert)
              </p>
              {loading ? (
                <Skeleton className="h-72" />
              ) : (
                <div className="bg-dash-card border border-dash-border rounded-2xl p-5">
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={timeframeData.rows} margin={{ top: 5, right: 15, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--dash-border)" />
                      <XAxis dataKey="day" tick={{ fill: "var(--dash-muted)", fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: "var(--dash-muted)", fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#e2e8f0" }} />
                      <Legend wrapperStyle={{ fontSize: 11, color: "var(--dash-muted)", paddingTop: 8 }} />
                      <Line type="monotone" dataKey="periodA" name={timeframeData.labelA} stroke={tfMetric.color} strokeWidth={2.5} dot={false} connectNulls />
                      <Line type="monotone" dataKey="periodB" name={timeframeData.labelB} stroke={tfMetric.colorB} strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          </>
        )}

        {!loading && (
          <section>
            <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-4">Statistiken</p>
            <div className="grid grid-cols-2 gap-4">
              {[stats.a, stats.b].map(({ label, avg, min, max, unit, color }) => (
                <div
                  key={label}
                  className="bg-dash-card border border-dash-border rounded-2xl p-4"
                  style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                >
                  <p className="text-xs font-medium mb-3 truncate" style={{ color }}>{label}</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-dash-muted">Durchschnitt</span>
                      <span className="text-white tabular-nums">{fmt(avg, unit)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-dash-muted">Minimum</span>
                      <span className="text-white tabular-nums">{fmt(min, unit)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-dash-muted">Maximum</span>
                      <span className="text-white tabular-nums">{fmt(max, unit)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
