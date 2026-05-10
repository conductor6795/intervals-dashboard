"use client";
import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { WellnessDay } from "@/lib/types";
import { getHRV, calcTrainingReadiness } from "@/lib/calculations";

// ── Types & constants ─────────────────────────────────────────────────────────

type ComparePeriod = "7d" | "30d" | "3m" | "6m";

const COMPARE_PERIODS: { id: ComparePeriod; label: string; days: number }[] = [
  { id: "7d",  label: "7T",   days: 7   },
  { id: "30d", label: "30T",  days: 30  },
  { id: "3m",  label: "3M",   days: 90  },
  { id: "6m",  label: "6M",   days: 180 },
];

// ── Metric definitions ────────────────────────────────────────────────────────

interface MetricDef {
  id: string;
  label: string;
  unit: string;
  higherIsBetter: boolean;
  neutral?: boolean;    // show arrow without colour judgement
  decimals: number;
  getValue: (periodDays: WellnessDay[], allDays: WellnessDay[]) => number | null;
}

function avgOf(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null && !isNaN(v));
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

const METRICS: MetricDef[] = [
  {
    id: "hrv",
    label: "HRV (Ø täglich)",
    unit: "ms",
    higherIsBetter: true,
    decimals: 1,
    getValue: (d) => avgOf(d.map(getHRV)),
  },
  {
    id: "rhr",
    label: "Ruhepuls",
    unit: "bpm",
    higherIsBetter: false,
    decimals: 0,
    getValue: (d) => avgOf(d.map((x) => x.restingHR ?? null)),
  },
  {
    id: "sleepScore",
    label: "Schlaf-Score",
    unit: "/100",
    higherIsBetter: true,
    decimals: 0,
    getValue: (d) => avgOf(d.map((x) => x.sleepScore ?? null)),
  },
  {
    id: "sleepH",
    label: "Schlafdauer",
    unit: "h",
    higherIsBetter: true,
    decimals: 1,
    getValue: (d) => avgOf(d.map((x) => x.sleepSecs != null ? x.sleepSecs / 3600 : null)),
  },
  {
    id: "ctl",
    label: "CTL (Fitness)",
    unit: "",
    higherIsBetter: true,
    decimals: 1,
    getValue: (d) => avgOf(d.map((x) => x.ctl ?? null)),
  },
  {
    id: "tsb",
    label: "TSB (Form)",
    unit: "",
    neutral: true,
    higherIsBetter: true,
    decimals: 1,
    getValue: (d) =>
      avgOf(d.map((x) => x.ctl != null && x.atl != null ? x.ctl - x.atl : null)),
  },
  {
    id: "readiness",
    label: "Trainingsbereitschaft",
    unit: "/100",
    higherIsBetter: true,
    decimals: 0,
    // Computed per-day with correct history context, then averaged
    getValue: (periodDays, allDays) =>
      avgOf(
        periodDays.map((day) => {
          const idx = allDays.findIndex((d) => d.id === day.id);
          return idx === -1 ? null : calcTrainingReadiness(day, allDays.slice(0, idx + 1));
        }),
      ),
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtValue(v: number | null, decimals: number): string {
  return v != null ? v.toFixed(decimals) : "–";
}

function deltaColour(
  delta: number | null,
  higherIsBetter: boolean,
  neutral?: boolean,
): string {
  if (delta == null || Math.abs(delta) < 0.05) return "text-dash-muted";
  if (neutral) return "text-dash-muted";
  return (higherIsBetter ? delta > 0 : delta < 0) ? "text-emerald-400" : "text-red-400";
}

function deltaText(delta: number | null, decimals: number): string {
  if (delta == null || Math.abs(delta) < 0.005) return "±0";
  const arrow = delta > 0 ? "↑" : "↓";
  return `${arrow} ${Math.abs(delta).toFixed(decimals)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  days: WellnessDay[];
}

export default function PeriodComparison({ days }: Props) {
  const [period, setPeriod] = useState<ComparePeriod>("30d");
  const n = COMPARE_PERIODS.find((p) => p.id === period)!.days;

  const sorted = useMemo(
    () => [...days].sort((a, b) => a.id.localeCompare(b.id)),
    [days],
  );

  const currentPeriod  = useMemo(() => sorted.slice(-n),         [sorted, n]);
  const previousPeriod = useMemo(() => sorted.slice(-2 * n, -n), [sorted, n]);

  const rows = useMemo(() => {
    return METRICS.map((metric) => {
      const current  = metric.getValue(currentPeriod,  sorted);
      const previous = metric.getValue(previousPeriod, sorted);
      const delta    = current != null && previous != null ? current - previous : null;
      const pct      = delta != null && previous != null && Math.abs(previous) > 0.1
        ? (delta / Math.abs(previous)) * 100 : null;
      return { metric, current, previous, delta, pct };
    }).filter(({ current, previous }) => current != null || previous != null);
  }, [sorted, currentPeriod, previousPeriod]);

  const hasPrevious = previousPeriod.length > 0;

  const dateRange = (arr: WellnessDay[]) =>
    arr.length > 0 ? `${arr[0].id} – ${arr[arr.length - 1].id}` : "–";

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[10px] text-dash-muted uppercase tracking-wider font-medium">
            Zeitraum vergleichen
          </span>
          <div className="flex items-center gap-1 bg-dash-card border border-dash-border rounded-xl p-1">
            {COMPARE_PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={clsx(
                  "text-[11px] px-2.5 py-1 rounded-lg transition-colors font-medium",
                  period === p.id ? "text-white" : "text-dash-muted hover:text-white",
                )}
                style={period === p.id ? { backgroundColor: "var(--a-600)" } : {}}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {hasPrevious && (
          <div className="flex items-center gap-2 text-[10px] text-dash-muted">
            <span className="px-2 py-1 rounded-lg border border-dash-border bg-dash-card/60">
              {dateRange(previousPeriod)}
            </span>
            <span>→</span>
            <span className="px-2 py-1 rounded-lg border border-dash-border bg-dash-card/60">
              {dateRange(currentPeriod)}
            </span>
          </div>
        )}
      </div>

      {/* No-data state */}
      {!hasPrevious ? (
        <div className="p-6 rounded-2xl border border-dash-border bg-dash-card flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-white font-medium mb-1">
              Nicht genug Daten
            </p>
            <p className="text-xs text-dash-muted">
              Mindestens <strong className="text-white">{n * 2} Wellness-Tage</strong> benötigt.{" "}
              Wähle eine kürzere Periode oder lade mehr Verlaufsdaten.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dash-border overflow-x-auto">
          <table className="w-full text-xs min-w-[520px]">
            <thead>
              <tr className="bg-dash-card border-b border-dash-border">
                <th className="px-4 py-3 text-left text-[10px] text-dash-muted uppercase tracking-wider font-medium w-[35%]">
                  Metrik
                </th>
                <th className="px-4 py-3 text-right text-[10px] text-dash-muted uppercase tracking-wider font-medium">
                  Vorheriger Zeitraum
                </th>
                <th className="px-4 py-3 text-right text-[10px] text-dash-muted uppercase tracking-wider font-medium">
                  Dieser Zeitraum
                </th>
                <th className="px-4 py-3 text-right text-[10px] text-dash-muted uppercase tracking-wider font-medium w-[22%]">
                  Änderung
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ metric, current, previous, delta, pct }, i) => (
                <tr
                  key={metric.id}
                  className={clsx(
                    "transition-colors hover:bg-white/[0.02]",
                    i > 0 && "border-t border-dash-border",
                  )}
                >
                  <td className="px-4 py-3 text-dash-muted font-medium">
                    {metric.label}
                  </td>

                  {/* Previous */}
                  <td className="px-4 py-3 text-right tabular-nums text-white/50">
                    {fmtValue(previous, metric.decimals)}
                    {previous != null && metric.unit && (
                      <span className="text-dash-muted/60 ml-0.5 text-[10px]">
                        {metric.unit}
                      </span>
                    )}
                  </td>

                  {/* Current */}
                  <td className="px-4 py-3 text-right tabular-nums text-white font-semibold">
                    {fmtValue(current, metric.decimals)}
                    {current != null && metric.unit && (
                      <span className="text-dash-muted font-normal ml-0.5 text-[10px]">
                        {metric.unit}
                      </span>
                    )}
                  </td>

                  {/* Delta */}
                  <td className={clsx(
                    "px-4 py-3 text-right tabular-nums font-semibold",
                    deltaColour(delta, metric.higherIsBetter, metric.neutral),
                  )}>
                    {deltaText(delta, metric.decimals)}
                    {pct != null && Math.abs(pct) >= 0.5 && (
                      <span className="ml-1.5 text-[10px] opacity-60 font-normal">
                        {Math.abs(pct) < 10
                          ? `${Math.abs(pct).toFixed(1)}%`
                          : `${Math.round(Math.abs(pct))}%`}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-2 text-[10px] text-dash-muted/50">
        Ø-Werte der jeweiligen Periode. Trainingsbereitschaft tagesgenau berechnet.
        TSB-Änderung neutral dargestellt (kein Gut/Schlecht).
      </p>
    </div>
  );
}
