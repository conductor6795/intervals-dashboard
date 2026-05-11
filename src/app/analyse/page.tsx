"use client";
import { RefreshCw } from "lucide-react";
import { clsx } from "clsx";

import { useWellness } from "@/hooks/useWellness";
import { useActivities } from "@/hooks/useActivities";
import HRVFactorChart from "@/components/wellness/HRVFactorChart";
import { usePeriod } from "@/hooks/usePeriod";
import PeriodSelector from "@/components/ui/PeriodSelector";

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "animate-pulse rounded-2xl bg-dash-card border border-dash-border",
        className,
      )}
    />
  );
}

export default function AnalysePage() {
  const { period, setPeriod, days } = usePeriod("1y");
  const { data: wellness, loading: wLoading, error: wError, refetch: refetchWellness } =
    useWellness(days);
  const { activities, loading: aLoading, refetch: refetchActivities } = useActivities(days);

  const isLoading = wLoading || aLoading;

  return (
    <>
      <header className="sticky top-0 z-10 bg-dash-bg/95 backdrop-blur border-b border-dash-border px-6 py-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-sm font-semibold text-white">Analyse</h1>
          <p className="text-[10px] text-dash-muted">Statistische Auswertung deiner Trainingsdaten</p>
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
          {wError}
        </div>
      )}

      <div className="p-6 max-w-[900px] space-y-8">
        <section>
          <div className="mb-4">
            <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium">
              HRV-Einflussfaktoren
            </p>
            <p className="text-xs text-dash-muted/70 mt-1">
              Welche Faktoren vom Vortag beeinflussen deine HRV am nächsten Morgen?
              Basiert auf {wellness.length} Wellness-Tagen und {activities.length} Aktivitäten.
            </p>
          </div>
          {isLoading ? (
            <Skeleton className="h-[320px]" />
          ) : (
            <HRVFactorChart wellness={wellness} activities={activities} />
          )}
        </section>
      </div>
    </>
  );
}
