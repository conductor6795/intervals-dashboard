"use client";
import { useState } from "react";
import { RefreshCw, Eye, EyeOff } from "lucide-react";
import { clsx } from "clsx";

import WorkoutCalendar from "@/components/calendar/WorkoutCalendar";
import { useActivities, useEvents } from "@/hooks/useActivities";

function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-2xl bg-dash-card border border-dash-border", className)} />;
}

export default function CalendarPage() {
  const [showProRaces, setShowProRaces] = useState(true);
  const { activities, loading: aLoading, error: aError, refetch } = useActivities(60);
  const { events } = useEvents();

  return (
    <>
      <header className="sticky top-0 z-10 bg-dash-bg/95 backdrop-blur border-b border-dash-border px-6 py-3 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-white">Kalender</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowProRaces((v) => !v)}
            className={clsx(
              "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-colors",
              showProRaces
                ? "border-indigo-500 bg-indigo-500/10 text-indigo-400"
                : "border-dash-border text-dash-muted hover:border-indigo-500/50"
            )}
          >
            {showProRaces ? <Eye size={12} /> : <EyeOff size={12} />}
            Profi-Rennen
          </button>
          <button
            onClick={refetch}
            disabled={aLoading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-dash-border text-dash-muted hover:text-white hover:border-indigo-500/50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={aLoading ? "animate-spin" : ""} />
            Aktualisieren
          </button>
        </div>
      </header>

      {aError && (
        <div className="mx-6 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">{aError}</div>
      )}

      <div className="p-6 max-w-[1400px]">
        {aLoading ? (
          <Skeleton className="h-[520px]" />
        ) : (
          <WorkoutCalendar activities={activities} events={events} showProRaces={showProRaces} />
        )}
      </div>
    </>
  );
}
