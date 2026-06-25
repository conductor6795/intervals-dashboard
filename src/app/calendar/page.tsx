"use client";
import { useState } from "react";
import { RefreshCw, Eye, EyeOff } from "lucide-react";
import { clsx } from "clsx";

import WorkoutCalendar from "@/components/calendar/WorkoutCalendar";
import { useActivities, useEvents } from "@/hooks/useActivities";
import { useWellness } from "@/hooks/useWellness";

function Skeleton() {
  return <div className="flex-1 animate-pulse rounded-2xl bg-dash-card border border-dash-border" />;
}

export default function CalendarPage() {
  const [showProRaces, setShowProRaces] = useState(true);
  const { activities, loading: aLoading, error: aError, refetch } = useActivities(90);
  const { events } = useEvents();
  const { data: wellness } = useWellness(90);

  return (
    <>
      <header className="sticky top-0 z-10 shrink-0 bg-dash-bg/95 backdrop-blur border-b border-dash-border px-3 sm:px-6 py-3 flex items-center justify-between">
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
        <div className="mx-3 sm:mx-6 mt-3 shrink-0 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          {aError}
        </div>
      )}

      {/* flex-1 so this area fills all remaining screen height */}
      <div className="flex-1 min-h-0 p-3 sm:p-4 flex flex-col">
        {aLoading ? (
          <Skeleton />
        ) : (
          <WorkoutCalendar
            activities={activities}
            events={events}
            wellness={wellness}
            showProRaces={showProRaces}
          />
        )}
      </div>
    </>
  );
}
