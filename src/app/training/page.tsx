"use client";
import { useMemo, useState, useEffect } from "react";
import { clsx } from "clsx";
import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { format, parseISO, startOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import { RefreshCw, Zap, Activity, Heart, Scale } from "lucide-react";

import { useActivities } from "@/hooks/useActivities";
import { usePeriod } from "@/hooks/usePeriod";
import { useAthleteProfile } from "@/hooks/useAthleteProfile";
import { useWellness } from "@/hooks/useWellness";
import PeriodSelector from "@/components/ui/PeriodSelector";
import { Activity as ActivityType, ZoneEntry } from "@/lib/types";

// ── Weekly aggregation ────────────────────────────────────────────────────────

interface WeekPoint {
  weekLabel: string;
  sessions: number;
  hours: number;
}

function aggregateByWeek(activities: ActivityType[]): WeekPoint[] {
  const map = new Map<string, { sessions: number; hours: number }>();
  for (const a of activities) {
    const weekStart = startOfWeek(parseISO(a.start_date_local), { weekStartsOn: 1 });
    const key = format(weekStart, "yyyy-MM-dd");
    const entry = map.get(key) ?? { sessions: 0, hours: 0 };
    entry.sessions += 1;
    entry.hours += (a.moving_time ?? 0) / 3600;
    map.set(key, entry);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => ({
      weekLabel: format(parseISO(key), "dd.MM.", { locale: de }),
      sessions: val.sessions,
      hours: parseFloat(val.hours.toFixed(1)),
    }));
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  backgroundColor: "var(--dash-card)",
  border: "1px solid var(--dash-border)",
  borderRadius: 10,
  fontSize: 11,
};

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={clsx("animate-pulse rounded-2xl bg-dash-card border border-dash-border", className)} />
  );
}

// ── Training chart component ──────────────────────────────────────────────────

interface SportChartProps {
  label: string;
  data: WeekPoint[];
  barColor: string;
  lineColor: string;
  extra?: React.ReactNode;
  chartHeight?: number;
}

