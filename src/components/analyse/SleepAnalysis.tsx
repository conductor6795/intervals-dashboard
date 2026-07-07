"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Moon, Sparkles, Repeat, Clock, Wind } from "lucide-react";
import { clsx } from "clsx";

import { WellnessDay } from "@/lib/types";
import { useGarmin, GarminDay } from "@/hooks/useGarmin";
import { calcSleepCoachPlan, formatLocalIsoTime } from "@/lib/sleepCoach";
import { getSleepSettings, DEFAULT_SLEEP_SETTINGS, SleepCoachSettings } from "@/lib/sleepSettings";

interface Night {
  date: string;
  hours: number | null;
  score: number | null;
  deep: number | null;
  light: number | null;
  rem: number | null;
  awake: number | null;
  startMin: number | null;
  endMin: number | null;
  resp: number | null;
}

function mean(a: number[]): number { return a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0; }

function isoMinuteOfDay(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
  if (isNaN(d.getTime())) return null;
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function circularMeanMinutes(minutes: number[]): number | null {
  if (!minutes.length) return null;
  const toRad = (m: number) => (m / 1440) * 2 * Math.PI;
  const sin = mean(minutes.map((m) => Math.sin(toRad(m))));
  const cos = mean(minutes.map((m) => Math.cos(toRad(m))));
  let ang = Math.atan2(sin, cos);
  if (ang < 0) ang += 2 * Math.PI;
  return (ang / (2 * Math.PI)) * 1440;
}

function fmtMin(m: number | null): string {
  if (m == null) return "–";
  const mm = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(mm / 60)).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}`;
}

function buildNights(garmin: GarminDay[], wellness: WellnessDay[]): Night[] {
  const gByDate = new Map(garmin.map((d) => [d.date, d]));
  const wByDate = new Map(wellness.map((d) => [d.id, d]));
  const dates = Array.from(new Set([...gByDate.keys(), ...wByDate.keys()])).sort();
  const out: Night[] = [];
  for (const date of dates) {
    const g = gByDate.get(date);
    const w = wByDate.get(date);
    const secs = g?.sleepSecs ?? w?.sleepSecs ?? null;
    if (secs == null) continue;
    out.push({
      date,
      hours: secs / 3600,
      score: g?.sleepScore ?? w?.sleepScore ?? null,
      deep: g?.deepSecs ?? null,
      light: g?.lightSecs ?? null,
      rem: g?.remSecs ?? null,
      awake: g?.awakeSecs ?? null,
      startMin: isoMinuteOfDay(g?.sleepStartLocal ?? null),
      endMin: isoMinuteOfDay(g?.sleepEndLocal ?? null),
      resp: g?.respirationAvg ?? null,
    });
  }
  return out;
}

function Stat({ label, value, sub, color = "text-white", icon: Icon }: {
  label: string; value: string; sub?: string; color?: string; icon?: React.ElementType;
}) {
  return (
    <div className="bg-dash-bg rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-[10px] text-dash-muted uppercase tracking-wider">
        {Icon && <Icon size={11} />} {label}
      </div>
      <p className={clsx("text-xl font-bold tabular-nums mt-1", color)}>{value}</p>
      {sub && <p className="text-[10px] text-dash-muted mt-0.5">{sub}</p>}
    </div>
  );
}

const TOOLTIP_STYLE = { backgroundColor: "var(--dash-card)", border: "1px solid var(--dash-border)", borderRadius: 10, fontSize: 11 };

export default function SleepAnalysis({ wellness }: { wellness: WellnessDay[] }) {
  const { data: garmin } = useGarmin();
  const [settings, setSettings] = useState<SleepCoachSettings>(DEFAULT_SLEEP_SETTINGS);
  useEffect(() => { setSettings(getSleepSettings()); }, []);

  const nights = useMemo(() => buildNights(garmin, wellness), [garmin, wellness]);
  const plan = useMemo(() => calcSleepCoachPlan(garmin, wellness, settings), [garmin, wellness, settings]);

  if (nights.length === 0) {
    return (
      <div className="rounded-2xl border border-dash-border bg-dash-card p-5">
        <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-2">Schlaf-Analyse</p>
        <p className="text-[12px] text-dash-muted">Noch keine Schlafdaten vorhanden (intervals.icu oder Garmin-Sync).</p>
      </div>
    );
  }

  const last7 = nights.slice(-7);
  const last30 = nights.slice(-30);
  const avgDur7 = mean(last7.map((n) => n.hours).filter((v): v is number => v != null));
  const avgDur30 = mean(last30.map((n) => n.hours).filter((v): v is number => v != null));
  const avgScore30 = mean(last30.map((n) => n.score).filter((v): v is number => v != null));
  const avgResp = mean(last30.map((n) => n.resp).filter((v): v is number => v != null));

  const bedMins = last30.map((n) => n.startMin).filter((v): v is number => v != null);
  const wakeMins = last30.map((n) => n.endMin).filter((v): v is number => v != null);
  const avgBed = circularMeanMinutes(bedMins);
  const avgWake = circularMeanMinutes(wakeMins);

  // Schlafphasen-Durchschnitt (nur Nächte mit Garmin-Phasen)
  const withStages = last30.filter((n) => n.deep != null && n.light != null && n.rem != null);
  const stageAvg = withStages.length ? {
    deep: mean(withStages.map((n) => n.deep as number)),
    light: mean(withStages.map((n) => n.light as number)),
    rem: mean(withStages.map((n) => n.rem as number)),
    awake: mean(withStages.map((n) => n.awake ?? 0)),
  } : null;
  const stageTotal = stageAvg ? stageAvg.deep + stageAvg.light + stageAvg.rem + stageAvg.awake : 0;
  const stages = stageAvg && stageTotal > 0 ? [
    { label: "Tief", secs: stageAvg.deep, color: "#3b4fd4" },
    { label: "Leicht", secs: stageAvg.light, color: "#60a5fa" },
    { label: "REM", secs: stageAvg.rem, color: "#a78bfa" },
    { label: "Wach", secs: stageAvg.awake, color: "#475569" },
  ] : null;

  const chartData = nights.slice(-30).map((n) => ({
    date: `${n.date.slice(8, 10)}.${n.date.slice(5, 7)}.`,
    Dauer: n.hours != null ? parseFloat(n.hours.toFixed(1)) : null,
    Score: n.score,
  }));

  const hm = (secs: number) => `${Math.floor(secs / 3600)}:${String(Math.round((secs % 3600) / 60)).padStart(2, "0")}`;

  return (
    <div className="rounded-2xl border border-dash-border bg-dash-card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium flex items-center gap-1.5">
          <Moon size={12} /> Schlaf-Analyse
        </p>
        <span className="text-[10px] text-dash-muted">{nights.length} Nächte erfasst</span>
      </div>

      {/* Kennzahlen */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <Stat label="Ø Dauer (7 T)" value={`${avgDur7.toFixed(1)} h`} sub={`30 T: ${avgDur30.toFixed(1)} h`} color="text-blue-400" icon={Moon} />
        <Stat label="Ø Schlaf-Score" value={avgScore30 > 0 ? avgScore30.toFixed(0) : "–"} sub="30 Tage" color="text-cyan-400" />
        <Stat
          label="Gelernter Optimalbedarf"
          value={plan.isLearned ? `${plan.baseNeedH.toFixed(1)} h` : "–"}
          sub={plan.isLearned ? "beste Erholung" : "zu wenig Daten"}
          color="text-indigo-400" icon={Sparkles}
        />
        <Stat
          label="Schlafschuld"
          value={`${plan.sleepDebtH.toFixed(1)} h`}
          sub="gewichtet, letzte Nächte"
          color={plan.sleepDebtH > 1 ? "text-orange-400" : "text-emerald-400"}
        />
        <Stat
          label="Regelmäßigkeit"
          value={plan.consistencyScore != null ? `${plan.consistencyScore}` : "–"}
          sub={plan.consistencyLabel ?? "braucht Garmin-Zeiten"}
          color="text-emerald-400" icon={Repeat}
        />
        <Stat label="Ø Einschlafzeit" value={fmtMin(avgBed)} sub="30 Tage" color="text-white" icon={Clock} />
        <Stat label="Ø Aufwachzeit" value={fmtMin(avgWake)} sub="30 Tage" color="text-white" icon={Clock} />
        <Stat label="Ø Atemfrequenz" value={avgResp > 0 ? `${avgResp.toFixed(1)}` : "–"} sub="/min im Schlaf" color="text-white" icon={Wind} />
      </div>

      {/* Schlafphasen Ø */}
      {stages && (
        <div>
          <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-2">Ø Schlafphasen (30 Tage)</p>
          <div className="flex w-full h-3 rounded-full overflow-hidden mb-2">
            {stages.map((s) => s.secs > 0 && (
              <div key={s.label} style={{ width: `${(s.secs / stageTotal) * 100}%`, backgroundColor: s.color }} />
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5">
            {stages.map((s) => (
              <div key={s.label} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-dash-muted">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />{s.label}
                </span>
                <span className="text-white tabular-nums">{hm(s.secs)} · {Math.round((s.secs / stageTotal) * 100)} %</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verlauf Dauer + Score */}
      <div>
        <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-2">Verlauf (30 Nächte)</p>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 6, left: -22, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--dash-border)" />
            <XAxis dataKey="date" tick={{ fill: "var(--dash-muted)", fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis yAxisId="h" tick={{ fill: "var(--dash-muted)", fontSize: 9 }} tickLine={false} axisLine={false} width={30} unit="h" domain={[0, 10]} />
            <YAxis yAxisId="s" orientation="right" tick={{ fill: "var(--dash-muted)", fontSize: 9 }} tickLine={false} axisLine={false} width={26} domain={[0, 100]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#e2e8f0" }} formatter={(v: number, n: string) => [n === "Dauer" ? `${v} h` : v, n]} />
            <Legend wrapperStyle={{ fontSize: 10, color: "var(--dash-muted)", paddingTop: 6 }} />
            <Bar yAxisId="h" dataKey="Dauer" fill="#3b82f6" fillOpacity={0.75} radius={[3, 3, 0, 0]} />
            <Line yAxisId="s" type="monotone" dataKey="Score" stroke="#06b6d4" strokeWidth={2} dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Letzte Nacht */}
      {plan.lastNight && (
        <div className="flex items-center justify-between text-[11px] pt-3 border-t border-dash-border">
          <span className="text-dash-muted">Letzte Nacht</span>
          <span className="text-white tabular-nums flex items-center gap-2">
            {formatLocalIsoTime(plan.lastNight.sleepStart) && <span title="Eingeschlafen">🌙 {formatLocalIsoTime(plan.lastNight.sleepStart)}</span>}
            {formatLocalIsoTime(plan.lastNight.sleepEnd) && <span title="Aufgewacht">☀️ {formatLocalIsoTime(plan.lastNight.sleepEnd)}</span>}
            {plan.lastNight.durationH != null && <span className="text-dash-muted">{plan.lastNight.durationH.toFixed(1)} h</span>}
          </span>
        </div>
      )}
    </div>
  );
}
