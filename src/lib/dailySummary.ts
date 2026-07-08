/**
 * Tagesübersicht im Bevel-Stil: drei Ringe (Belastung, Erholung, Schlaf), jeweils
 * mit Prozent-Füllung und kurzem Coaching-Satz. Nutzt ausschließlich bereits im
 * Dashboard vorhandene Daten (Aktivitäten, Wellness, Garmin) — keine neue Quelle.
 */
import { Activity, WellnessDay } from "./types";
import { GarminDay } from "@/hooks/useGarmin";

export type SummaryLevel = "good" | "ok" | "warn" | "bad";

export interface RingSummary {
  label: string;
  pct: number; // 0–100, für die Ringfüllung
  displayValue: string;
  sub: string;
  coach: string;
  level: SummaryLevel;
}

export interface DailySummary {
  load: RingSummary;
  recovery: RingSummary;
  sleep: RingSummary;
}

function mean(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

export function calcDailySummary(
  wellnessDays: WellnessDay[],
  activities: Activity[],
  recoveryScore: number,
  garminToday: GarminDay | undefined
): DailySummary {
  // ── Belastung: heutige Trainingslast vs. 28-Tage-Tagesdurchschnitt ──
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayLoad = activities
    .filter((a) => a.start_date_local?.slice(0, 10) === todayStr)
    .reduce((s, a) => s + (a.icu_training_load ?? 0), 0);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 28);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const byDay = new Map<string, number>();
  activities
    .filter((a) => a.start_date_local >= cutoffStr)
    .forEach((a) => {
      const d = a.start_date_local.slice(0, 10);
      byDay.set(d, (byDay.get(d) ?? 0) + (a.icu_training_load ?? 0));
    });
  const avgActiveLoad = byDay.size ? mean(Array.from(byDay.values())) : 0;

  // Bezugsgröße für "viel/wenig heute" ist die CTL (chronische Trainingslast =
  // typische Tageslast in TSS über 42 Tage). Der Ø aktiver Tage taugt NICHT: viele
  // niedrige Pendel-Tage ziehen ihn nach unten, dann wirkt jede echte Einheit "hoch".
  const latestCtlLoad = [...wellnessDays].reverse().find((d) => d.ctl != null)?.ctl ?? null;
  const refLoad = latestCtlLoad && latestCtlLoad > 0 ? latestCtlLoad : (avgActiveLoad > 0 ? avgActiveLoad : 50);
  const loadRatio = refLoad > 0 ? todayLoad / refLoad : 0;
  // Voller Ring = ~2× CTL (ein sehr harter Tag).
  const loadPct = refLoad > 0 ? Math.min(100, (todayLoad / (refLoad * 2)) * 100) : 0;

  let loadLevel: SummaryLevel = "ok";
  let loadCoach: string;
  if (todayLoad === 0) {
    loadLevel = "ok";
    loadCoach = "Noch keine Belastung heute erfasst.";
  } else if (loadRatio < 0.8) {
    loadLevel = "good";
    loadCoach = "Leichter Tag – Kapazität für mehr.";
  } else if (loadRatio < 1.4) {
    loadLevel = "ok";
    loadCoach = "Ausgewogene Tagesbelastung.";
  } else if (loadRatio < 2.0) {
    loadLevel = "warn";
    loadCoach = "Fordernder Tag – Erholung einplanen.";
  } else {
    loadLevel = "bad";
    loadCoach = "Sehr hohe Belastung – Regeneration priorisieren.";
  }

  // ── Erholung: bestehender Recovery-Score ──
  let recLevel: SummaryLevel;
  let recCoach: string;
  if (recoveryScore >= 75) {
    recLevel = "good";
    recCoach = "Gut erholt – bereit für Belastung.";
  } else if (recoveryScore >= 50) {
    recLevel = "ok";
    recCoach = "Teilerholt – moderates Training.";
  } else if (recoveryScore >= 25) {
    recLevel = "warn";
    recCoach = "Ermüdet – Umfang reduzieren.";
  } else {
    recLevel = "bad";
    recCoach = "Überlastet – Ruhetag empfohlen.";
  }

  // ── Schlaf: Garmin-Score bevorzugt, sonst Näherung über Stunden ──
  const latestWellness = wellnessDays[wellnessDays.length - 1];
  const sleepScore = garminToday?.sleepScore ?? latestWellness?.sleepScore ?? null;
  const sleepSecs = garminToday?.sleepSecs ?? latestWellness?.sleepSecs ?? null;
  const sleepH = sleepSecs != null ? sleepSecs / 3600 : null;
  const sleepPct = sleepScore ?? (sleepH != null ? Math.min(100, (sleepH / 8) * 100) : 0);

  let sleepLevel: SummaryLevel;
  let sleepCoach: string;
  if (sleepScore == null && sleepH == null) {
    sleepLevel = "ok";
    sleepCoach = "Keine Schlafdaten für heute Nacht.";
  } else if (sleepPct >= 80) {
    sleepLevel = "good";
    sleepCoach = "Erholsame Nacht.";
  } else if (sleepPct >= 60) {
    sleepLevel = "ok";
    sleepCoach = "Solide Nacht, etwas Luft nach oben.";
  } else if (sleepPct >= 40) {
    sleepLevel = "warn";
    sleepCoach = "Knapper Schlaf – heute früher ins Bett.";
  } else {
    sleepLevel = "bad";
    sleepCoach = "Deutlich zu wenig Schlaf – Erholung priorisieren.";
  }

  return {
    load: {
      label: "Belastung",
      pct: Math.min(100, loadPct),
      displayValue: todayLoad > 0 ? `${Math.round(todayLoad)}` : "–",
      sub: latestCtlLoad && latestCtlLoad > 0 ? `CTL ${Math.round(latestCtlLoad)}` : "",
      coach: loadCoach,
      level: loadLevel,
    },
    recovery: {
      label: "Erholung",
      pct: recoveryScore,
      displayValue: `${recoveryScore}%`,
      sub: "",
      coach: recCoach,
      level: recLevel,
    },
    sleep: {
      label: "Schlaf",
      pct: Math.min(100, sleepPct),
      displayValue: sleepH != null ? `${sleepH.toFixed(1)}h` : sleepScore != null ? `${sleepScore}` : "–",
      sub: sleepScore != null ? `Score ${sleepScore}` : "",
      coach: sleepCoach,
      level: sleepLevel,
    },
  };
}
