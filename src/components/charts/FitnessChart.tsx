"use client";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { WellnessDay } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

interface Props {
  wellnessData: WellnessDay[];
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

export default function FitnessChart({ wellnessData }: Props) {
  const chartData = wellnessData
    .filter((d) => d.ctl != null || d.atl != null)
    .map((d) => ({
      date: d.id,
      dateLabel: format(parseISO(d.id), "dd.MM.", { locale: de }),
      CTL: d.ctl != null ? parseFloat(d.ctl.toFixed(1)) : null,
      ATL: d.atl != null ? parseFloat(d.atl.toFixed(1)) : null,
      TSB: d.ctl != null && d.atl != null ? parseFloat((d.ctl - d.atl).toFixed(1)) : null,
    }));

  const latest = chartData[chartData.length - 1];

  return (
    <div className="flex flex-col p-5 rounded-xl border border-dash-border bg-dash-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-dash-muted uppercase tracking-wider">Fitness-Trend (CTL / ATL / TSB)</span>
        {latest && (
          <div className="flex gap-4 text-xs">
            <span>CTL <span className="text-blue-400 font-semibold tabular-nums">{latest.CTL ?? "–"}</span></span>
            <span>ATL <span className="text-red-400 font-semibold tabular-nums">{latest.ATL ?? "–"}</span></span>
            <span>TSB <span className={`font-semibold tabular-nums ${(latest.TSB ?? 0) >= 0 ? "text-emerald-400" : "text-orange-400"}`}>{latest.TSB ?? "–"}</span></span>
          </div>
        )}
      </div>

      <div className="text-[10px] text-dash-muted mb-3">
        CTL = Fitness (42-Tage-EMA) · ATL = Ermüdung (7-Tage-EMA) · TSB = Form (CTL − ATL)
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
          <defs>
            <linearGradient id="tsbGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
          <XAxis
            dataKey="dateLabel"
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            domain={["auto", "auto"]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8", paddingTop: 8 }} />
          <ReferenceLine y={0} stroke="#94a3b8" strokeOpacity={0.3} />
          <Area
            type="monotone"
            dataKey="TSB"
            name="TSB (Form)"
            stroke="#10b981"
            fill="url(#tsbGrad)"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="CTL"
            name="CTL (Fitness)"
            stroke="#3b82f6"
            strokeWidth={2.5}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="ATL"
            name="ATL (Ermüdung)"
            stroke="#ef4444"
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
