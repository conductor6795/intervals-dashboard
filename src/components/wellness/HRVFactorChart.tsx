"use client";
import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, Cell, LabelList, ResponsiveContainer,
} from "recharts";
import { WellnessDay, Activity } from "@/lib/types";
import { getHRV } from "@/lib/calculations";

interface Props {
  wellness: WellnessDay[];
  activities: Activity[];
}

interface FactorResult {
  label: string;
  labelA: string;
  labelB: string;
  effect: number;
  countA: number;
  countB: number;
  avgA: number;
  avgB: number;
}

type Group = "a" | "b" | null;

interface FactorDef {
  label: string;
  labelA: string;
  labelB: string;
  classify(day: WellnessDay, acts: Activity[]): Group;
}

const MIN_N = 5;

const FACTOR_DEFS: FactorDef[] = [
  {
    label: "Rennrad Vortag",
    labelA: "Rennrad",
    labelB: "Kein Rennrad",
    classify: (_, acts) =>
      acts.some((a) => a.type === "Ride" || a.type === "VirtualRide") ? "a" : "b",
  },
  {
    label: "Gym Vortag",
    labelA: "Gym/Kraft",
    labelB: "Kein Gym",
    classify: (_, acts) =>
      acts.some((a) => a.type === "WeightTraining" || a.type === "Workout") ? "a" : "b",
  },
  {
    label: "Laufen Vortag",
    labelA: "Laufen",
    labelB: "Kein Laufen",
    classify: (_, acts) =>
      acts.some((a) => a.type === "Run" || a.type === "VirtualRun") ? "a" : "b",
  },
  {
    label: "Mobility Vortag",
    labelA: "Mobility",
    labelB: "Keine Mobility",
    classify: (_, acts) =>
      acts.some(
        (a) =>
          a.type === "Yoga" ||
          a.type.toLowerCase().includes("mobility") ||
          a.type.toLowerCase().includes("stretch"),
      ) ? "a" : "b",
  },
  {
    label: "Schlaf ≥ 7h",
    labelA: "≥ 7h",
    labelB: "< 7h",
    classify: (day) => {
      if (day.sleepSecs == null) return null;
      return day.sleepSecs >= 7 * 3600 ? "a" : "b";
    },
  },
  {
    label: "RHR niedrig vs. hoch",
    labelA: "RHR < 55",
    labelB: "RHR > 60",
    classify: (day) => {
      if (day.restingHR == null) return null;
      if (day.restingHR < 55) return "a";
      if (day.restingHR > 60) return "b";
      return null;
    },
  },
  {
    label: "Training-Uhrzeit",
    labelA: "< 12 Uhr",
    labelB: "> 18 Uhr",
    classify: (_, acts) => {
      if (acts.length === 0) return null;
      const first = [...acts].sort((a, b) =>
        a.start_date_local.localeCompare(b.start_date_local),
      )[0];
      const hourStr = first.start_date_local.slice(11, 13);
      if (!hourStr || hourStr.length < 2) return null;
      const hour = parseInt(hourStr, 10);
      if (hour < 12) return "a";
      if (hour >= 18) return "b";
      return null;
    },
  },
  // ── Activity intensity ──────────────────────────────────────────────────────
  {
    label: "Lange Ausfahrt Vortag (>2h)",
    labelA: ">2h Rennrad",
    labelB: "Kurze/keine Ausfahrt",
    classify: (_, acts) =>
      acts.some(
        (a) =>
          (a.type === "Ride" || a.type === "VirtualRide") &&
          (a.moving_time ?? 0) > 7200,
      ) ? "a" : "b",
  },
  {
    label: "Ruhetag Vortag",
    labelA: "Kein Training",
    labelB: "Training",
    classify: (_, acts) => (acts.length === 0 ? "a" : "b"),
  },
  // ── Subjective wellness (previous day) ─────────────────────────────────────
  {
    label: "Erschöpfung Vortag",
    labelA: "Hoch (≥4)",
    labelB: "Niedrig (≤2)",
    classify: (day) => {
      if (day.fatigue == null) return null;
      if (day.fatigue >= 4) return "a";
      if (day.fatigue <= 2) return "b";
      return null;
    },
  },
  {
    label: "Muskelkater Vortag",
    labelA: "Hoch (≥4)",
    labelB: "Kein (≤2)",
    classify: (day) => {
      if (day.soreness == null) return null;
      if (day.soreness >= 4) return "a";
      if (day.soreness <= 2) return "b";
      return null;
    },
  },
  {
    label: "Stimmung Vortag",
    labelA: "Schlecht (≤2)",
    labelB: "Gut (≥4)",
    classify: (day) => {
      if (day.mood == null) return null;
      if (day.mood <= 2) return "a";
      if (day.mood >= 4) return "b";
      return null;
    },
  },
];

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function computeFactors(wellness: WellnessDay[], activities: Activity[]): FactorResult[] {
  const actsByDate: Record<string, Activity[]> = {};
  for (const a of activities) {
    const date = a.start_date_local.slice(0, 10);
    if (!actsByDate[date]) actsByDate[date] = [];
    actsByDate[date].push(a);
  }

  const sorted = [...wellness].sort((a, b) => a.id.localeCompare(b.id));
  const results: FactorResult[] = [];

  for (const def of FACTOR_DEFS) {
    const groupA: number[] = [];
    const groupB: number[] = [];

    for (let i = 0; i < sorted.length - 1; i++) {
      const day = sorted[i];
      const nextHRV = getHRV(sorted[i + 1]);
      if (nextHRV == null) continue;

      const g = def.classify(day, actsByDate[day.id] ?? []);
      if (g === "a") groupA.push(nextHRV);
      else if (g === "b") groupB.push(nextHRV);
    }

    if (groupA.length < MIN_N || groupB.length < MIN_N) continue;

    const avgA = mean(groupA);
    const avgB = mean(groupB);
    const effect = parseFloat((avgA - avgB).toFixed(1));

    results.push({
      label: def.label,
      labelA: def.labelA,
      labelB: def.labelB,
      effect,
      countA: groupA.length,
      countB: groupB.length,
      avgA: parseFloat(avgA.toFixed(1)),
      avgB: parseFloat(avgB.toFixed(1)),
    });
  }

  return results.sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
}

