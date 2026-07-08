/**
 * Schlafcoach — lernt aus den eigenen Daten und empfiehlt die beste Bettzeit.
 *
 * Ansatz (angelehnt an Bevel & Whoop):
 *  1. Aus der Historie wird der individuelle OPTIMAL-Schlafbedarf gelernt: welche
 *     Schlafdauer ging bei DIR mit den besten Erholungs-/Schlaf-Scores einher?
 *     (statt pauschal Aufstehzeit − 8 h). Erst wenn zu wenig Historie da ist,
 *     greift der Basiswert aus den Einstellungen.
 *  2. Auf diesen Optimalbedarf kommen die Tages-Feinjustierungen: Schlafschuld,
 *     Trainingsbelastung, Stress und heutige Nickerchen.
 *  3. Rückrechnung von der Ziel-Aufstehzeit (Wochentag/Wochenende getrennt) →
 *     empfohlene Bettzeit (Licht aus) + spätester Einschlaf-Zeitpunkt.
 *  4. Zusätzlich: Schlafregelmäßigkeit (Sleep Consistency, Whoop-Signal) aus der
 *     Streuung der Einschlaf-/Aufwachzeiten der letzten zwei Wochen.
 *
 * Einschränkung: Garmin liefert nur den erkannten Schlafbeginn (sleepStartLocal),
 * nicht den Zeitpunkt des Zubettgehens. "Licht aus" ist daher eine Schätzung
 * (Schlafbeginn − angenommene Einschlaflatenz).
 */
