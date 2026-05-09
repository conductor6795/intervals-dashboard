import { IntervalsEvent, WellnessDay } from "./types";
import { format, addDays, parseISO, differenceInDays } from "date-fns";

export interface ProjectedPoint {
  date: string;
  dateLabel: string;
  ctl: number;
  atl: number;
  tsb: number;
  plannedTSS: number;
  isProjected: true;
}

export interface HistoricalPoint {
  date: string;
  dateLabel: string;
  ctl: number | null;
  atl: number | null;
  tsb: number | null;
  isProjected: false;
}

export type PMCPoint = HistoricalPoint | ProjectedPoint;

export interface ProgressionResult {
  points: PMCPoint[];
  lastPlannedDate: string | null; // YYYY-MM-DD of last event with load
}

/**
 * Projiziert CTL/ATL/TSB basierend auf geplanten Workouts.
 * Die Projektion endet am letzten Tag mit einem geplanten Workout (load > 0).
 * Coggan & Hunter PMC-Formeln:
 *   CTL(t) = CTL(t-1) + (TSS - CTL(t-1)) / 42
 *   ATL(t) = ATL(t-1) + (TSS - ATL(t-1)) / 7
 */
export function buildProgression(
  wellness: WellnessDay[],
  events: IntervalsEvent[],
): ProgressionResult {
  const historical: HistoricalPoint[] = wellness.map((d) => ({
    date: d.id,
    dateLabel: format(parseISO(d.id), "dd.MM."),
    ctl: d.ctl ?? null,
    atl: d.atl ?? null,
    tsb: d.ctl != null && d.atl != null ? d.ctl - d.atl : null,
    isProjected: false,
  }));

  const last = wellness[wellness.length - 1];
  if (!last || last.ctl == null || last.atl == null) {
    return { points: historical, lastPlannedDate: null };
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  // Index planned events by date, find last planned date in the future
  const plannedByDate = new Map<string, number>();
  let lastPlannedDate: string | null = null;

  events.forEach((e) => {
    if (e.load && e.load > 0) {
      const key = e.start_date_local?.slice(0, 10);
      if (key && key > todayStr) {
        plannedByDate.set(key, (plannedByDate.get(key) ?? 0) + e.load);
        if (!lastPlannedDate || key > lastPlannedDate) lastPlannedDate = key;
      }
    }
  });

  if (!lastPlannedDate) {
    return { points: historical, lastPlannedDate: null };
  }

  const projectionDays = differenceInDays(parseISO(lastPlannedDate), parseISO(todayStr));

  let ctl = last.ctl;
  let atl = last.atl;
  const projected: ProjectedPoint[] = [];

  for (let i = 1; i <= projectionDays; i++) {
    const d = addDays(parseISO(todayStr), i);
    const dateStr = format(d, "yyyy-MM-dd");
    const tss = plannedByDate.get(dateStr) ?? 0;

    ctl = ctl + (tss - ctl) / 42;
    atl = atl + (tss - atl) / 7;

    projected.push({
      date: dateStr,
      dateLabel: format(d, "dd.MM."),
      ctl: parseFloat(ctl.toFixed(1)),
      atl: parseFloat(atl.toFixed(1)),
      tsb: parseFloat((ctl - atl).toFixed(1)),
      plannedTSS: tss,
      isProjected: true,
    });
  }

  return { points: [...historical, ...projected], lastPlannedDate };
}

/** Gibt das Datum und den Wert des projizierten CTL-Maximums zurück */
export function findProjectedPeak(points: PMCPoint[]): { date: string; ctl: number } | null {
  const proj = points.filter((p): p is ProjectedPoint => p.isProjected);
  if (proj.length === 0) return null;
  const peak = proj.reduce((a, b) => (b.ctl > a.ctl ? b : a));
  return { date: peak.dateLabel, ctl: peak.ctl };
}
