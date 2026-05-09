"use client";
import { useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { clsx } from "clsx";

import TrainingReadiness from "@/components/metrics/TrainingReadiness";
import RecoveryScore from "@/components/metrics/RecoveryScore";
import CVAmpel from "@/components/metrics/CVAmpel";
import HRVChart from "@/components/charts/HRVChart";

import { useWellness } from "@/hooks/useWellness";
import { calcAllMetrics, buildDailyMetrics, getHRV } from "@/lib/calculations";

function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-2xl bg-dash-card border border-dash-border", className)} />;
}

function PageHeader({ title, loading, onRefresh }: { title: string; loading: boolean; onRefresh: () => void }) {
  return (
    <header className="sticky top-0 z-10 bg-dash-bg/95 backdrop-blur border-b border-dash-border px-6 py-3 flex items-center justify-between">
      <h1 className="text-sm font-semibold text-white">{title}</h1>
      <button
        onClick={onRefresh}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-dash-border text-dash-muted hover:text-white hover:border-indigo-500/50 transition-colors disabled:opacity-50"
      >
        <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        Aktualisieren
      </button>
    </header>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-dash-border last:border-0">
      <span className="text-xs text-dash-muted">{label}</span>
      <span className="text-xs font-medium text-white tabular-nums">{value}</span>
    </div>
  );
}

export default function HRVPage() {
  const { data: wellness, loading, error, refetch } = useWellness(90);

  const metrics = useMemo(() => calcAllMetrics(wellness), [wellness]);
  const dailyMetrics = useMemo(() => buildDailyMetrics(wellness), [wellness]);

  const today = wellness[wellness.length - 1];
  const todayHRV = today ? getHRV(today) : null;

  return (
    <>
      <PageHeader title="HRV & Erholung" loading={loading} onRefresh={refetch} />

      {error && (
        <div className="mx-6 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="p-6 space-y-6 max-w-[1400px]">

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
              <TrainingReadiness value={metrics.trainingReadiness} />
              <RecoveryScore value={metrics.recoveryScore} />
            </div>
          )}
        </section>

        {/* CV-Ampel + Kennzahlen */}
        <section>
          <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-4">CV-Ampel & Werte</p>
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
                trendRatio={metrics.trendRatio}
                cv={metrics.cv}
                hrv7={metrics.hrv7}
              />
              {/* Zusatz-Wellness */}
              <div className="p-5 rounded-2xl border border-dash-border bg-dash-card">
                <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-4">Wellness heute</p>
                {today && (
                  <div className="space-y-0">
                    <StatRow label="HRV (heute)" value={todayHRV != null ? `${todayHRV.toFixed(1)} ms` : "–"} />
                    <StatRow label="HRV7 (Ø 7 Tage)" value={metrics.hrv7 != null ? `${metrics.hrv7.toFixed(1)} ms` : "–"} />
                    <StatRow label="Trend-Ratio" value={metrics.trendRatio != null ? `${metrics.trendRatio.toFixed(1)} %` : "–"} />
                    <StatRow label="CV" value={metrics.cv != null ? `${metrics.cv.toFixed(1)} %` : "–"} />
                    <StatRow label="Ruhepuls" value={today.restingHR != null ? `${today.restingHR} bpm` : "–"} />
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
          <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-4">HRV-Verlauf</p>
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
              <p><span className="text-white font-medium">Trainingsbereitschaft</span> – HRV-Trend 40 % · Schlaf 25 % · RHR 15 % · Subjektiv 15 % · CV 5 %</p>
              <p><span className="text-white font-medium">Subjektiv-Gewichtung</span> – Erschöpfung 35 % · Kater 30 % · Stimmung 20 % · Motivation 15 %</p>
            </div>
            <div className="space-y-1.5">
              <p><span className="text-white font-medium">Erholung</span> – HRV-Ratio 40 % · Schlaf 30 % · RHR 15 % · Erschöpfung+Kater 15 %</p>
              <p><span className="text-white font-medium">CV-Schwelle</span> – 6,5 % nach Plews et al. 2012/2013. Trainierte Athleten können niedrigere individuelle Werte aufweisen.</p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