const TICK_STYLE = { fill: "#94a3b8", fontSize: 10 };
const TOOLTIP_STYLE = {
  backgroundColor: "#131929",
  border: "1px solid #1e2d4a",
  borderRadius: 8,
  fontSize: 11,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BarLabel(props: any) {
  const { x = 0, y = 0, width = 0, height = 0, value = 0 } = props as {
    x: number; y: number; width: number; height: number; value: number;
  };
  if (Math.abs(value) < 0.05) return null;
  const positive = value >= 0;
  const xPos = positive ? x + width + 6 : x - 6;
  const sign = value > 0 ? "+" : "";
  return (
    <text
      x={xPos}
      y={y + height / 2}
      dy="0.35em"
      textAnchor={positive ? "start" : "end"}
      fill={positive ? "#10b981" : "#ef4444"}
      fontSize={11}
      fontWeight={600}
    >
      {`${sign}${value.toFixed(1)}`}
    </text>
  );
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: FactorResult }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2 space-y-1">
      <p className="text-white font-semibold">{d.label}</p>
      <div className="text-dash-muted space-y-0.5 text-[11px]">
        <p>
          <span className="text-emerald-400">{d.labelA}</span>: Ø {d.avgA} ms ({d.countA} Tage)
        </p>
        <p>
          <span className="text-slate-400">{d.labelB}</span>: Ø {d.avgB} ms ({d.countB} Tage)
        </p>
        <p className="pt-1 border-t border-white/10">
          Effekt:{" "}
          <span className={d.effect >= 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
            {d.effect > 0 ? "+" : ""}
            {d.effect} ms
          </span>
        </p>
      </div>
    </div>
  );
}

export default function HRVFactorChart({ wellness, activities }: Props) {
  const data = useMemo(
    () => computeFactors(wellness, activities),
    [wellness, activities],
  );

  if (data.length === 0) {
    return (
      <div className="p-6 rounded-2xl border border-dash-border bg-dash-card flex items-center justify-center min-h-[120px]">
        <div className="text-center">
          <p className="text-sm text-white font-medium mb-1">Nicht genug Daten</p>
          <p className="text-xs text-dash-muted">
            Mindestens {MIN_N} Datenpunkte pro Gruppe benötigt. Lade mehr Verlaufsdaten.
          </p>
        </div>
      </div>
    );
  }

  const maxAbs = Math.max(...data.map((d) => Math.abs(d.effect)));
  const pad = maxAbs * 0.4;
  const domain: [number, number] = [-(maxAbs + pad), maxAbs + pad];
  const chartHeight = Math.max(200, data.length * 52 + 40);

  return (
    <div className="rounded-2xl border border-dash-border bg-dash-card p-4">
      <p className="text-[10px] text-dash-muted/60 mb-4">
        Durchschnittliche HRV-Differenz (ms) am Folgetag. Positiv = höhere HRV nach diesem Faktor.
        Nur Faktoren mit mind. {MIN_N} Datenpunkten pro Gruppe.
      </p>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 64, left: 8, bottom: 24 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" horizontal={false} />
          <XAxis
            type="number"
            domain={domain}
            tick={TICK_STYLE}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => (v === 0 ? "0" : `${v > 0 ? "+" : ""}${v}`)}
            label={{
              value: "Effekt auf HRV (ms)",
              position: "insideBottom",
              dy: 18,
              fill: "#64748b",
              fontSize: 10,
            }}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={TICK_STYLE}
            tickLine={false}
            axisLine={false}
            width={165}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <ReferenceLine x={0} stroke="#334155" strokeWidth={1.5} />
          <Bar dataKey="effect" maxBarSize={26} radius={3}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.effect >= 0 ? "#10b981" : "#ef4444"}
                fillOpacity={0.8}
              />
            ))}
            <LabelList content={BarLabel} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-3 text-[10px] text-dash-muted/45 italic">
        Alkohol, Ernährung &amp; weitere Faktoren: Erfasse sie als Custom Wellness Fields in
        intervals.icu um sie hier zu sehen.
      </p>
    </div>
  );
}
