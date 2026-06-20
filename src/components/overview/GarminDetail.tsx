"use client";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid } from "recharts";
import { GarminDay } from "@/hooks/useGarmin";

export type GarminMetric = "bb" | "stress" | "sleep" | "rhr" | "acwr" | "vo2";

interface MetricCfg {
  title: string;
  unit: string;
  hex: string;
  accessor: (d: GarminDay) => number | null;
  format: (v: number) => string;
  hint: string;
}

export const GARMIN_METRIC_TITLE: Record<GarminMetric, string> = {
  bb: "Body Battery",
  stress: "Stress",
  sleep: "Schlaf",
  rhr: "Ruhepuls",
  acwr: "ACWR",
  vo2: "VO₂max",
};

const CFG: Record<GarminMetric, MetricCfg> = {
  bb:     { title: "Body Battery", unit: "",    hex: "#34d399", accessor: (d) => d.bbHigh,    format: (v) => v.toFixed(0), hint: "Tagespeak der Energiereserve (0–100)." },
  stress: { title: "Stress",       unit: "",    hex: "#fb923c", accessor: (d) => d.stressAvg, format: (v) => v.toFixed(0), hint: "Tagesdurchschnitt der Stressbelastung (0–100, niedriger ist besser)." },
  sleep:  { title: "Schlaf",       unit: "h",   hex: "#60a5fa", accessor: (d) => (d.sleepSecs != null ? d.sleepSecs / 3600 : null), format: (v) => v.toFixed(1), hint: "Schlafdauer und -phasen der letzten Nacht." },
  rhr:    { title: "Ruhepuls",     unit: "bpm", hex: "#f87171", accessor: (d) => d.restingHr, format: (v) => v.toFixed(0), hint: "Ruheherzfrequenz (niedriger ist besser)." },
  acwr:   { title: "ACWR",         unit: "",    hex: "#facc15", accessor: (d) => d.acwr,      format: (v) => v.toFixed(2), hint: "Acute:Chronic Workload Ratio — akute vs. chronische Last." },
  vo2:    { title: "VO₂max",       unit: "",    hex: "#818cf8", accessor: (d) => d.vo2maxCycling, format: (v) => v.toFixed(1), hint: "Geschätzte maximale Sauerstoffaufnahme (Rad)." },
};

function fmtDate(d: string) {
  const [, m, day] = d.split("-");
  return `${day}.${m}.`;
}
function hm(secs: number) {
  return `${Math.floor(secs / 3600)}:${String(Math.round((secs % 3600) / 60)).padStart(2, "0")}`;
}

function SleepPhases({ day }: { day: GarminDay }) {
  const deep = day.deepSecs ?? 0;
  const light = day.lightSecs ?? 0;
  const rem = day.remSecs ?? 0;
  const awake = day.awakeSecs ?? 0;
  const total = deep + light + rem + awake;
  if (total === 0) return null;
  const phases = [
    { label: "Tief", secs: deep, color: "#3b4fd4" },
    { label: "Leicht", secs: light, color: "#60a5fa" },
    { label: "REM", secs: rem, color: "#a78bfa" },
    { label: "Wach", secs: awake, color: "#475569" },
  ];
  return (
    <div>
      <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-2">Schlafphasen letzte Nacht</p>
      <div className="flex w-full h-3 rounded-full overflow-hidden mb-2.5">
        {phases.map((p) => p.secs > 0 && (
          <div key={p.label} style={{ width: `${(p.secs / total) * 100}%`, backgroundColor: p.color }} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {phases.map((p) => (
          <div key={p.label} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-dash-muted">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              {p.label}
            </span>
            <span className="text-white tabular-nums">{hm(p.secs)} · {Math.round((p.secs / total) * 100)} %</span>
          </div>
        ))}
      </div>
      {day.sleepScore != null && (
        <p className="text-[11px] text-dash-muted mt-2.5">Schlaf-Score: <span className="text-white font-medium">{day.sleepScore}</span></p>
      )}
    </div>
  );
}

export default function GarminDetail({ days, metric }: { days: GarminDay[]; metric: GarminMetric }) {
  const cfg = CFG[metric];
  const series = days.map((d) => ({ date: fmtDate(d.date), v: cfg.accessor(d) }));
  const vals = series.map((s) => s.v).filter((v): v is number => v != null);
  const min = vals.length ? Math.min(...vals) : null;
  const max = vals.length ? Math.max(...vals) : null;
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  const today = days[days.length - 1];

  const fmtUnit = (v: number) => `${cfg.format(v)}${cfg.unit ? " " + cfg.unit : ""}`;

  return (
    <div className="space-y-5">
      <p className="text-[11px] text-dash-muted">{cfg.hint}</p>

      {/* Verlauf */}
      <div className="h-44 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 4, right: 6, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id={`gd-${metric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={cfg.hex} stopOpacity={0.35} />
                <stop offset="100%" stopColor={cfg.hex} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1e2d4a" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#64748b" }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20} />
            <YAxis tick={{ fontSize: 9, fill: "#64748b" }} tickLine={false} axisLine={false} width={34} domain={["auto", "auto"]} />
            <RTooltip
              contentStyle={{ background: "#131929", border: "1px solid #1e2d4a", borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: "#94a3b8" }}
              itemStyle={{ color: "#fff" }}
              formatter={(val: number) => [fmtUnit(val), cfg.title]}
            />
            <Area type="monotone" dataKey="v" stroke={cfg.hex} strokeWidth={1.8} fill={`url(#gd-${metric})`} connectNulls dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Min / Ø / Max */}
      <div className="grid grid-cols-3 gap-2">
        {([["Min", min], ["Ø", avg], ["Max", max]] as const).map(([label, v]) => (
          <div key={label} className="bg-dash-bg rounded-xl p-2.5 text-center">
            <p className="text-[10px] text-dash-muted uppercase tracking-wider">{label}</p>
            <p className="text-base font-bold tabular-nums text-white">
              {v != null ? cfg.format(v) : "–"}
              {cfg.unit && <span className="text-[10px] text-dash-muted ml-0.5">{cfg.unit}</span>}
            </p>
          </div>
        ))}
      </div>

      {/* Schlafphasen */}
      {metric === "sleep" && today && <SleepPhases day={today} />}

      {/* ACWR-Kontext */}
      {metric === "acwr" && today?.acwrStatus && (
        <p className="text-[11px] text-dash-muted">
          Status heute: <span className="text-white font-medium">{today.acwrStatus}</span> · Optimalfenster ~0,8–1,3 · &lt; 0,8 detrainiert, &gt; 1,5 erhöhtes Risiko.
        </p>
      )}

      {/* Garmin-Trainingszustand als Kontext bei Last-/Form-Metriken */}
      {today?.trainingStatus && (metric === "bb" || metric === "acwr" || metric === "vo2") && (
        <p className="text-[11px] text-dash-muted">
          Garmin-Trainingszustand: <span className="text-white font-medium">{today.trainingStatus}</span>
        </p>
      )}

      {/* Letzte Tage */}
      <div>
        <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-2">Letzte Tage</p>
        <div className="space-y-0">
          {[...days].slice(-7).reverse().map((d) => {
            const v = cfg.accessor(d);
            return (
              <div key={d.date} className="flex justify-between items-center py-1.5 border-b border-dash-border last:border-0 text-xs">
                <span className="text-dash-muted">{fmtDate(d.date)}</span>
                <span className="text-white tabular-nums font-medium">{v != null ? fmtUnit(v) : "–"}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