function SportChart({ label, data, barColor, lineColor, extra, chartHeight = 180 }: SportChartProps) {
  const totalSessions = data.reduce((s, d) => s + d.sessions, 0);
  const totalHours    = data.reduce((s, d) => s + d.hours, 0);
  const weeks         = data.length;
  const avgSessions   = weeks > 0 ? (totalSessions / weeks).toFixed(1) : "–";
  const avgHours      = weeks > 0 ? (totalHours   / weeks).toFixed(1) : "–";

  return (
    <section>
      <div className="flex items-start justify-between mb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: barColor }} />
          <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium">{label}</p>
          {extra}
        </div>
        <div className="flex items-center gap-4 text-[10px] text-dash-muted shrink-0">
          <span>
            <span className="text-white font-semibold tabular-nums">{totalSessions}</span> Sessions
          </span>
          <span>
            <span className="text-white font-semibold tabular-nums">{totalHours.toFixed(1)}</span> Std
          </span>
          <span className="hidden sm:inline">
            Ø <span className="text-white font-semibold tabular-nums">{avgSessions}</span> Sess/Wo
          </span>
          <span className="hidden sm:inline">
            Ø <span className="text-white font-semibold tabular-nums">{avgHours}</span> Std/Wo
          </span>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="bg-dash-card border border-dash-border rounded-2xl p-8 flex items-center justify-center">
          <p className="text-xs text-dash-muted">Keine Aktivitäten im gewählten Zeitraum</p>
        </div>
      ) : (
        <div className="bg-dash-card border border-dash-border rounded-2xl p-5">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <ComposedChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--dash-border)" />
              <XAxis
                dataKey="weekLabel"
                tick={{ fill: "var(--dash-muted)", fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="left"
                tick={{ fill: "var(--dash-muted)", fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={24}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: "var(--dash-muted)", fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#e2e8f0" }} />
              <Legend wrapperStyle={{ fontSize: 10, color: "var(--dash-muted)", paddingTop: 6 }} />
              <Bar
                yAxisId="left"
                dataKey="sessions"
                name="Sessions"
                fill={barColor}
                fillOpacity={0.75}
                radius={[3, 3, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="hours"
                name="Stunden"
                stroke={lineColor}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

// ── Leistungsdaten components ─────────────────────────────────────────────────

type SportTab = "Ride" | "Run";

function tsbLabel(tsb: number | null): string {
  if (tsb == null) return "–";
  if (tsb > 5)   return "Frisch";
  if (tsb < -10) return "Müde";
  return "Ausgeglichen";
}

const ZONE_COLORS: Record<number, string> = {
  1: "#22c55e",
  2: "#3b82f6",
  3: "#eab308",
  4: "#f97316",
  5: "#ef4444",
  6: "#a855f7",
};
function zoneColor(id: number, fallback?: string): string {
  return ZONE_COLORS[id] ?? fallback ?? "#94a3b8";
}

function MetricCard({
  label, value, unit, sub, color, icon: Icon, loading,
}: {
  label: string;
  value: string;
  unit: string;
  sub?: string;
  color: string;
  icon: React.ElementType;
  loading?: boolean;
}) {
  if (loading) return <Skeleton className="h-[100px]" />;
  return (
    <div className="bg-dash-card border border-dash-border rounded-2xl p-4 flex flex-col justify-between min-h-[100px]">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium">{label}</p>
        <Icon size={14} className="text-dash-muted/50" />
      </div>
      <div>
        <div className="flex items-end gap-1">
          <span className={clsx("text-2xl font-bold tabular-nums leading-none", color)}>{value}</span>
          {value !== "–" && <span className="text-dash-muted text-xs pb-0.5">{unit}</span>}
        </div>
        {sub && <p className="text-[10px] text-dash-muted/60 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function ZoneTable({
  title, zones, unit, anchor, loading,
}: {
  title: string;
  zones: ZoneEntry[];
  unit: string;
  anchor?: number | null;
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-[220px]" />;
  if (zones.length === 0) return null;

  return (
    <div className="bg-dash-card border border-dash-border rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-dash-border">
        <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium">{title}</p>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-dash-border">
            <th className="text-left px-5 py-2 text-dash-muted font-medium w-16">Zone</th>
            <th className="text-left px-5 py-2 text-dash-muted font-medium">Bereich</th>
            <th className="text-right px-5 py-2 text-dash-muted font-medium">{unit}</th>
          </tr>
        </thead>
        <tbody>
          {zones.map((z) => {
            const color = z.color ?? zoneColor(z.id);
            const rangeStr =
              z.min != null && z.max != null
                ? `${z.min} – ${z.max}`
                : z.min != null
                ? `> ${z.min}`
                : "–";
            const fromPct =
              z.fromPct != null
                ? z.fromPct
                : anchor && z.min != null
                ? Math.round((z.min / anchor) * 100)
                : null;
            const toPct =
              z.toPct != null
                ? z.toPct
                : anchor && z.max != null
                ? Math.round((z.max / anchor) * 100)
                : null;
            const pctStr =
              fromPct != null && toPct != null
                ? `${fromPct}–${toPct}%`
                : fromPct != null
                ? `> ${fromPct}%`
                : "–";

            return (
              <tr
                key={z.id}
                className="border-b border-dash-border/50 last:border-0 hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-5 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="font-medium text-white">{z.name}</span>
                  </div>
                </td>
                <td className="px-5 py-2.5 text-dash-muted">{pctStr}</td>
                <td className="px-5 py-2.5 text-right font-mono text-white/80">{rangeStr}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TrainingPage() {
  // Training charts state
  const { period, setPeriod, days } = usePeriod("3m");
  const { activities, loading: activitiesLoading } = useActivities(days);
  const [showCommutes, setShowCommutes] = useState(false);

  useEffect(() => {
    if (activities.length > 0) {
      console.log("[Pendel-Diagnose] Erste 3 Aktivitäten:", activities.slice(0, 3));
      const rides = activities.filter((a) => a.type === "Ride" || a.type === "VirtualRide");
      if (rides.length > 0) console.log("[Pendel-Diagnose] Erste Ride:", rides[0]);
    }
  }, [activities]);

  const gridData = useMemo(() => {
    const bikeActs = activities.filter(
      (a) => (a.type === "Ride" || a.type === "VirtualRide") && (showCommutes || !a.commute),
    );
    const runActs = activities.filter((a) => a.type === "Run" || a.type === "VirtualRun");
    const gymActs = activities.filter((a) => a.type === "WeightTraining" || a.type === "Workout");
    return {
      bike: aggregateByWeek(bikeActs),
      run:  aggregateByWeek(runActs),
      gym:  aggregateByWeek(gymActs),
    };
  }, [activities, showCommutes]);

  const totalData = useMemo(() => aggregateByWeek(activities), [activities]);

  const commuteToggle = (
    <button
      onClick={() => setShowCommutes((v) => !v)}
      className={clsx(
        "text-[10px] px-2 py-0.5 rounded-lg border transition-colors",
        showCommutes
          ? "border-orange-500/40 text-orange-400 bg-orange-500/10"
          : "border-dash-border text-dash-muted hover:text-white",
      )}
    >
      {showCommutes ? "Pendeln ausblenden" : "Pendeln einblenden"}
    </button>
  );

  // Leistungsdaten state
  const [sport, setSport] = useState<SportTab>("Ride");
  const {
    ftp, lthr, weight, vo2max,
    powerZones, hrZones,
    loading: profileLoading,
    error: profileError,
    refetch,
  } = useAthleteProfile(sport);

  const { data: wellness, loading: wellnessLoading } = useWellness(14);
  const latestWellness = [...wellness].reverse().find((d) => d.ctl != null);
  const ctl = latestWellness?.ctl ?? null;

  const wellnessAny = latestWellness as (typeof latestWellness & Record<string, unknown>) | undefined;
  const tsbFromField =
    wellnessAny?.form ??
    (wellnessAny?.["icu_form"] as number | undefined) ??
    null;
  const tsbComputed =
    latestWellness?.ctl != null && latestWellness?.atl != null
      ? parseFloat((latestWellness.ctl - latestWellness.atl).toFixed(1))
      : null;
  const tsb: number | null =
    tsbFromField !== null && tsbFromField !== undefined
      ? Number(tsbFromField)
      : tsbComputed;

  const profileWeight = weight;
  const wellnessWeight = [...wellness].reverse().find((d) => d.weight != null)?.weight ?? null;
  const displayWeight = profileWeight ?? wellnessWeight;

  const noParams = !profileLoading && ftp == null && lthr == null;
  const leistungLoading = profileLoading || wellnessLoading;

  return (
    <>
      <header className="sticky top-0 z-10 bg-dash-bg/95 backdrop-blur border-b border-dash-border px-3 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-sm font-semibold text-white">Training</h1>
        <PeriodSelector value={period} onChange={setPeriod} />
      </header>

      <div className="p-3 sm:p-6 space-y-8 w-full">
        {activitiesLoading ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-56" />)}
            </div>
            <Skeleton className="h-56" />
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <SportChart
                label="Rennrad"
                data={gridData.bike}
                barColor="#f97316"
                lineColor="#fdba74"
                extra={commuteToggle}
              />
              <SportChart
                label="Laufen"
                data={gridData.run}
                barColor="#22c55e"
                lineColor="#86efac"
              />
              <SportChart
                label="Gym / Kraft"
                data={gridData.gym}
                barColor="#14b8a6"
                lineColor="#5eead4"
              />
            </div>

            <SportChart
              label="Gesamtaktivität — Alle Sportarten"
              data={totalData}
              barColor="#6366f1"
              lineColor="#a5b4fc"
              chartHeight={200}
            />
          </>
        )}

        {/* ── Trennlinie Leistungsdaten ── */}
        <div className="border-t border-dash-border pt-2">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
            <div>
              <h2 className="text-sm font-semibold text-white">Leistungsdaten</h2>
              <p className="text-[10px] text-dash-muted">FTP, Zonen und aktuelle Trainingsform</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-xl border border-dash-border overflow-hidden text-xs">
                {(["Ride", "Run"] as SportTab[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSport(s)}
                    className={clsx(
                      "px-3 py-1.5 transition-colors",
                      sport === s ? "bg-white/10 text-white" : "text-dash-muted hover:text-white",
                    )}
                  >
                    {s === "Ride" ? "Rad" : "Lauf"}
                  </button>
                ))}
              </div>
              <button
                onClick={refetch}
                disabled={leistungLoading}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-dash-border text-dash-muted hover:text-white hover:border-white/30 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={12} className={leistungLoading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {profileError && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
              {profileError}
            </div>
          )}

          {noParams && (
            <div className="mb-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-400">
              <span className="font-semibold">Keine Leistungsparameter gefunden</span>
              <span className="text-yellow-400/70 ml-1">
                — Setze FTP und LTHR in intervals.icu → Einstellungen → Athletenprofil.
                VO2max wird von Garmin/Wahoo synchronisiert.
              </span>
            </div>
          )}

          <div className="space-y-6">
            <section>
              <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-3">
                Leistungsparameter
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard
                  label="FTP"
                  value={ftp != null ? String(ftp) : "–"}
                  unit="W"
                  color="text-yellow-400"
                  icon={Zap}
                  loading={profileLoading}
                />
                <MetricCard
                  label="VO2MAX"
                  value={vo2max != null ? vo2max.toFixed(1) : "–"}
                  unit="ml/min/kg"
                  sub="Gerät-Messung"
                  color="text-cyan-400"
                  icon={Activity}
                  loading={profileLoading}
                />
                <MetricCard
                  label="LTHR"
                  value={lthr != null ? String(lthr) : "–"}
                  unit="bpm"
                  color="text-red-400"
                  icon={Heart}
                  loading={profileLoading}
                />
                <MetricCard
                  label="Gewicht"
                  value={displayWeight != null ? Number(displayWeight).toFixed(1) : "–"}
                  unit="kg"
                  color="text-purple-400"
                  icon={Scale}
                  loading={profileLoading}
                />
              </div>
            </section>

            <section>
              <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-3">
                Aktuelle Form
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <MetricCard
                  label="CTL (Fitness)"
                  value={ctl != null ? ctl.toFixed(1) : "–"}
                  unit=""
                  sub="42-Tage-EMA"
                  color="text-blue-400"
                  icon={Activity}
                  loading={wellnessLoading}
                />
                <MetricCard
                  label="TSB (Form)"
                  value={tsb != null ? tsb.toFixed(1) : "–"}
                  unit=""
                  sub={tsb != null ? tsbLabel(tsb) : undefined}
                  color={
                    tsb == null      ? "text-dash-muted"
                      : tsb > 5     ? "text-green-400"
                      : tsb < -10   ? "text-orange-400"
                      : "text-yellow-400"
                  }
                  icon={Activity}
                  loading={wellnessLoading}
                />
              </div>
            </section>

            {(profileLoading || powerZones.length > 0) && (
              <section>
                <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-3">
                  Wattzonen
                </p>
                <ZoneTable
                  title={`Leistungszonen · ${sport === "Ride" ? "Rad" : "Lauf"}`}
                  zones={powerZones}
                  unit="Watt"
                  anchor={ftp}
                  loading={profileLoading}
                />
              </section>
            )}

            {(profileLoading || hrZones.length > 0) && (
              <section>
                <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-3">
                  Herzfrequenzzonen
                </p>
                <ZoneTable
                  title={`HF-Zonen · ${sport === "Ride" ? "Rad" : "Lauf"}`}
                  zones={hrZones}
                  unit="bpm"
                  anchor={lthr}
                  loading={profileLoading}
                />
              </section>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
