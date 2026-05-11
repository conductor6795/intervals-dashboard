"use client";
import { CheckCircle2, Dumbbell, ExternalLink, Calendar } from "lucide-react";
import { IntervalsEvent, Activity } from "@/lib/types";

interface Props {
  events: IntervalsEvent[];
  activities: Activity[];
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

export default function TodayWorkout({ events, activities }: Props) {
  const today = todayStr();
  const athleteId = process.env.NEXT_PUBLIC_ATHLETE_ID ?? "";

  const todayActivities = activities.filter(
    (a) => a.start_date_local?.slice(0, 10) === today
  );
  const todayEvents = events.filter(
    (e) => e.start_date_local?.slice(0, 10) === today
  );

  // Dedup: für jeden Event-Typ zählen wir, wie viele Activities bereits absolviert wurden.
  // Events, die durch eine gleichartige Activity abgedeckt sind, werden ausgeblendet.
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
      {todayActivities.map((activity) => {
        const actLink = athleteId
          ? `https://intervals.icu/activities/${activity.id}`
          : null;
        return (
          <div
            key={activity.id}
            className="flex items-center gap-4 p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5"
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
            {actLink && (
              <a
                href={actLink}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 hover:border-emerald-400/50 rounded-lg px-3 py-1.5 transition-colors"
              >
                Intervals
                <ExternalLink size={11} />
              </a>
            )}
          </div>
        );
      })}

      {remainingEvents.map((event) => {
        const calLink = athleteId
          ? `https://intervals.icu/athletes/${athleteId}/calendar`
          : null;
        return (
          <div
            key={event.id}
            className="flex items-center gap-4 p-4 rounded-2xl border border-indigo-500/30 bg-indigo-500/5"
          >
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
            {calLink && (
              <a
                href={calLink}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-400/50 rounded-lg px-3 py-1.5 transition-colors"
              >
                Intervals
                <ExternalLink size={11} />
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