import { GarminDay } from "@/hooks/useGarmin";
import { WellnessDay } from "./types";
import { SleepCoachSettings } from "./sleepSettings";
import { getHRV } from "./calculations";

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
function mean(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

export interface SleepCoachPlan {
  totalNeedH: number;
  baseNeedH: number;              // Ausgangsbedarf (gelernt oder Basiswert)
  isLearned: boolean;            // true = baseNeedH aus eigenen Daten gelernt
  strainAdjustMin: number;
  stressAdjustMin: number;
  debtAdjustMin: number;
  sleepDebtH: number;
  wakeTime: string;
  wakeIsWeekday: boolean;
  sleepByTime: string;
  lightsOutTime: string;
  reasoning: string[];
  lastNight: {
    sleepStart: string | null;
    sleepEnd: string | null;
    durationH: number | null;
  } | null;
  consistencyScore: number | null;   // 0–100, Regelmäßigkeit der Schlafzeiten
  consistencyLabel: string | null;
  bestBedtime: string | null;        // beobachtete Bettzeit der besten Nächte
  hasEnoughData: boolean;
}

function fmtHM(totalMinutesFromMidnight: number): string {
  let m = Math.round(totalMinutesFromMidnight) % 1440;
  if (m < 0) m += 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function parseHM(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Garmin schreibt "lokale" Zeitstempel als UTC-interpretierte ms (siehe garmin-sync.py
 *  ms_to_iso) — daher hier bewusst mit UTC-Gettern auslesen, nicht new Date().getHours(). */
export function formatLocalIsoTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** Minuten seit Mitternacht aus einem lokalen ISO-Zeitstempel (UTC-Getter, s.o.). */
function isoToMinuteOfDay(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
  if (isNaN(d.getTime())) return null;
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/**
 * Zusammengeführte Schlaf-Historie aus beiden Quellen: intervals.icu (Wellness,
 * meist vorhanden) als Basis, Garmin-Sync überschreibt mit Gerätewerten. Enthält
 * pro Nacht Dauer, Score und — falls Garmin da ist — Einschlaf-/Aufwachzeit.
 */
interface SleepRecord {
  date: string;
  hours: number;
  score: number | null;
  startMin: number | null;
  endMin: number | null;
  outcome: number | null; // Lern-Outcome = HRV des Folgemorgens (physiologisch, NICHT aus Schlafdauer abgeleitet)
}

function buildSleepHistory(
  garminDays: GarminDay[],
  wellnessDays: WellnessDay[]
): SleepRecord[] {
  const wSorted = [...wellnessDays].sort((a, b) => a.id.localeCompare(b.id));
  const gByDate = new Map(garminDays.map((d) => [d.date, d]));
  const wByDate = new Map(wSorted.map((d) => [d.id, d]));
  const dates = new Set<string>([...gByDate.keys(), ...wByDate.keys()]);

  const records: SleepRecord[] = [];
  for (const date of Array.from(dates).sort()) {
    const g = gByDate.get(date);
    const w = wByDate.get(date);
    const secs = g?.sleepSecs ?? w?.sleepSecs ?? null;
    if (secs == null) continue;
    const score = g?.sleepScore ?? w?.sleepScore ?? null;

    // Outcome fürs Lernen: HRV des Folgemorgens (misst dieselbe Nacht). BEWUSST nicht
    // der Erholungs-/Schlaf-Score, denn diese enthalten die Schlafdauer selbst → das
    // würde "mehr Schlaf = besser" mechanisch erzwingen (Zirkelschluss). HRV ist ein
    // unabhängiges physiologisches Signal der nächtlichen Erholung.
    const outcome: number | null = w ? getHRV(w) : null;

    records.push({
      date,
      hours: secs / 3600,
      score,
      startMin: isoToMinuteOfDay(g?.sleepStartLocal ?? null),
      endMin: isoToMinuteOfDay(g?.sleepEndLocal ?? null),
      outcome,
    });
  }
  return records;
}

/** Median (robuster als Mittel gegen Ausreißer-Nächte). */
function median(a: number[]): number {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Lernt den individuellen Optimal-Schlafbedarf: bucketiert die Nächte nach Dauer
 * (0,5-h-Schritte) und wählt den Bucket mit dem besten MEDIAN-Outcome (HRV).
 *
 * Robustheit gegen den Tail-Bias (wenige Extremnächte mit zufällig hoher HRV):
 *  - Kandidaten nur im plausiblen Band 6,0–9,0 h (darüber ist "Bedarf" fast immer
 *    Rauschen/Ausschlafen, kein echter Bedarf),
 *  - mind. 4 Nächte pro Bucket,
 *  - Ergebnis auf 6,5–9,0 h geklemmt.
 * Zu wenig Historie/Streuung → null (Basiswert aus Einstellungen greift).
 */
function learnOptimalDuration(records: SleepRecord[]): number | null {
  const usable = records.filter((r) => r.outcome != null && r.hours >= 4 && r.hours <= 11);
  if (usable.length < 14) return null;

  const buckets = new Map<number, number[]>();
  for (const r of usable) {
    const b = Math.round(r.hours * 2) / 2; // 0,5-h-Raster
    const arr = buckets.get(b) ?? [];
    arr.push(r.outcome as number);
    buckets.set(b, arr);
  }
  const scored = Array.from(buckets.entries())
    .filter(([bucket, vals]) => vals.length >= 4 && bucket >= 6.0 && bucket <= 9.0)
    .map(([bucket, vals]) => ({ bucket, med: median(vals), n: vals.length }));
  if (scored.length < 3) return null;

  scored.sort((a, b) => b.med - a.med);
  return clamp(scored[0].bucket, 6.5, 9.0);
}

/** Zirkuläre Standardabweichung von Uhrzeiten (Minuten-of-Day) über 24 h. */
function circularStdMinutes(minutes: number[]): number | null {
  if (minutes.length < 3) return null;
  const toRad = (m: number) => (m / 1440) * 2 * Math.PI;
  const sin = mean(minutes.map((m) => Math.sin(toRad(m))));
  const cos = mean(minutes.map((m) => Math.cos(toRad(m))));
  const R = Math.sqrt(sin * sin + cos * cos);
  if (R <= 0) return 720;
  const stdRad = Math.sqrt(-2 * Math.log(R));
  return (stdRad / (2 * Math.PI)) * 1440; // zurück in Minuten
}

/** Schlafregelmäßigkeit 0–100 aus der Streuung von Einschlaf- und Aufwachzeit. */
function calcConsistency(records: SleepRecord[]): { score: number | null; label: string | null } {
  const last = records.slice(-14);
  const starts = last.map((r) => r.startMin).filter((v): v is number => v != null);
  const ends = last.map((r) => r.endMin).filter((v): v is number => v != null);
  if (starts.length < 3 || ends.length < 3) return { score: null, label: null };
  const stdStart = circularStdMinutes(starts) ?? 0;
  const stdEnd = circularStdMinutes(ends) ?? 0;
  const avgStd = (stdStart + stdEnd) / 2;
  // 0 min Streuung → 100, ~120 min Streuung → 0
  const score = Math.round(clamp(100 - (avgStd / 120) * 100, 0, 100));
  const label = score >= 80 ? "Sehr regelmäßig" : score >= 60 ? "Regelmäßig" : score >= 40 ? "Unregelmäßig" : "Sehr unregelmäßig";
  return { score, label };
}

/** Beobachtete durchschnittliche Bettzeit der besten Nächte (oberstes Outcome-Drittel). */
function learnBestBedtime(records: SleepRecord[]): string | null {
  const withTimes = records.filter((r) => r.startMin != null && r.outcome != null);
  if (withTimes.length < 8) return null;
  const sorted = [...withTimes].sort((a, b) => (b.outcome as number) - (a.outcome as number));
  const topThird = sorted.slice(0, Math.max(3, Math.floor(sorted.length / 3)));
  // Einschlafzeiten liegen abends/nachts — auf "Minuten vor Mitternacht" normalisieren
  const norm = topThird.map((r) => {
    const m = r.startMin as number;
    return m > 720 ? m - 1440 : m; // 23:00 → -60, 00:30 → 30
  });
  const bedMin = mean(norm);
  // Einschlaf- → Bettzeit ist eine Näherung; hier geben wir den Einschlafzeitpunkt zurück
  return fmtHM(bedMin);
}

function pickWakeTime(settings: SleepCoachSettings): { time: string; isWeekday: boolean } {
  // Der heutige Abend führt zur morgigen Aufstehzeit.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dow = tomorrow.getDay(); // 0=So, 6=Sa
  const isWeekday = dow >= 1 && dow <= 5;
  return { time: isWeekday ? settings.targetWakeTimeWeekday : settings.targetWakeTimeWeekend, isWeekday };
}

export function calcSleepCoachPlan(
  garminDays: GarminDay[],
  wellnessDays: WellnessDay[],
  settings: SleepCoachSettings
): SleepCoachPlan {
  const reasoning: string[] = [];
  const sortedGarmin = [...garminDays].sort((a, b) => a.date.localeCompare(b.date));
  const today = sortedGarmin[sortedGarmin.length - 1];
  const history = buildSleepHistory(garminDays, wellnessDays);

  // ── Basisbedarf: personalisierter Ausgangswert (wie Garmin/Whoop/Bevel) ──
  // Ausgangspunkt ist der Nutzer-Basiswert (Einstellungen, Default 8 h — Erwachsene
  // 7–9 h, Hirshkowitz et al. 2015). Der aus HRV gelernte Optimalwert justiert die
  // Basis nur SANFT (40 % Gewicht, max. ±0,5 h), damit die Empfehlung nicht an
  // Ausschlaf-Nächten hochgezogen wird — genau das war der Fehler (9,5 h → 9:37).
  const setBase = settings.baseSleepNeedH;
  const learned = learnOptimalDuration(history);
  const isLearned = learned != null;
  const baseNeedH = isLearned
    ? clamp(setBase + ((learned as number) - setBase) * 0.4, setBase - 0.5, setBase + 0.5)
    : setBase;
  if (isLearned) {
    reasoning.push(`Basis ${setBase.toFixed(1)} h, per HRV-Daten justiert auf ~${baseNeedH.toFixed(1)} h.`);
  }

  // ── Schlafschuld: letzte 3 Nächte ggü. Basisbedarf, neuere Nacht wiegt stärker ──
  // Bewusst moderat (Cap +40 Min): eine Nacht kann Schlafdefizit nur teilweise
  // zurückzahlen, nicht komplett (Schlafwissenschaft).
  const last3 = history.slice(-3);
  const weights = [0.25, 0.5, 1.0];
  let debtH = 0;
  last3.forEach((r, i) => {
    const deficit = Math.max(0, baseNeedH - r.hours);
    const w = weights[weights.length - last3.length + i] ?? 1;
    debtH += deficit * w;
  });
  debtH = clamp(debtH, 0, 3);
  const debtAdjustMin = clamp(debtH * 12, 0, 40);
  if (debtAdjustMin > 8) {
    reasoning.push(`Schlafschuld der letzten Nächte (≈${debtH.toFixed(1)} h) → +${Math.round(debtAdjustMin)} Min.`);
  }

  // ── Trainingsbelastung: gestrige Tageslast vs. CTL (typische Tageslast). Cap +30. ──
  // CTL ist die richtige Bezugsgröße (dein „normales" Tagesniveau), nicht der Ø der
  // aktiven Tage — sonst lassen niedrige Pendel-Tage jede echte Einheit „hoch" wirken.
  const latestCtl = [...wellnessDays].reverse().find((d) => d.ctl != null)?.ctl ?? null;
  const withLoad = wellnessDays
    .map((d) => ({ date: d.id, load: d.atlLoad ?? d.strain ?? null }))
    .filter((d): d is { date: string; load: number } => d.load != null);
  const yesterdayLoad = withLoad.length ? withLoad[withLoad.length - 1].load : null;
  const strainRef = latestCtl && latestCtl > 0 ? latestCtl : null;

  let strainAdjustMin = 0;
  if (strainRef != null && yesterdayLoad != null) {
    const ratio = yesterdayLoad / strainRef;
    if (ratio > 1.8) strainAdjustMin = 30;
    else if (ratio > 1.3) strainAdjustMin = 15;
    if (strainAdjustMin > 0) {
      reasoning.push(`Gestern deutlich höhere Last als üblich (${Math.round(yesterdayLoad)} vs. CTL ${Math.round(strainRef)}) → +${strainAdjustMin} Min.`);
    }
  }

  // ── Stress: heutiger Ø-Stress vs. 28-Tage-Baseline. Cap +20. ──
  const stressVals = sortedGarmin.map((d) => d.stressAvg).filter((v): v is number => v != null);
  const stressBaseline = stressVals.length >= 5 ? mean(stressVals.slice(-28)) : null;
  const todayStress = today?.stressAvg ?? null;
  let stressAdjustMin = 0;
  if (stressBaseline != null && stressBaseline > 0 && todayStress != null) {
    const ratio = todayStress / stressBaseline;
    if (ratio > 1.4) stressAdjustMin = 20;
    else if (ratio > 1.15) stressAdjustMin = 10;
    if (stressAdjustMin > 0) {
      reasoning.push(`Erhöhter Stress heute (Ø ${todayStress} vs. Ø28 ${stressBaseline.toFixed(0)}) → +${stressAdjustMin} Min.`);
    }
  }

  // Gesamt-Bedarf: Basis + Zu-/Abschläge. Relativ max. +60 / −30 Min gegenüber der
  // Basis, absolut auf 6,5–9,25 h begrenzt — so bleibt ein normaler Tag nahe der
  // Basis (~8 h) und nur echte Schuld/Last hebt ihn spürbar an.
  const adjustments = debtAdjustMin + strainAdjustMin + stressAdjustMin;
  const totalNeedMin = clamp(
    baseNeedH * 60 + adjustments,
    Math.max(baseNeedH * 60 - 30, 390),
    Math.min(baseNeedH * 60 + 60, 555)
  );
  const totalNeedH = totalNeedMin / 60;

  if (reasoning.length === 0 || (reasoning.length === 1 && isLearned)) {
    reasoning.push("Keine besonderen Ausschläge — Optimalbedarf gilt weitgehend unverändert.");
  }

  const { time: wakeTime, isWeekday: wakeIsWeekday } = pickWakeTime(settings);
  const wakeMin = parseHM(wakeTime);
  const sleepByMin = wakeMin - totalNeedMin;
  const lightsOutMin = sleepByMin - settings.onsetLatencyMin;

  const latestNight = history[history.length - 1];
  const lastNight = latestNight
    ? {
        sleepStart: today?.date === latestNight.date ? today.sleepStartLocal : null,
        sleepEnd: today?.date === latestNight.date ? today.sleepEndLocal : null,
        durationH: latestNight.hours,
      }
    : null;

  const { score: consistencyScore, label: consistencyLabel } = calcConsistency(history);
  const bestBedtime = learnBestBedtime(history);
  if (bestBedtime && isLearned) {
    reasoning.push(`Deine erholsamsten Nächte begannen im Schnitt gegen ${bestBedtime} Uhr.`);
  }

  return {
    totalNeedH,
    baseNeedH,
    isLearned,
    strainAdjustMin,
    stressAdjustMin,
    debtAdjustMin,
    sleepDebtH: debtH,
    wakeTime,
    wakeIsWeekday,
    sleepByTime: fmtHM(sleepByMin),
    lightsOutTime: fmtHM(lightsOutMin),
    reasoning,
    lastNight,
    consistencyScore,
    consistencyLabel,
    bestBedtime,
    hasEnoughData: history.length >= 3,
  };
}
