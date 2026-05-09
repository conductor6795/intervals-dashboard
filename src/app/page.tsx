"use client";
import { useState, useMemo } from "react";
import { RefreshCw, Eye, EyeOff, Heart, Zap, TrendingUp, Moon, Activity as ActivityIcon } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { clsx } from "clsx";

import Sidebar from "@/components/layout/Sidebar";
import TrainingReadiness from "@/components/metrics/TrainingReadiness";
import RecoveryScore from "@/components/metrics/RecoveryScore";
import CVAmpel from "@/components/metrics/CVAmpel";
import HRVChart from "@/components/charts/HRVChart";
import FitnessChart from "@/components/charts/FitnessChart";
import WellnessChart from "@/components/charts/WellnessChart";
import WorkoutCalendar from "@/components/calendar/WorkoutCalendar";

import { useWellness } from "@/hooks/useWellness";
import { useActivities, useEvents } from "@/hooks/useActivities";
import { calcAllMetrics, buildDailyMetrics, getHRV } from "@/lib/calculations";

// ─── Stat-Karte ──────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string | number | null;
  unit?: string;
  color?: string;
  icon?: React.ReactNode;
  sub?: string;
}

function StatCard({ label, value, unit, color = "text-white", icon, sub }: StatCardProps) {
  return (
    <div className="bg-dash-card border border-dash-border rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[10px] text-dash-muted uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className="flex items-end gap-1 mt-1">
        <span className={clsx("text-2xl font-bold tabular-nums leading-none", color)}>
          {value ?? "–"}
        </span>
        {unit && <span className="text-dash-muted text-xs pb-0.5">{unit}</span>}
      </div>
      {sub && <span className="text-[10px] text-dash-muted">{sub}</span>}
    </div>
  );
}

// ─── Lade-Skeleton ────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-xl bg-dash-card border border-dash-border", className)} />;
}

// ─── Abschnitt-Titel ──────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
      <span className="w-1 h-4 rounded-full bg-indigo-500 inline-block" />
      {children}
    </h2>
  );
}

// ─── Aktivitäten-Tabelle ──────────────────────────────────────────────────────
function ActivitiesTable({ activities }: { activities: import("@/lib/types").Activity[] }) {
  const sorted = [...activities].sort(
    (a, b) => b.start_date_local.localeCompare(a.start_date_local)
  );

  const SPORT_COLORS: Record<string, string> = {
    Ride: "#f97316", VirtualRide: "#fb923c", Run: "#10b981",
    VirtualRun: "#34d399", Swim: "#3b82f6", Strength: "#8b5cf6",
    Workout: "#6366f1", Walk: "#a3e635", Other: "#6b7280",
  };
  const col = (t: string) => SPORT_COLORS[t] ?? SPORT_COLORS.Other;

  return (
    <div className="overflow-x-auto rounded-xl border border-dash-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-dash-border">
            {["Datum", "Name", "Sport", "Dauer", "Distanz", "Ø HF", "Ø Watt", "TSS"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-dash-muted font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, 30).map((a) => (
            <tr key={a.id} className="border-b border-dash-border/50 hover:bg-white/3 transition-colors">
              <td className="px-4 py-2.5 text-xs text-dash-muted tabular-nums">
                {format(new Date(a.start_date_local), "dd.MM.yy", { locale: de })}
              </td>
              <td className="px-4 py-2.5 text-xs text-white max-w-[200px] truncate">
                {a.race && <span className="text-[9px] bg-red-500/20 text-red-400 rounded px-1 mr-1">RACE</span>}
                {a.name}
              </td>
              <td className="px-4 py-2.5">
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: col(a.type), backgroundColor: `${col(a.type)}20` }}>
                  {a.type}
                </span>
              </td>
              <td className="px-4 py-2.5 text-xs text-dash-muted tabular-nums">
                {a.moving_time ? `${Math.floor(a.moving_time / 3600)}h${Math.floor((a.moving_time % 3600) / 60)}m` : "–"}
              </td>
              <td className="px-4 py-2.5 text-xs text-dash-muted tabular-nums">
                {a.distance ? `${(a.distance / 1000).toFixed(1)} km` : "–"}
              </td>
              <td className="px-4 py-2.5 text-xs text-dash-muted tabular-nums">
                {a.average_heartrate ? Math.round(a.average_heartrate) : "–"}
              </td>
              <td className="px-4 py-2.5 text-xs text-dash-muted tabular-nums">
                {a.average_watts ? Math.round(a.average_watts) : "–"}
              </td>
              <td className="px-4 py-2.5 text-xs text-dash-muted tabular-nums">
                {a.icu_training_load ? Math.round(a.icu_training_load) : "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <div className="px-4 py-8 text-center text-xs text-dash-muted">Keine Aktivitäten gefunden</div>
      )}
    </div>
  );
}

