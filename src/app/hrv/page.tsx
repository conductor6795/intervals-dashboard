"use client";
import { useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { clsx } from "clsx";

import TrainingReadiness from "@/components/metrics/TrainingReadiness";
import RecoveryScore from "@/components/metrics/RecoveryScore";
import CVAmpel from "@/components/metrics/CVAmpel";
import HRVChart from "@/components/charts/HRVChart";

import { useWellness } from "@/hooks/useWellness";
import { useGarmin } from "@/hooks/useGarmin";
import { calcAllMetrics, buildDailyMetrics, getHRV, calcVetoedReadiness } from "@/lib/calculations";
import { usePeriod } from "@/hooks/usePeriod";
import PeriodSelector from "@/components/ui/PeriodSelector";
import Tooltip from "@/components/ui/Tooltip";

function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-2xl bg-dash-card border border-dash-border", className)} />;
}

function PageHeader({ title, loading, onRefresh, children }: { title: string; loading: boolean; onRefresh: () => void; children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 bg-dash-bg/95 backdrop-blur border-b border-dash-border px-3 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
      <h1 className="text-sm font-semibold text-white">{title}</h1>
      <div className="flex items-center gap-2 flex-wrap">
        {children}
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-dash-border text-dash-muted hover:text-white hover:border-indigo-500/50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Aktualisieren
        </button>
      </div>
    </header>
  );
}

function StatRow({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-dash-border last:border-0">
      <span className="text-xs text-dash-muted">{label}</span>
      <span className="text-xs font-medium text-white tabular-nums">{value}</span>
    </div>
  );
}

export default function HRVPage() {
  const { period, setPeriod, days } = usePeriod("3m");
  const { data: wellness, loading, error, refetch } = useWellness(days);

  const metrics = useMemo(() => calcAllMetrics(wellness), [wellness]);
  const dailyMetrics = useMemo(() => buildDailyMetrics(wellness), [wellness]);

  const { data: garmin } = useGarmin();
  const garminToday = garmin[garmin.length - 1];
  const vetoed = calcVetoedReadiness(garminToday?.readinessScore ?? null, wellness);
  const readinessValue = vetoed ? vetoed.value : metrics.trainingReadiness;

  const today = wellness[wellness.length - 1];
  const todayHRV = today ? getHRV(today) : null;

  return (
    <>
      <PageHeader title="HRV & Erholung" loading={loading} onRefresh={refetch}>
        <PeriodSelector value={period} onChange={setPeriod} />
      </PageHeader>

      {error && (
        <div className="mx-6 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="p-3 sm:p-6 space-y-6 w-full">

        {/* Readiness + Recovery */}
        <section>
          <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-4">Tagesstatus</p>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Skeleton className="h-44" />
              <Skeleton className="h-44" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TrainingReadiness value={readinessValue} />
              <RecoveryScore value={metrics.recoveryScore} />
            </div>
          )}
        </section>

        {/* CV-Ampel + Kennzahlen */}
        <section>
          <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-4"><Tooltip term="CV">CV</Tooltip>-Ampel & Werte</p>
          {loading ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <CVAmpel
                zone={metrics.cvZone}
                label={metrics.cvZoneLabel}
                advice={metrics.cvZoneAdvice}
                hrvPct={metrics.hrvPct}
                cv={metrics.cv}
                tsb={metrics.tsb}
                hrv7={metrics.hrv7}
              />
              {/* Zusatz-Wellness */}
              <div className="p-5 rounded-2xl border border-dash-border bg-dash-card">
                <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-4">Wellness heute</p>
                {today && (
                  <div className="space-y-0">
                    <StatRow label={<Tooltip term="HRV">HRV (heute)</Tooltip>} value={todayHRV != null ? `${todayHRV.toFixed(1)} ms` : "–"} />
                    <StatRow label={<Tooltip term="HRV">HRV7 (Ø 7 Tage)</Tooltip>} value={metrics.hrv7 != null ? `${metrics.hrv7.toFixed(1)} ms` : "–"} />
                    <StatRow label="Trend-Ratio" value={metrics.trendRatio != null ? `${metrics.trendRatio.toFixed(1)} %` : "–"} />
                    <StatRow label="hrv_pct (28-Tage-Perzentil)" value={metrics.hrvPct != null ? `${metrics.hrvPct.toFixed(0)} %` : "–"} />
                    <StatRow label={<Tooltip term="CV">CV</Tooltip>} value={metrics.cv != null ? `${metrics.cv.toFixed(1)} %` : "–"} />
                    <StatRow label={<Tooltip term="RHR">Ruhepuls</Tooltip>} value={today.restingHR != null ? `${today.restingHR} bpm` : "–"} />
                    {today.sleepScore != null && <StatRow label="Schlaf-Score" value={`${today.sleepScore}`} />}
                    {today.sleepSecs != null && <StatRow label="Schlafdauer" value={`${(today.sleepSecs / 3600).toFixed(1)} h`} />}
                    {today.fatigue != null && <StatRow label="Erschöpfung" value={`${today.fatigue} / 5`} />}
                    {today.soreness != null && <StatRow label="Muskelkater" value={`${today.soreness} / 5`} />}
                    {today.mood != null && <StatRow label="Stimmung" value={`${today.mood} / 5`} />}
                    {today.motivation != null && <StatRow label="Motivation" value={`${today.motivation} / 5`} />}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* HRV Chart */}
        <section>
          <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-4"><Tooltip term="HRV">HRV</Tooltip>-Verlauf</p>
          {loading ? (
            <Skeleton className="h-72" />
          ) : (
            <HRVChart wellnessData={wellness} dailyMetrics={dailyMetrics} />
          )}
        </section>

        {/* Methodik-Info */}
        <section className="p-5 rounded-2xl border border-dash-border bg-dash-card/50">
          <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-3">Berechnungsmethodik</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-dash-muted">
            <div className="space-y-1.5">
              <p><span className="text-white font-medium">Trainingsbereitschaft</span> – Garmins nativer Readiness-Score (Schlaf, HRV, Erholungszeit, akute Last, Stress), nach unten gedeckelt durch die Hard-Trigger. HRV wirkt als Veto, nicht als Treiber.</p>
              <p><span className="text-white font-medium">Tagescheck-Verdikt</span> – hrv_pct (rollender 28-Tage-Perzentil) + Tagessignal (hrv_today/hrv7) + CV + TSB. Hard-Trigger erzwingen Rot.</p>
            </div>
            <div className="space-y-1.5">
              <p><span className="text-white font-medium">Erholung</span> – HRV-Ratio 30 % · Schlaf 25 % · Last/TSB 20 % · RHR 15 % · Muskelkater 10 % (Notion = Quelle der Wahrheit).</p>
              <p><span className="text-white font-medium">CV-Schwelle</span> – 12 % Warnzone / 15 % instabil (athleten-konstanten.md, individuell über 294 Tage kalibriert). Plews&nbsp;6,5&nbsp;% gilt für ln(RMSSD); auf roher HRV läuft dein CV ~2× höher.</p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
