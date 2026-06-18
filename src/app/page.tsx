"use client";
import GarminCards from "@/components/overview/GarminCards";
import WeatherCard from "@/components/overview/WeatherCard";
import { useMemo, useState, useEffect } from "react";
import { RefreshCw, Heart, Scale, TrendingUp, Moon, Zap, Activity, Dumbbell } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { clsx } from "clsx";
import Link from "next/link";

import TodayWorkout from "@/components/overview/TodayWorkout";
import TrendArrow from "@/components/ui/TrendArrow";
import Tooltip from "@/components/ui/Tooltip";
import TrainingReadiness from "@/components/metrics/TrainingReadiness";
import RecoveryScore from "@/components/metrics/RecoveryScore";
import CVAmpelCompact from "@/components/metrics/CVAmpelCompact";
import PeriodSelector from "@/components/ui/PeriodSelector";

import { useWellness } from "@/hooks/useWellness";
import { useActivities, useEvents } from "@/hooks/useActivities";
import { usePeriod } from "@/hooks/usePeriod";
import { calcAllMetrics, getHRV, calcValueTrend } from "@/lib/calculations";
import { WellnessDay } from "@/lib/types";
import { getPageSettings } from "@/lib/settings";

function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-2xl bg-dash-card border border-dash-border", className)} />;
}

interface MetricCardProps {
  label: React.ReactNode;
  value: string | number | null;
  unit?: string;
  color?: string;
  icon?: React.ReactNode;
  sub?: string;
  trend?: "up" | "neutral" | "down";
  positiveIsGood?: boolean;
  href?: string;
}

function MetricCard({ label, value, unit, color = "text-white", icon, sub, trend, positiveIsGood = true, href }: MetricCardProps) {
  const inner = (
    <div className="bg-dash-card border border-dash-border rounded-2xl p-4 flex flex-col justify-between h-[100px] hover:border-white/20 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] text-dash-muted uppercase tracking-wider font-medium">
          {icon}{label}
        </div>
        {trend !== undefined && (
          <TrendArrow trend={trend} positiveIsGood={positiveIsGood} size={12} />
        )}
      </div>
      <div className="flex items-end gap-1.5">
        <span className={clsx("text-2xl font-bold tabular-nums leading-none", color)}>
          {value ?? "–"}
        </span>
        {unit && <span className="text-dash-muted text-xs pb-0.5">{unit}</span>}
      </div>
      <span className="text-[10px] text-dash-muted leading-relaxed min-h-[14px]">{sub ?? ""}</span>
    </div>
  );

  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}

function buildTrends(wellness: WellnessDay[]) {
  const hrs   = wellness.map(getHRV);
  const rhrs  = wellness.map((d) => d.restingHR ?? null);
  const ctls  = wellness.map((d) => d.ctl ?? null);
  const atls  = wellness.map((d) => d.atl ?? null);
  const tsbs  = wellness.map((d) => {
    const c = d.ctl; const a = d.atl;
    return c != null && a != null ? c - a : null;
  });
  const sleeps = wellness.map((d) =>
    d.sleepScore != null ? d.sleepScore : d.sleepSecs != null ? d.sleepSecs / 3600 : null
  );
  return {
    hrv:   calcValueTrend(hrs),
    rhr:   calcValueTrend(rhrs),
    ctl:   calcValueTrend(ctls),
    atl:   calcValueTrend(atls),
    tsb:   calcValueTrend(tsbs),
    sleep: calcValueTrend(sleeps),
  };
}

