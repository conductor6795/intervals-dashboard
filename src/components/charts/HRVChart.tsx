"use client";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { WellnessDay, DayMetrics } from "@/lib/types";
import { getHRV } from "@/lib/calculations";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

interface Props {
  wellnessData: WellnessDay[];
  dailyMetrics: DayMetrics[];
}

interface ChartPoint {
  date: string;
  dateLabel: string;
  hrv: number | null;
  hrv7: number | null;
  cv: number | null;
  trendRatio: number | null;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#131929] border border-[#1e2d4a] rounded-lg p-3 text-xs space-y-1">
      <p className="text-white font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="text-white tabular-nums font-medium">
            {p.value != null ? p.value.toFixed(1) : "–"}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function HRVChart({ wellnessData, dailyMetrics }: Props) {
  const chartData: ChartPoint[] = wellnessData.map((day, i) => ({
    date: day.id,
    dateLabel: format(parseISO(day.id), "dd.MM.", { locale: de }),
    hrv: getHRV(day),
    hrv7: dailyMetrics[i]?.hrv7 ?? null,
    cv: dailyMetrics[i]?.cv ?? null,
    trendRatio: dailyMetrics[i]?.trendRatio ?? null,
  }));

  const hrv7Last = dailyMetrics[dailyMetrics.length - 1]?.hrv7;

  return (
    <div className="flex flex-col p-5 rounded-xl border border-dash-border bg-dash-card">
      <div className="flex justify-between items-center mb-4">
        <span className="text-xs text-dash-muted uppercase tracking-wider">HRV / HRV7 / CV</span>
        {hrv7Last && (
          <span className="text-xs text-dash-muted">
            HRV7: <span className="text-white font-medium">{hrv7Last.toFixed(1)}</span>
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
          <XAxis
            dataKey="dateLabel"
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="hrv"
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            domain={["auto", "auto"]}
          />
          <YAxis
            yAxisId="cv"
            orientation="right"
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            domain={[0, 20]}
            unit="%"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "#94a3b8", paddingTop: 8 }}
          />
          {hrv7Last && (
            <ReferenceLine
              y={hrv7Last}
              yAxisId="hrv"
              stroke="#6366f1"
              strokeDasharray="4 2"
              strokeOpacity={0.4}
            />
          )}
          <Bar dataKey="hrv" name="HRV (tägl.)" yAxisId="hrv" fill="#6366f1" opacity={0.35} radius={[2, 2, 0, 0]} />
          <Line
            type="monotone"
            dataKey="hrv7"
            name="HRV7"
            yAxisId="hrv"
            stroke="#818cf8"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="cv"
            name="CV %"
            yAxisId="cv"
            stroke="#f59e0b"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Trend Ratio Chart */}
      <div className="mt-4">
        <span className="text-[10px] text-dash-muted uppercase tracking-wider">Trend-Ratio (aktuell / HRV7 × 100)</span>
        <ResponsiveContainer width="100%" height={80}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
            <XAxis dataKey="dateLabel" hide />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              domain={[85, 115]}
            />
            <ReferenceLine y={100} stroke="#6366f1" strokeDasharray="3 2" strokeOpacity={0.6} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="trendRatio"
              name="Trend-Ratio"
              stroke="#34d399"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
