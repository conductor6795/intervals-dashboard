"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { WellnessDay } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

interface Props {
  wellnessData: WellnessDay[];
}

const CustomTooltip = ({ active, payload, label, unit }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; unit?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#131929] border border-[#1e2d4a] rounded-lg p-3 text-xs space-y-1">
      <p className="text-white font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="text-white tabular-nums">{p.value != null ? `${p.value.toFixed(1)}${unit ?? ""}` : "–"}</span>
        </div>
      ))}
    </div>
  );
};

interface MiniChartProps {
  data: { dateLabel: string; value: number | null }[];
  color: string;
  label: string;
  unit?: string;
  type?: "line" | "bar";
  domain?: [number | "auto", number | "auto"];
}

function MiniChart({ data, color, label, unit = "", type = "line", domain = ["auto", "auto"] }: MiniChartProps) {
  const TooltipWithUnit = (props: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => (
    <CustomTooltip {...props} unit={unit} />
  );

  return (
    <div className="p-4 rounded-xl border border-dash-border bg-dash-card">
      <span className="text-xs text-dash-muted uppercase tracking-wider block mb-3">{label}</span>
      <ResponsiveContainer width="100%" height={120}>
        {type === "bar" ? (
          <BarChart data={data} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
            <XAxis dataKey="dateLabel" tick={{ fill: "#94a3b8", fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 9 }} tickLine={false} axisLine={false} domain={domain} />
            <Tooltip content={<TooltipWithUnit />} />
            <Bar dataKey="value" name={label} fill={color} radius={[2, 2, 0, 0]} />
          </BarChart>
        ) : (
          <LineChart data={data} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
            <XAxis dataKey="dateLabel" tick={{ fill: "#94a3b8", fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 9 }} tickLine={false} axisLine={false} domain={domain} />
            <Tooltip content={<TooltipWithUnit />} />
            <Line type="monotone" dataKey="value" name={label} stroke={color} strokeWidth={2} dot={false} connectNulls />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export default function WellnessChart({ wellnessData }: Props) {
  const fmt = (d: WellnessDay) =>
    format(parseISO(d.id), "dd.MM.", { locale: de });

  const rhrData = wellnessData
    .filter((d) => d.restingHR != null)
    .map((d) => ({ dateLabel: fmt(d), value: d.restingHR! }));

  const weightData = wellnessData
    .filter((d) => d.weight != null)
    .map((d) => ({ dateLabel: fmt(d), value: d.weight! }));

  const sleepData = wellnessData
    .filter((d) => d.sleepSecs != null || d.sleepScore != null)
    .map((d) => ({
      dateLabel: fmt(d),
      value: d.sleepSecs != null ? parseFloat((d.sleepSecs / 3600).toFixed(2)) : null,
    }))
    .filter((d) => d.value != null) as { dateLabel: string; value: number }[];

  const sleepScoreData = wellnessData
    .filter((d) => d.sleepScore != null)
    .map((d) => ({ dateLabel: fmt(d), value: d.sleepScore! }));

  const fatigueData = wellnessData
    .filter((d) => d.fatigue != null)
    .map((d) => ({ dateLabel: fmt(d), value: d.fatigue! }));

  const moodData = wellnessData
    .filter((d) => d.mood != null)
    .map((d) => ({ dateLabel: fmt(d), value: d.mood! }));

  const sorenessData = wellnessData
    .filter((d) => d.soreness != null)
    .map((d) => ({ dateLabel: fmt(d), value: d.soreness! }));

  const motivationData = wellnessData
    .filter((d) => d.motivation != null)
    .map((d) => ({ dateLabel: fmt(d), value: d.motivation! }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {rhrData.length > 0 && (
          <MiniChart data={rhrData} color="#ef4444" label="Ruhepuls (bpm)" unit=" bpm" />
        )}
        {weightData.length > 0 && (
          <MiniChart data={weightData} color="#8b5cf6" label="Gewicht (kg)" unit=" kg" />
        )}
        {sleepData.length > 0 && (
          <MiniChart data={sleepData} color="#3b82f6" label="Schlaf (Stunden)" unit=" h" domain={[4, 10]} />
        )}
        {sleepScoreData.length > 0 && (
          <MiniChart data={sleepScoreData} color="#06b6d4" label="Schlaf-Score" domain={[0, 100]} />
        )}
        {fatigueData.length > 0 && (
          <MiniChart data={fatigueData} color="#f97316" label="Ermüdung (1–5)" type="bar" domain={[0, 5]} />
        )}
        {sorenessData.length > 0 && (
          <MiniChart data={sorenessData} color="#f43f5e" label="Muskelkater (1–5)" type="bar" domain={[0, 5]} />
        )}
        {moodData.length > 0 && (
          <MiniChart data={moodData} color="#10b981" label="Stimmung (1–5)" type="bar" domain={[0, 5]} />
        )}
        {motivationData.length > 0 && (
          <MiniChart data={motivationData} color="#a3e635" label="Motivation (1–5)" type="bar" domain={[0, 5]} />
        )}
      </div>
    </div>
  );
}
