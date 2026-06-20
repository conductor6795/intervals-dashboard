"use client";
import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { BatteryCharging, Activity, Moon, Heart, Gauge, Wind } from "lucide-react";
import { clsx } from "clsx";

import TrendArrow from "@/components/ui/TrendArrow";
import DetailModal from "@/components/ui/DetailModal";
import GarminDetail, { GarminMetric, GARMIN_METRIC_TITLE } from "@/components/overview/GarminDetail";
import { calcValueTrend } from "@/lib/calculations";
import { useGarmin, GarminDay } from "@/hooks/useGarmin";

/* ── Sparkline ───────────────────────────────────────────────────────────── */
function Spark({ values, color }: { values: (number | null)[]; color: string }) {
  const data = values.map((v, i) => ({ i, v }));
  const id = `gspark-${color.replace("#", "")}`;
  return (
    <div className="h-8 -mx-1 mt-auto">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 3, bottom: 0, left: 0, right: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#${id})`} connectNulls dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface CardProps {
  label: string;
  icon: React.ReactNode;
  value: string | number | null;
  unit?: string;
  sub?: string;
  colorClass?: string;
  hex: string;
  values: (number | null)[];
  trend?: "up" | "neutral" | "down";
  positiveIsGood?: boolean;
  onClick: () => void;
}

function StatCard({
  label, icon, value, unit, sub, colorClass = "text-white",
  hex, values, trend, positiveIsGood = true, onClick,
}: CardProps) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-dash-card border border-dash-border rounded-2xl p-4 flex flex-col gap-1 h-[140px] hover:border-white/20 transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] text-dash-muted uppercase tracking-wider font-medium">
          {icon}{label}
        </div>
        {trend !== undefined && <TrendArrow trend={trend} positiveIsGood={positiveIsGood} size={12} />}
      </div>
      <div className="flex items-end gap-1.5">
        <span className={clsx("text-2xl font-bold tabular-nums leading-none", colorClass)}>{value ?? "–"}</span>
        {unit && <span className="text-dash-muted text-xs pb-0.5">{unit}</span>}
      </div>
      <span className="text-[10px] text-dash-muted min-h-[14px]">{sub ?? ""}</span>
      <Spark values={values} color={hex} />
    </button>
  );
}

function Skeleton() {
  return <div className="animate-pulse rounded-2xl bg-dash-card border border-dash-border h-[140px]" />;
}

function stressColor(v: number | null) {
  if (v == null) return { cls: "text-white", hex: "#94a3b8" };
  if (v <= 25) return { cls: "text-emerald-400", hex: "#34d399" };
  if (v <= 50) return { cls: "text-yellow-400", hex: "#facc15" };
  return { cls: "text-orange-400", hex: "#fb923c" };
}
function acwrColor(s: string | null) {
  if (s === "OPTIMAL") return { cls: "text-emerald-400", hex: "#34d399" };
  if (s === "LOW" || s === "HIGH") return { cls: "text-yellow-400", hex: "#facc15" };
  return { cls: "text-white", hex: "#94a3b8" };
}

export default function GarminCards() {
  const { data, lastSync, loading, error } = useGarmin();
  const [active, setActive] = useState<GarminMetric | null>(null);

  if (error) {
    return (
      <section>
        <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-3">Garmin · Erholung &amp; Last</p>
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          Garmin-Daten nicht erreichbar: {error}
        </div>
      </section>
    );
  }

  const today: GarminDay | undefined = data[data.length - 1];
  const num = (k: keyof GarminDay) =>
    data.map((d) => (typeof d[k] === "number" ? (d[k] as number) : null));
  const sleepH = data.map((d) => (d.sleepSecs != null ? +(d.sleepSecs / 3600).toFixed(1) : null));

  const stressC = stressColor(today?.stressAvg ?? null);
  const acwrC = acwrColor(today?.acwrStatus ?? null);

  const lastSyncLabel = lastSync
    ? new Date(lastSync).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium">Garmin · Erholung &amp; Last</p>
        {lastSyncLabel && <span className="text-[10px] text-dash-muted">Sync {lastSyncLabel}</span>}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} />)}
        </div>
      ) : !today ? (
        <div className="p-3 rounded-xl bg-dash-card border border-dash-border text-xs text-dash-muted">
          Noch keine Garmin-Daten. Läuft der nächtliche Sync schon? Test: <span className="font-mono">curl /api/garmin</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            label="Body Battery" icon={<BatteryCharging size={10} />}
            value={today.bbRecent}
            sub={today.bbLow != null && today.bbHigh != null ? `${today.bbLow}–${today.bbHigh} heute` : undefined}
            colorClass="text-emerald-400" hex="#34d399"
            values={num("bbHigh")} trend={calcValueTrend(num("bbHigh"))} positiveIsGood
            onClick={() => setActive("bb")}
          />
          <StatCard
            label="Stress" icon={<Activity size={10} />}
            value={today.stressAvg}
            sub={today.stressMax != null ? `max ${today.stressMax}` : undefined}
            colorClass={stressC.cls} hex={stressC.hex}
            values={num("stressAvg")} trend={calcValueTrend(num("stressAvg"))} positiveIsGood={false}
            onClick={() => setActive("stress")}
          />
          <StatCard
            label="Schlaf" icon={<Moon size={10} />}
            value={today.sleepSecs != null ? (today.sleepSecs / 3600).toFixed(1) : null} unit="h"
            sub={today.sleepScore != null ? `Score ${today.sleepScore}` : undefined}
            colorClass="text-blue-400" hex="#60a5fa"
            values={sleepH} trend={calcValueTrend(sleepH)} positiveIsGood
            onClick={() => setActive("sleep")}
          />
          <StatCard
            label="Ruhepuls" icon={<Heart size={10} />}
            value={today.restingHr} unit="bpm"
            colorClass="text-red-400" hex="#f87171"
            values={num("restingHr")} trend={calcValueTrend(num("restingHr"))} positiveIsGood={false}
            onClick={() => setActive("rhr")}
          />
          <StatCard
            label="ACWR" icon={<Gauge size={10} />}
            value={today.acwr != null ? today.acwr.toFixed(2) : null}
            sub={today.acwrStatus ?? undefined}
            colorClass={acwrC.cls} hex={acwrC.hex}
            values={num("acwr")}
            onClick={() => setActive("acwr")}
          />
          <StatCard
            label="VO₂max" icon={<Wind size={10} />}
            value={today.vo2maxCycling != null ? today.vo2maxCycling.toFixed(1) : null}
            sub={today.vo2maxRunning != null ? `Rad · Lauf ${today.vo2maxRunning.toFixed(1)}` : "Rad"}
            colorClass="text-indigo-400" hex="#818cf8"
            values={num("vo2maxCycling")} trend={calcValueTrend(num("vo2maxCycling"))} positiveIsGood
            onClick={() => setActive("vo2")}
          />
        </div>
      )}

      <DetailModal
        open={active != null}
        onClose={() => setActive(null)}
        title={active ? GARMIN_METRIC_TITLE[active] : ""}
        subtitle={lastSyncLabel ? `Garmin · letzte ${data.length} Tage · Sync ${lastSyncLabel}` : undefined}
      >
        {active && <GarminDetail days={data} metric={active} />}
      </DetailModal>
    </section>
  );
}
