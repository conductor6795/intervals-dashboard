"use client";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { BatteryCharging, Activity, Moon, Heart, Gauge, Wind } from "lucide-react";
import { clsx } from "clsx";
import Link from "next/link";

import TrendArrow from "@/components/ui/TrendArrow";
import { calcValueTrend } from "@/lib/calculations";
import { useGarmin, GarminDay } from "@/hooks/useGarmin";

/* ── kleine Sparkline unter der Zahl ─────────────────────────────────────── */
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
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${id})`}
            connectNulls
            dot={false}
            isAnimationActive={false}
          />
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
  href?: string;
}

function StatCard({
  label, icon, value, unit, sub, colorClass = "text-white",
  hex, values, trend, positiveIsGood = true, href,
}: CardProps) {
  const inner = (
    <div className="bg-dash-card border border-dash-border rounded-2xl p-4 flex flex-col gap-1 h-[140px] hover:border-white/20 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] text-dash-muted uppercase tracking-wider font-medium">
          {icon}{label}
        </div>
        {trend !== undefined && (
          <TrendArrow trend={trend} positiveIsGood={positiveIsGood} size={12} />
        )}
      </div>
      <div className="flex items-end gap-1.5">
        <span className={clsx("text-2xl font-bold tabular-nums leading-none", colorClass)}>
          {value ?? "–"}
        </span>
        {unit && <span className="text-dash-muted text-xs pb-0.5">{unit}</span>}
      </div>
      <span className="text-[10px] text-dash-muted min-h-[14px]">{sub ?? ""}</span>
      <Spark values={values} color={hex} />
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function Skeleton() {
  return <div className="animate-pulse rounded-2xl bg-dash-card border border-dash-border h-[140px]" />;
}

/* ── Farb-Logik (passend zu deiner semantischen Färbung) ─────────────────── */
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

  // Manche Felder (Schlaf, ACWR, VO2max) fehlen für den aktuellsten Tag oft, weil der
  // Sync frühmorgens läuft oder das Gerät sie noch nicht übertragen hat. Statt eine leere
  // Kachel zu zeigen, greifen wir auf den zuletzt vorhandenen Wert zurück.
  const latest = <K extends keyof GarminDay>(k: K): GarminDay[K] | null => {
    for (let i = data.length - 1; i >= 0; i--) {
      const v = data[i][k];
      if (v != null) return v;
    }
    return null;
  };

  const stressC = stressColor((latest("stressAvg") as number | null) ?? null);
  const acwrC = acwrColor((latest("acwrStatus") as string | null) ?? null);

  const lastSyncLabel = lastSync
    ? new Date(lastSync).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium">Garmin · Erholung &amp; Last</p>
        {lastSyncLabel && (
          <span className="text-[10px] text-dash-muted">Sync {lastSyncLabel}</span>
        )}
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
            label="Body Battery"
            icon={<BatteryCharging size={10} />}
            value={latest("bbRecent") as number | null}
            sub={today.bbLow != null && today.bbHigh != null ? `${today.bbLow}–${today.bbHigh} heute` : undefined}
            colorClass="text-emerald-400"
            hex="#34d399"
            values={num("bbHigh")}
            trend={calcValueTrend(num("bbHigh"))}
            positiveIsGood
            href="/wellness"
          />
          <StatCard
            label="Stress"
            icon={<Activity size={10} />}
            value={latest("stressAvg") as number | null}
            sub={(latest("stressMax") as number | null) != null ? `max ${latest("stressMax")}` : undefined}
            colorClass={stressC.cls}
            hex={stressC.hex}
            values={num("stressAvg")}
            trend={calcValueTrend(num("stressAvg"))}
            positiveIsGood={false}
            href="/wellness"
          />
          <StatCard
            label="Schlaf"
            icon={<Moon size={10} />}
            value={(latest("sleepSecs") as number | null) != null ? ((latest("sleepSecs") as number) / 3600).toFixed(1) : null}
            unit="h"
            sub={(latest("sleepScore") as number | null) != null ? `Score ${latest("sleepScore")}` : undefined}
            colorClass="text-blue-400"
            hex="#60a5fa"
            values={sleepH}
            trend={calcValueTrend(sleepH)}
            positiveIsGood
            href="/wellness"
          />
          <StatCard
            label="Ruhepuls"
            icon={<Heart size={10} />}
            value={latest("restingHr") as number | null}
            unit="bpm"
            colorClass="text-red-400"
            hex="#f87171"
            values={num("restingHr")}
            trend={calcValueTrend(num("restingHr"))}
            positiveIsGood={false}
            href="/hrv"
          />
          <StatCard
            label="ACWR"
            icon={<Gauge size={10} />}
            value={(latest("acwr") as number | null) != null ? (latest("acwr") as number).toFixed(2) : null}
            sub={(latest("acwrStatus") as string | null) ?? undefined}
            colorClass={acwrC.cls}
            hex={acwrC.hex}
            values={num("acwr")}
            href="/fitness"
          />
          <StatCard
            label="VO₂max"
            icon={<Wind size={10} />}
            value={(latest("vo2maxCycling") as number | null) != null ? (latest("vo2maxCycling") as number).toFixed(1) : null}
            sub={(latest("vo2maxRunning") as number | null) != null ? `Rad · Lauf ${(latest("vo2maxRunning") as number).toFixed(1)}` : "Rad"}
            colorClass="text-indigo-400"
            hex="#818cf8"
            values={num("vo2maxCycling")}
            trend={calcValueTrend(num("vo2maxCycling"))}
            positiveIsGood
            href="/performance"
          />
        </div>
      )}
    </section>
  );
}
