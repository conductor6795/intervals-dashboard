"use client";
import { useState } from "react";
import { CheckCircle2, Dumbbell, ExternalLink, Calendar } from "lucide-react";
import { IntervalsEvent, Activity } from "@/lib/types";
import dynamic from "next/dynamic";

const ActivityDetailOverlay = dynamic(
  () => import("@/components/calendar/ActivityDetailOverlay"),
  { ssr: false }
);

interface Props {
  events: IntervalsEvent[];
  activities: Activity[];
  athleteId?: string;
}

const SPORT_ICONS: Record<string, string> = {
  Ride: "🚴", VirtualRide: "🚴", Run: "🏃", VirtualRun: "🏃",
  Swim: "🏊", Strength: "🏋️", Workout: "⚡", Walk: "🚶",
};

function sportIcon(type?: string) {
  return SPORT_ICONS[type ?? ""] ?? "⚡";
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function TodayWorkout({ events, activities, athleteId = "" }: Props) {
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const today = todayStr();

  const todayActivities = activities.filter(
    (a) => a.start_date_local?.slice(0, 10) === today
  );
  const todayEvents = events.filter(
    (e) => e.start_date_local?.slice(0, 10) === today
  );

  // Dedup: für jeden Event-Typ zählen wir, wie viele Activities bereits absolviert wurden.
  const completedCountByType: Record<string, number> = {};
  todayActivities.forEach((a) => {
    const t = (a.type ?? "").toLowerCase();
    completedCountByType[t] = (completedCountByType[t] ?? 0) + 1;
  });

  const usedCountByType: Record<string, number> = {};
  const remainingEvents: IntervalsEvent[] = [];
  for (const e of todayEvents) {
    const t = (e.type ?? "").toLowerCase();
    const used = usedCountByType[t] ?? 0;
    if (used < (completedCountByType[t] ?? 0)) {
      usedCountByType[t] = used + 1;
    } else {
      remainingEvents.push(e);
    }
  }

  if (todayActivities.length === 0 && remainingEvents.length === 0) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-2xl border border-dash-border bg-dash-card/50">
        <div className="w-10 h-10 rounded-xl bg-dash-border/50 flex items-center justify-center shrink-0">
          <Calendar size={18} className="text-dash-muted" />
        </div>
        <div>
          <p className="text-xs text-dash-muted uppercase tracking-wider font-medium">Heutiges Training</p>
          <p className="text-sm text-dash-muted mt-0.5">Kein Training geplant</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {todayActivities.map((activity) => (
        <div
          key={activity.id}
          onClick={() => setSelectedActivity(activity)}
          className="relative flex items-center gap-4 p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-white/5 transition-colors cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-lg shrink-0">
            {sportIcon(activity.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
              <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">
                Training absolviert
              </p>
            </div>
            <p className="text-sm text-white font-medium truncate">{activity.name}</p>
            <div className="flex gap-3 mt-0.5 text-[11px] text-dash-muted">
              {activity.moving_time && (
                <span>{Math.floor(activity.moving_time / 60)} min</span>
              )}
              {activity.distance && (
                <span>{(activity.distance / 1000).toFixed(1)} km</span>
              )}
              {activity.average_heartrate && (
                <span>Ø {Math.round(activity.average_heartrate)} bpm</span>
              )}
            </div>
          </div>
          {athleteId && (
            <a
              href={`https://intervals.icu/activities/${activity.id}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 text-dash-muted hover:text-indigo-400 transition-colors"
              title="Auf intervals.icu öffnen"
            >
              <ExternalLink size={16} />
            </a>
          )}
        </div>
      ))}

      {remainingEvents.map((event) => {
        const href = athleteId
          ? `https://intervals.icu/athlete/${athleteId}/calendar/${today}`
          : null;
        const inner = (
          <div className="relative flex items-center gap-4 p-4 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 hover:bg-white/5 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-lg shrink-0">
              {event.type && SPORT_ICONS[event.type]
                ? <span>{SPORT_ICONS[event.type]}</span>
                : <Dumbbell size={18} className="text-indigo-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-indigo-400 uppercase tracking-wider font-semibold mb-0.5">
                Geplantes Training
              </p>
              <p className="text-sm text-white font-medium truncate">{event.name}</p>
              <div className="flex gap-3 mt-0.5 text-[11px] text-dash-muted">
                {event.load != null && <span>TSS {Math.round(event.load)}</span>}
                {event.description && (
                  <span className="truncate">{event.description}</span>
                )}
              </div>
            </div>
            {href && (
              <ExternalLink size={16} className="shrink-0 text-dash-muted" />
            )}
          </div>
        );

        return href ? (
          <a key={event.id} href={href} target="_blank" rel="noopener noreferrer">
            {inner}
          </a>
        ) : (
          <div key={event.id}>{inner}</div>
        );
      })}

      <ActivityDetailOverlay
        activity={selectedActivity}
        onClose={() => setSelectedActivity(null)}
      />
    </div>
  );
}