export default function OverviewPage() {
  const { period, setPeriod, days } = usePeriod("30d");
  const [pageSettings, setPageSettings] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setPageSettings(getPageSettings());
    const refresh = () => setPageSettings(getPageSettings());
    window.addEventListener("page-settings-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("page-settings-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const { data: wellness, loading: wLoading, error: wError, refetch: refetchWellness } = useWellness(days);
  const { activities, loading: aLoading, refetch: refetchActivities } = useActivities(days);
  const { events, athleteId } = useEvents();

  const metrics = useMemo(() => calcAllMetrics(wellness), [wellness]);
  const trends  = useMemo(() => buildTrends(wellness), [wellness]);

  const today      = wellness[wellness.length - 1];
  const todayHRV   = today ? getHRV(today) : null;
  const latestCTL  = today?.ctl;
  const latestATL  = today?.atl;
  const latestTSB  = latestCTL != null && latestATL != null ? latestCTL - latestATL : null;

  const weeklyHours = useMemo(() => {
    if (aLoading || activities.length === 0) return null;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const hours = activities
      .filter((a) => a.start_date_local >= cutoffStr)
      .reduce((sum, a) => sum + (a.moving_time ?? 0) / 3600, 0);
    return hours > 0 ? hours : null;
  }, [activities, aLoading]);
  const athleteName = process.env.NEXT_PUBLIC_ATHLETE_NAME ?? "Athlet";

  const isLoading = wLoading || aLoading;

  return (
    <>
      {/* Top Bar */}
      <header className="sticky top-0 z-10 bg-dash-bg/95 backdrop-blur border-b border-dash-border px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-sm font-semibold text-white">{athleteName}</h1>
          <p className="text-[10px] text-dash-muted">
            {format(new Date(), "EEEE, d. MMMM yyyy", { locale: de })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector value={period} onChange={setPeriod} />
          <button
            onClick={() => { refetchWellness(); refetchActivities(); }}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-dash-border text-dash-muted hover:text-white hover:border-white/30 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Aktualisieren</span>
          </button>
        </div>
      </header>

      {wError && (
        <div className="mx-6 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          <p>Wellness-Fehler: {wError}</p>
          <p className="mt-1 text-red-400/70">Prüfe .env.local → INTERVALS_ATHLETE_ID und INTERVALS_API_KEY.</p>
        </div>
      )}

      <div className="p-6 space-y-6 max-w-[1400px]">

        {/* Heutiges Training */}
        <section>
          <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-3">Heutiges Training</p>
          {isLoading
            ? <Skeleton className="h-16" />
            : <TodayWorkout events={events} activities={activities} athleteId={athleteId} />
          }
        </section>

        {/* Wetter */}
        <section>
          <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-3">Heute in Coesfeld</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <WeatherCard />
          </div>
        </section>

        {/* Garmin */}
        <GarminCards />

        {/* Haupt-Metriken: Readiness + Recovery + CV-Ampel */}
        <section>
          <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-3">Tagesstatus</p>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[0,1,2].map(i => <Skeleton key={i} className="h-44" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
              <Link href="/hrv" className="flex">
                <div className="w-full hover:opacity-90 transition-opacity">
                  <TrainingReadiness value={metrics.trainingReadiness} />
                </div>
              </Link>
              <Link href="/hrv" className="flex">
                <div className="w-full hover:opacity-90 transition-opacity">
                  <RecoveryScore value={metrics.recoveryScore} />
                </div>
              </Link>
              <CVAmpelCompact
                zone={metrics.cvZone}
                label={metrics.cvZoneLabel}
                advice={metrics.cvZoneAdvice}
                trendRatio={metrics.trendRatio}
                cv={metrics.cv}
                tsb={latestTSB}
                readiness={metrics.trainingReadiness}
                ctl={latestCTL ?? null}
                weeklyHours={weeklyHours}
              />
            </div>
          )}
        </section>

        {/* Kennzahlen mit Trend-Pfeilen */}
        <section>
          <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-3">Kennzahlen</p>
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <MetricCard
                label={<Tooltip term="HRV">HRV</Tooltip>}
                value={todayHRV != null ? todayHRV.toFixed(1) : null}
                icon={<Heart size={10} />}
                color={todayHRV && metrics.hrv7 && todayHRV >= metrics.hrv7 ? "text-emerald-400" : "text-orange-400"}
                sub={metrics.hrv7 ? `Ø7: ${metrics.hrv7.toFixed(1)}` : undefined}
                trend={trends.hrv}
                positiveIsGood={true}
                href="/hrv"
              />
              <MetricCard
                label="Ruhepuls"
                value={today?.restingHR ?? null}
                unit="bpm"
                icon={<Heart size={10} />}
                color="text-red-400"
                trend={trends.rhr}
                positiveIsGood={false}
                href="/hrv"
              />
              <MetricCard
                label={<Tooltip term="CV">CV</Tooltip>}
                value={metrics.cv != null ? `${metrics.cv.toFixed(1)}` : null}
                unit="%"
                color={metrics.cv != null && metrics.cv < 6.5 ? "text-emerald-400" : "text-yellow-400"}
                sub={metrics.cv != null ? (metrics.cv < 6.5 ? "Stabil" : "Variabel") : undefined}
                href="/hrv"
              />
              <MetricCard
                label={<Tooltip term="CTL">CTL (Fitness)</Tooltip>}
                value={latestCTL != null ? latestCTL.toFixed(1) : null}
                icon={<TrendingUp size={10} />}
                color="text-blue-400"
                trend={trends.ctl}
                positiveIsGood={true}
                href="/fitness"
              />
              <MetricCard
                label={<Tooltip term="ATL">ATL (Ermüdung)</Tooltip>}
                value={latestATL != null ? latestATL.toFixed(1) : null}
                color="text-orange-400"
                trend={trends.atl}
                positiveIsGood={false}
                href="/fitness"
              />
              <MetricCard
                label={<Tooltip term="TSB">TSB (Form)</Tooltip>}
                value={latestTSB != null ? latestTSB.toFixed(1) : null}
                color={latestTSB != null && latestTSB >= 0 ? "text-emerald-400" : "text-orange-400"}
                sub={latestTSB != null ? (latestTSB >= 5 ? "Frisch" : latestTSB >= 0 ? "Neutral" : "Ermüdet") : undefined}
                trend={trends.tsb}
                positiveIsGood={true}
                href="/fitness"
              />
            </div>
          )}
        </section>

        {/* Wellness-Schnellblick */}
        {!isLoading && today && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium">Wellness heute</p>
              <Link href="/wellness" className="text-[10px] text-accent hover:opacity-80 transition-opacity">
                Alle Daten →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {today.sleepScore != null && (
                <MetricCard
                  label="Schlaf-Score"
                  value={today.sleepScore}
                  icon={<Moon size={10} />}
                  color="text-blue-400"
                  trend={trends.sleep}
                  positiveIsGood={true}
                  href="/wellness"
                />
              )}
              {today.sleepSecs != null && (
                <MetricCard
                  label="Schlaf"
                  value={(today.sleepSecs / 3600).toFixed(1)}
                  unit="h"
                  icon={<Moon size={10} />}
                  color="text-blue-400"
                  trend={trends.sleep}
                  positiveIsGood={true}
                  href="/wellness"
                />
              )}
              {today.mood != null && (
                <MetricCard
                  label="Stimmung"
                  value={today.mood}
                  unit="/5"
                  color={today.mood >= 4 ? "text-emerald-400" : today.mood >= 3 ? "text-yellow-400" : "text-red-400"}
                  href="/wellness"
                />
              )}
              {today.fatigue != null && (
                <MetricCard
                  label="Erschöpfung"
                  value={today.fatigue}
                  unit="/5"
                  color={today.fatigue <= 2 ? "text-emerald-400" : today.fatigue <= 3 ? "text-yellow-400" : "text-red-400"}
                  href="/wellness"
                />
              )}
            </div>
          </section>
        )}

        {/* Quick-Links */}
        <section>
          <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-3">Bereiche</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { href: "/hrv",      label: "HRV & Erholung",  desc: "HRV-Trend, CV-Ampel, Readiness",   icon: Heart,     color: "text-pink-400",   bg: "bg-pink-500/10 border-pink-500/20",   pageId: null },
              { href: "/fitness",  label: "Fitness-Trend",   desc: "CTL, ATL, TSB, PMC-Chart",         icon: TrendingUp, color: "text-blue-400",  bg: "bg-blue-500/10 border-blue-500/20",   pageId: null },
              { href: "/training", label: "Training",         desc: "Wöchentliche Aktivitäts-Charts",   icon: Dumbbell,  color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", pageId: "training" },
              { href: "/wellness", label: "Wellness",         desc: "Schlaf, Stimmung, Vergleiche",     icon: Activity,  color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", pageId: null },
              { href: "/koerper",  label: "Körper & Ziele",  desc: "Gewicht, Trends & Projektion",     icon: Scale,     color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", pageId: "koerper" },
              { href: "/calendar", label: "Kalender",         desc: "Geplante Workouts & Events",       icon: Zap,       color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20", pageId: null },
            ].filter(({ pageId }) => pageId === null || pageSettings[pageId] !== false)
             .map(({ href, label, desc, icon: Icon, color, bg }) => (
              <Link
                key={href}
                href={href}
                className={clsx("p-4 rounded-2xl border transition-all hover:scale-[1.01]", bg)}
              >
                <Icon size={16} className={clsx("mb-2", color)} />
                <p className="text-sm font-medium text-white">{label}</p>
                <p className="text-[11px] text-dash-muted mt-0.5">{desc}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
