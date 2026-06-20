"use client";
import Link from "next/link";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid } from "recharts";
import { WellnessDay } from "@/lib/types";
import { GarminDay } from "@/hooks/useGarmin";
import { getHRV } from "@/lib/calculations";
import { HRV_CV } from "@/lib/athlete";

export type MetricKey =
  | "hrv" | "rhr" | "cv" | "ctl" | "atl" | "tsb"
  | "sleepScore" | "sleepDur" | "mood" | "fatigue";

export const METRIC_TITLE: Record<MetricKey, string> = {
  hrv: "HRV", rhr: "Ruhepuls", cv: "CV (HRV-Variabilität)",
  ctl: "CTL · Fitness", atl: "ATL · Ermüdung", tsb: "TSB · Form",
  sleepScore: "Schlaf-Score", sleepDur: "Schlafdauer", mood: "Stimmung", fatigue: "Erschöpfung",
};

interface Cfg {
  unit: string;
  hex: string;
  accessor: (d: WellnessDay) => number | null;
  format: (v: number) => string;
  hint: string;
  page: string;
}

const CFG: Record<MetricKey, Cfg> = {
  hrv:    { unit: "ms",  hex: "#f472b6", accessor: getHRV,                         format: (v) => v.toFixed(1), hint: "Herzfrequenzvariabilität. Bei dir v. a. ein Schlaf-/Lifestyle-Signal, kaum Trainingslast.", page: "/hrv" },
  rhr:    { unit: "bpm", hex: "#f87171", accessor: (d) => d.restingHR ?? null,     format: (v) => v.toFixed(0), hint: "Ruheherzfrequenz. Niedriger ist besser; Anstieg = Erholungsdefizit oder Krankheit.", page: "/hrv" },
  cv:     { unit: "%",   hex: "#facc15", accessor: () => null,                     format: (v) => v.toFixed(1), hint: "Rollender 7-Tage-Variationskoeffizient der HRV. Warnzone 12–15 %, > 15 % instabil.", page: "/hrv" },
  ctl:    { unit: "",    hex: "#60a5fa", accessor: (d) => d.ctl ?? null,           format: (v) => v.toFixed(1), hint: "Chronische Last (42-Tage). Deine Fitness-Basis.", page: "/fitness" },
  atl:    { unit: "",    hex: "#fb923c", accessor: (d) => d.atl ?? null,           format: (v) => v.toFixed(1), hint: "Akute Last (7-Tage). Deine aktuelle Ermüdung.", page: "/fitness" },
  tsb:    { unit: "",    hex: "#34d399", accessor: (d) => (d.ctl != null && d.atl != null ? d.ctl - d.atl : null), format: (v) => v.toFixed(1), hint: "Form = CTL − ATL. > 0 frisch, < −20 hoch belastet, < −30 Überlastung.", page: "/fitness" },
  sleepScore: { unit: "", hex: "#60a5fa", accessor: (d) => d.sleepScore ?? null,   format: (v) => v.toFixed(0), hint: "Garmin-Schlaf-Score (0–100).", page: "/wellness" },
  sleepDur:   { unit: "h", hex: "#60a5fa", accessor: (d) => (d.sleepSecs != null ? d.sleepSecs / 3600 : null), format: (v) => v.toFixed(1), hint: "Schlafdauer.", page: "/wellness" },
  mood:    { unit: "/5", hex: "#a78bfa", accessor: (d) => d.mood ?? null,          format: (v) => v.toFixed(0), hint: "Subjektive Stimmung (1–5). Zuverlässiges Frühsignal für Overreaching.", page: "/wellness" },
  fatigue: { unit: "/5", hex: "#fb923c", accessor: (d) => d.fatigue ?? null,       format: (v) => v.toFixed(0), hint: "Subjektive Erschöpfung (1–5).", page: "/wellness" },
};

function fmtDate(id: string) {
  const [, m, day] = id.split("-");
  return `${day}.${m}.`;
}
function hm(secs: number) {
  return `${Math.floor(secs / 3600)}:${String(Math.round((secs % 3600) / 60)).padStart(2, "0")}`;
}

/** Rollender 7-Tage-CV der HRV (für die CV-Metrik). */
function rollingCv(hrvs: (number | null)[]): (number | null)[] {
  return hrvs.map((_, i) => {
    const win = hrvs.slice(Math.max(0, i - 6), i + 1).filter((v): v is number => v != null);
    if (win.length < 3) return null;
    const mean = win.reduce((a, b) => a + b, 0) / win.length;
    if (mean === 0) return null;
    const variance = win.reduce((a, b) => a + (b - mean) ** 2, 0) / win.length;
    return Math.round((Math.sqrt(variance) / mean) * 1000) / 10;
  });
}