// ─── Hauptseite ───────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [activeSection, setActiveSection] = useState("overview");
  const [showProRaces, setShowProRaces] = useState(true);
  const [wellnessDays, setWellnessDays] = useState(90);

  const { data: wellness, loading: wLoading, error: wError, refetch: refetchWellness } = useWellness(wellnessDays);
  const { activities, loading: aLoading, error: aError, refetch: refetchActivities } = useActivities(60);
  const { events } = useEvents();

  const metrics = useMemo(() => calcAllMetrics(wellness), [wellness]);
  const dailyMetrics = useMemo(() => buildDailyMetrics(wellness), [wellness]);

  const today = wellness[wellness.length - 1];
  const todayHRV = today ? getHRV(today) : null;
  const latestCTL = today?.ctl;
  const latestATL = today?.atl;
  const latestTSB = latestCTL != null && latestATL != null ? latestCTL - latestATL : null;
  const athleteName = process.env.NEXT_PUBLIC_ATHLETE_NAME ?? "Athlet";

  function scrollTo(id: string) {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const isLoading = wLoading || aLoading;

  return (
    <div className="min-h-screen bg-dash-bg text-white">
      <Sidebar active={activeSection} onSelect={scrollTo} />

      {/* Main content */}
      <main className="ml-52 min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-dash-bg/90 backdrop-blur border-b border-dash-border px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-white">{athleteName}</h1>
            <p className="text-[10px] text-dash-muted">
              {format(new Date(), "EEEE, d. MMMM yyyy", { locale: de })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Wellness-Zeitraum */}
            <select
              value={wellnessDays}
              onChange={(e) => setWellnessDays(Number(e.target.value))}
              className="bg-dash-card border border-dash-border text-xs text-white rounded-lg px-3 py-1.5 outline-none"
            >
              {[30, 60, 90, 180, 365].map((d) => (
                <option key={d} value={d}>{d} Tage</option>
              ))}
            </select>

            {/* Pro Races toggle */}
            <button
              onClick={() => setShowProRaces((v) => !v)}
              className={clsx(
                "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors",
                showProRaces
                  ? "border-indigo-500 bg-indigo-500/10 text-indigo-400"
                  : "border-dash-border text-dash-muted hover:border-indigo-500/50"
              )}
            >
              {showProRaces ? <Eye size={12} /> : <EyeOff size={12} />}
              Profi-Rennen
            </button>

            <button
              onClick={() => { refetchWellness(); refetchActivities(); }}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-dash-border text-dash-muted hover:text-white hover:border-indigo-500/50 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
              Aktualisieren
            </button>
          </div>
        </header>

        {/* Error banner */}
        {(wError || aError) && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
            {wError && <p>Wellness-Fehler: {wError}</p>}
            {aError && <p>Aktivitäten-Fehler: {aError}</p>}
            <p className="mt-1 text-red-400/70">
              Prüfe .env.local → INTERVALS_ATHLETE_ID und INTERVALS_API_KEY.
            </p>
          </div>
        )}

        <div className="p-6 space-y-10 max-w-[1600px]">
          {/* ── ÜBERSICHT ─────────────────────────────────────────────── */}
          <section id="overview">
            <SectionTitle>Übersicht</SectionTitle>

            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                <StatCard
                  label="HRV (heute)"
                  value={todayHRV != null ? todayHRV.toFixed(1) : null}
                  icon={<Heart size={10} />}
                  color={todayHRV && metrics.hrv7 && todayHRV >= metrics.hrv7 ? "text-emerald-400" : "text-orange-400"}
                  sub={metrics.hrv7 ? `Ø7: ${metrics.hrv7.toFixed(1)}` : undefined}
                />
                <StatCard
                  label="CV"
                  value={metrics.cv != null ? `${metrics.cv.toFixed(1)}` : null}
                  unit="%"
                  color={metrics.cv != null && metrics.cv < 6.5 ? "text-emerald-400" : "text-yellow-400"}
                  sub={metrics.cv != null ? (metrics.cv < 6.5 ? "Stabil" : "Variabel") : undefined}
                />
                <StatCard
                  label="Trend-Ratio"
                  value={metrics.trendRatio != null ? metrics.trendRatio.toFixed(1) : null}
                  unit="%"
                  color={metrics.trendRatio != null && metrics.trendRatio >= 100 ? "text-emerald-400" : "text-orange-400"}
                />
                <StatCard
                  label="CTL (Fitness)"
                  value={latestCTL != null ? latestCTL.toFixed(1) : null}
                  icon={<TrendingUp size={10} />}
                  color="text-blue-400"
                />
                <StatCard
                  label="ATL (Ermüdung)"
                  value={latestATL != null ? latestATL.toFixed(1) : null}
                  color="text-red-400"
                />
                <StatCard
                  label="TSB (Form)"
                  value={latestTSB != null ? latestTSB.toFixed(1) : null}
                  color={latestTSB != null && latestTSB >= 0 ? "text-emerald-400" : "text-orange-400"}
                />
                <StatCard
                  label="Ruhepuls"
                  value={today?.restingHR ?? null}
                  unit="bpm"
                  icon={<Heart size={10} />}
                  color="text-red-400"
                />
              </div>
            )}
          </section>

          {/* ── HRV & ERHOLUNG ────────────────────────────────────────── */}
          <section id="hrv">
            <SectionTitle>HRV & Erholung</SectionTitle>

            {isLoading ? (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <Skeleton className="h-64" />
                <Skeleton className="h-64" />
                <Skeleton className="h-64 xl:col-span-1" />
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {/* Readiness + Recovery */}
                <div className="flex flex-col gap-4">
                  <TrainingReadiness value={metrics.trainingReadiness} />
                  <RecoveryScore value={metrics.recoveryScore} />

                  {/* Zusatz-Wellness */}
                  <div className="grid grid-cols-2 gap-3">
                    {today?.sleepScore != null && (
                      <StatCard
                        label="Schlaf-Score"
                        value={today.sleepScore}
                        icon={<Moon size={10} />}
                        color="text-blue-400"
                      />
                    )}
                    {today?.sleepSecs != null && (
                      <StatCard
                        label="Schlaf"
                        value={(today.sleepSecs / 3600).toFixed(1)}
                        unit="h"
                        icon={<Moon size={10} />}
                        color="text-blue-400"
                      />
                    )}
                    {today?.mood != null && (
                      <StatCard
                        label="Stimmung"
                        value={today.mood}
                        unit="/5"
                        color={today.mood >= 4 ? "text-emerald-400" : today.mood >= 3 ? "text-yellow-400" : "text-red-400"}
                      />
                    )}
                    {today?.motivation != null && (
                      <StatCard
                        label="Motivation"
                        value={today.motivation}
                        unit="/5"
                        color={today.motivation >= 4 ? "text-emerald-400" : today.motivation >= 3 ? "text-yellow-400" : "text-red-400"}
                      />
                    )}
                    {today?.fatigue != null && (
                      <StatCard
                        label="Ermüdung"
                        value={today.fatigue}
                        unit="/5"
                        color={today.fatigue <= 2 ? "text-emerald-400" : today.fatigue <= 3 ? "text-yellow-400" : "text-red-400"}
                      />
                    )}
                    {today?.soreness != null && (
                      <StatCard
                        label="Muskelkater"
                        value={today.soreness}
                        unit="/5"
                        color={today.soreness <= 2 ? "text-emerald-400" : today.soreness <= 3 ? "text-yellow-400" : "text-red-400"}
                      />
                    )}
                  </div>
                </div>

                {/* CV-Ampel */}
                <CVAmpel
                  zone={metrics.cvZone}
                  label={metrics.cvZoneLabel}
                  advice={metrics.cvZoneAdvice}
                  trendRatio={metrics.trendRatio}
                  cv={metrics.cv}
                  hrv7={metrics.hrv7}
                />

                {/* HRV Chart */}
                <div className="xl:col-span-1">
                  <HRVChart wellnessData={wellness} dailyMetrics={dailyMetrics} />
                </div>
              </div>
            )}
          </section>

          {/* ── FITNESS-TREND ─────────────────────────────────────────── */}
          <section id="fitness">
            <SectionTitle>Fitness-Trend</SectionTitle>
            {isLoading ? (
              <Skeleton className="h-72" />
            ) : (
              <FitnessChart wellnessData={wellness} />
            )}
          </section>

          {/* ── WELLNESS-CHARTS ───────────────────────────────────────── */}
          <section id="wellness">
            <SectionTitle>Wellness-Charts</SectionTitle>
            {isLoading ? (
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
              </div>
            ) : (
              <WellnessChart wellnessData={wellness} />
            )}
          </section>

          {/* ── KALENDER ─────────────────────────────────────────────── */}
          <section id="calendar">
            <SectionTitle>Kalender</SectionTitle>
            {aLoading ? (
              <Skeleton className="h-[520px]" />
            ) : (
              <WorkoutCalendar
                activities={activities}
                events={events}
                showProRaces={showProRaces}
              />
            )}
          </section>

          {/* ── AKTIVITÄTEN ───────────────────────────────────────────── */}
          <section id="activities">
            <SectionTitle>
              <ActivityIcon size={14} className="text-indigo-400" />
              Aktivitäten (letzte 60 Tage)
            </SectionTitle>
            {aLoading ? (
              <Skeleton className="h-64" />
            ) : (
              <ActivitiesTable activities={activities} />
            )}
          </section>

          {/* ── EINSTELLUNGEN ─────────────────────────────────────────── */}
          <section id="settings">
            <SectionTitle>Einstellungen</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
              <div className="p-5 rounded-xl border border-dash-border bg-dash-card">
                <h3 className="text-sm font-semibold text-white mb-3">intervals.icu API</h3>
                <p className="text-xs text-dash-muted leading-relaxed mb-3">
                  Die Konfiguration erfolgt über die Datei{" "}
                  <code className="bg-dash-bg px-1.5 py-0.5 rounded text-indigo-300">.env.local</code>{" "}
                  im Projektverzeichnis.
                </p>
                <div className="space-y-2 text-xs font-mono">
                  <div className="bg-dash-bg border border-dash-border rounded-lg p-3 space-y-1">
                    <p className="text-dash-muted"># .env.local</p>
                    <p><span className="text-indigo-400">INTERVALS_ATHLETE_ID</span>=i12345</p>
                    <p><span className="text-indigo-400">INTERVALS_API_KEY</span>=dein_api_key</p>
                    <p><span className="text-indigo-400">NEXT_PUBLIC_ATHLETE_NAME</span>=Dein Name</p>
                  </div>
                </div>
                <p className="text-[10px] text-dash-muted mt-3">
                  API-Key: intervals.icu → Einstellungen → API → Kopieren
                </p>
              </div>

              <div className="p-5 rounded-xl border border-dash-border bg-dash-card">
                <h3 className="text-sm font-semibold text-white mb-3">Über das Dashboard</h3>
                <div className="text-xs text-dash-muted space-y-2">
                  <p>
                    <span className="text-white">HRV7</span> – Rollierender 7-Tage-Durchschnitt der HRV
                  </p>
                  <p>
                    <span className="text-white">CV</span> – Variationskoeffizient der HRV7 in %. Schwellenwert: 6,5 %
                  </p>
                  <p>
                    <span className="text-white">Trend-Ratio</span> – Heutige HRV / HRV7 × 100. &gt; 100 = über Durchschnitt
                  </p>
                  <p>
                    <span className="text-white">Trainingsbereitschaft</span> – HRV-Trend (35 %) + Schlaf (20 %) + RHR (15 %) + Subjektiv (20 %) + CV-Stabilität (10 %)
                  </p>
                  <p>
                    <span className="text-white">Erholung</span> – HRV-Ratio (40 %) + Schlaf (30 %) + RHR (20 %) + Muskelkater (10 %)
                  </p>
                  <p>
                    <span className="text-white">CV-Ampel</span> – 4-Felder-Matrix aus HRV-Trend und CV
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