function ContextBlock({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
  const visible = rows.filter((r) => r.value !== "–");
  if (visible.length === 0) return null;
  return (
    <div className="rounded-xl border border-dash-border bg-dash-bg p-3">
      <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-2">{title}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {visible.map((r) => (
          <span key={r.label} className="text-xs text-dash-muted">
            {r.label}: <span className="text-white font-medium tabular-nums">{r.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function SleepPhases({ g }: { g: GarminDay }) {
  const deep = g.deepSecs ?? 0, light = g.lightSecs ?? 0, rem = g.remSecs ?? 0, awake = g.awakeSecs ?? 0;
  const total = deep + light + rem + awake;
  if (total === 0) return null;
  const phases = [
    { label: "Tief", secs: deep, color: "#3b4fd4" },
    { label: "Leicht", secs: light, color: "#60a5fa" },
    { label: "REM", secs: rem, color: "#a78bfa" },
    { label: "Wach", secs: awake, color: "#475569" },
  ];
  return (
    <div className="rounded-xl border border-dash-border bg-dash-bg p-3">
      <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-2">Schlafphasen letzte Nacht (Garmin)</p>
      <div className="flex w-full h-3 rounded-full overflow-hidden mb-2.5">
        {phases.map((p) => p.secs > 0 && <div key={p.label} style={{ width: `${(p.secs / total) * 100}%`, backgroundColor: p.color }} />)}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {phases.map((p) => (
          <div key={p.label} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-dash-muted">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />{p.label}
            </span>
            <span className="text-white tabular-nums">{hm(p.secs)} · {Math.round((p.secs / total) * 100)} %</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function garminContext(metric: MetricKey, g: GarminDay | undefined) {
  if (!g) return null;
  const n = (v: number | null | undefined, unit = "") => (v != null ? `${v}${unit}` : "–");

  if (metric === "hrv" || metric === "rhr") {
    return (
      <ContextBlock
        title="Lifestyle-Kontext (Garmin)"
        rows={[
          { label: "Body Battery", value: n(g.bbRecent) },
          { label: "Stress", value: n(g.stressAvg) },
          { label: "Schlaf-Score", value: n(g.sleepScore) },
          ...(metric === "rhr" ? [{ label: "Garmin-RHR", value: n(g.restingHr, " bpm") }] : []),
        ]}
      />
    );
  }
  if (metric === "ctl" || metric === "atl" || metric === "tsb") {
    return (
      <ContextBlock
        title="Last & Zustand (Garmin)"
        rows={[
          { label: "ACWR", value: g.acwr != null ? `${g.acwr.toFixed(2)}${g.acwrStatus ? ` (${g.acwrStatus})` : ""}` : "–" },
          { label: "Trainingszustand", value: g.trainingStatus ?? "–" },
          { label: "Body Battery", value: n(g.bbRecent) },
        ]}
      />
    );
  }
  if (metric === "sleepScore" || metric === "sleepDur") {
    return <SleepPhases g={g} />;
  }
  return null;
}

export default function MetricDetail({
  wellness, garmin, metric,
}: { wellness: WellnessDay[]; garmin: GarminDay[]; metric: MetricKey }) {
  const cfg = CFG[metric];
  const gToday = garmin[garmin.length - 1];

  // Serie aufbauen
  let series: { date: string; v: number | null }[];
  if (metric === "cv") {
    const cvVals = rollingCv(wellness.map(getHRV));
    series = wellness.map((d, i) => ({ date: fmtDate(d.id), v: cvVals[i] }));
  } else {
    series = wellness.map((d) => ({ date: fmtDate(d.id), v: cfg.accessor(d) }));
  }

  const vals = series.map((s) => s.v).filter((v): v is number => v != null);
  const min = vals.length ? Math.min(...vals) : null;
  const max = vals.length ? Math.max(...vals) : null;
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  const fmtU = (v: number) => `${cfg.format(v)}${cfg.unit ? " " + cfg.unit : ""}`;

  return (
    <div className="space-y-5">
      <p className="text-[11px] text-dash-muted">{cfg.hint}</p>

      {/* Verlauf */}
      <div className="h-44 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 4, right: 6, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id={`md-${metric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={cfg.hex} stopOpacity={0.35} />
                <stop offset="100%" stopColor={cfg.hex} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1e2d4a" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#64748b" }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
            <YAxis tick={{ fontSize: 9, fill: "#64748b" }} tickLine={false} axisLine={false} width={34} domain={["auto", "auto"]} />
            <RTooltip
              contentStyle={{ background: "#131929", border: "1px solid #1e2d4a", borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: "#94a3b8" }} itemStyle={{ color: "#fff" }}
              formatter={(val: number) => [fmtU(val), METRIC_TITLE[metric]]}
            />
            <Area type="monotone" dataKey="v" stroke={cfg.hex} strokeWidth={1.8} fill={`url(#md-${metric})`} connectNulls dot={false} isAnimationActive={false} />
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

      {/* Garmin-Kontext (Daten, die nicht in intervals stehen) */}
      {garminContext(metric, gToday)}

      {/* Letzte Tage */}
      <div>
        <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-2">Letzte Tage</p>
        <div className="space-y-0">
          {series.slice(-7).reverse().map((s, i) => (
            <div key={`${s.date}-${i}`} className="flex justify-between items-center py-1.5 border-b border-dash-border last:border-0 text-xs">
              <span className="text-dash-muted">{s.date}</span>
              <span className="text-white tabular-nums font-medium">{s.v != null ? fmtU(s.v) : "–"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Link zur Vollseite */}
      <Link href={cfg.page} className="block text-center text-[11px] text-accent hover:opacity-80 transition-opacity pt-1">
        Zur Vollansicht →
      </Link>
    </div>
  );
}
