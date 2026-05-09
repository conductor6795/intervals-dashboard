import { WellnessDay, CalculatedMetrics, CVZone, DayMetrics } from "./types";

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  const m = mean(arr);
  const variance = arr.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

/** Effektiver HRV-Wert eines Tages (hrv bevorzugt, Fallback hrv4t) */
export function getHRV(day: WellnessDay): number | null {
  if (day.hrv != null && day.hrv > 0) return day.hrv;
  if (day.hrv4t != null && day.hrv4t > 0) return day.hrv4t;
  return null;
}

/** 7-Tage rollierender HRV-Durchschnitt (nur Tage mit HRV-Wert) */
export function calcHRV7(days: WellnessDay[]): number | null {
  const values = days
    .slice(-7)
    .map(getHRV)
    .filter((v): v is number => v !== null);
  if (values.length < 3) return null;
  return parseFloat(mean(values).toFixed(1));
}

/** CV (Variationskoeffizient) der letzten 7 HRV-Werte in %
 *  Schwellenwert 6,5 % nach Plews et al. 2012 – trainierte Athleten können
 *  niedrigere individuelle Werte aufweisen. */
export function calcCV(days: WellnessDay[]): number | null {
  const values = days
    .slice(-7)
    .map(getHRV)
    .filter((v): v is number => v !== null);
  if (values.length < 3) return null;
  const m = mean(values);
  if (m === 0) return null;
  return parseFloat(((stdDev(values) / m) * 100).toFixed(2));
}

/** Trend-Verhältnis: aktueller HRV / HRV7 * 100 */
export function calcTrendRatio(todayHRV: number | null, hrv7: number | null): number | null {
  if (todayHRV === null || hrv7 === null || hrv7 === 0) return null;
  return parseFloat(((todayHRV / hrv7) * 100).toFixed(1));
}

/** Schlafdauer in Stunden → Score 0-100 (Bell-Curve, Optimum 7,5–8,5 h)
 *  Basis: Hirshkowitz et al. 2015 (NSF-Empfehlungen), Walker 2017 */
function sleepHoursToScore(hours: number): number {
  if (hours < 4) return clamp(hours * 7.5, 0, 30);
  if (hours < 7) return clamp(30 + (hours - 4) * 20, 30, 90);
  if (hours <= 9) return clamp(90 + (hours - 7) * 5, 90, 100);
  // Übersclafen: leichte Abwertung ab 9h (Walker 2017)
  return clamp(100 - (hours - 9) * 12, 60, 100);
}

/**
 * CV-Ampel nach dem 4-Felder-Modell (Plews et al. 2013):
 *  - Grün:   HRV über Durchschnitt (Trend ≥ 100) + CV niedrig (< 6,5 %)
 *  - Gelb:   HRV über Durchschnitt + CV hoch (≥ 6,5 %)
 *  - Orange: HRV unter Durchschnitt + CV niedrig
 *  - Rot:    HRV unter Durchschnitt + CV hoch
 */
export function calcCVZone(
  trendRatio: number | null,
  cv: number | null
): { zone: CVZone; label: string; advice: string } {
  const CV_THRESHOLD = 6.5;
  const aboveAvg = trendRatio !== null ? trendRatio >= 100 : true;
  const lowCV = cv !== null ? cv < CV_THRESHOLD : true;

  if (aboveAvg && lowCV) {
    return {
      zone: "green",
      label: "Optimal – Hart trainieren",
      advice: "HRV über Durchschnitt, stabile Variabilität. Intensives Training möglich.",
    };
  }
  if (aboveAvg && !lowCV) {
    return {
      zone: "yellow",
      label: "Variabel – Moderat trainieren",
      advice: "HRV über Durchschnitt, aber hohe Variabilität. Signal unsicher – moderate Intensität empfohlen.",
    };
  }
  if (!aboveAvg && lowCV) {
    return {
      zone: "orange",
      label: "Erholt/Müde – Leicht trainieren",
      advice: "HRV unter Durchschnitt, stabile Variabilität. Regenerationseinheit oder lockeres Training.",
    };
  }
  return {
    zone: "red",
    label: "Überlastet – Ruhetag",
    advice: "HRV unter Durchschnitt und hohe Variabilität. Ruhe oder aktive Erholung empfohlen.",
  };
}

/** 28-Tage Baseline für Ruhepuls */
function rhrBaseline(days: WellnessDay[]): number {
  const values = days
    .slice(-28)
    .map((d) => d.restingHR)
    .filter((v): v is number => v != null && v > 0);
  return values.length > 0 ? mean(values) : 55;
}

/**
 * Trainingsbereitschaft 0–100
 * Gewichtung (2026, basierend auf Buchheit 2014, Plews et al. 2013):
 *   HRV-Trend 40 % · Schlaf 25 % · RHR 15 % · Subjektiv 15 % · CV-Stabilität 5 %
 * Subjektiv: Erschöpfung 35 % · Muskelkater 30 % · Stimmung 20 % · Motivation 15 %
 */
export function calcTrainingReadiness(
  today: WellnessDay,
  allDays: WellnessDay[]
): number {
  const hrv = getHRV(today);
  const hrv7 = calcHRV7(allDays);
  const cv = calcCV(allDays);
  const trend = hrv !== null && hrv7 !== null ? (hrv / hrv7) * 100 : 100;

  // HRV-Trend: 70–130 % → 0–100
  const hrvScore = clamp(((trend - 70) / 60) * 100, 0, 100);

  // Schlaf (Bell-Curve basiertes Scoring)
  let sleepScore = 50;
  if (today.sleepScore != null) {
    sleepScore = clamp(today.sleepScore, 0, 100);
  } else if (today.sleepSecs != null) {
    sleepScore = sleepHoursToScore(today.sleepSecs / 3600);
  }

  // RHR: Abweichung von 28-Tage-Baseline (+10 bpm = 0, -10 bpm = 100)
  const baseline = rhrBaseline(allDays);
  const rhrScore =
    today.restingHR != null
      ? clamp(50 + (baseline - today.restingHR) * 5, 0, 100)
      : 50;

  // Subjektive Metriken – Erschöpfung/Kater stärker gewichtet (direkte Performance-Prädiktoren)
  const fatigue = today.fatigue != null ? (5 - today.fatigue) / 4 : 0.5;
  const soreness = today.soreness != null ? (5 - today.soreness) / 4 : 0.5;
  const mood = today.mood != null ? (today.mood - 1) / 4 : 0.5;
  const motivation = today.motivation != null ? (today.motivation - 1) / 4 : 0.5;
  const subjectiveScore = (fatigue * 0.35 + soreness * 0.30 + mood * 0.20 + motivation * 0.15) * 100;

  // CV-Stabilität (sekundär)
  const cvScore = cv != null ? clamp(((10 - cv) / 10) * 100, 0, 100) : 50;

  const readiness = Math.round(
    hrvScore * 0.40 +
    sleepScore * 0.25 +
    rhrScore * 0.15 +
    subjectiveScore * 0.15 +
    cvScore * 0.05
  );
  return clamp(readiness, 0, 100);
}

/**
 * Erholungswert 0–100 %
 * Gewichtung: HRV-Ratio 40 % · Schlaf 30 % · RHR 15 % · Ermüdung+Kater 15 %
 */
export function calcRecoveryScore(
  today: WellnessDay,
  allDays: WellnessDay[]
): number {
  const hrv = getHRV(today);
  const hrv7 = calcHRV7(allDays);
  const trend = hrv !== null && hrv7 !== null ? (hrv / hrv7) * 100 : 100;
  const hrvRecovery = clamp(((trend - 70) / 60) * 100, 0, 100);

  let sleepRecovery = 50;
  if (today.sleepScore != null) {
    sleepRecovery = clamp(today.sleepScore, 0, 100);
  } else if (today.sleepSecs != null) {
    sleepRecovery = sleepHoursToScore(today.sleepSecs / 3600);
  }

  const baseline = rhrBaseline(allDays);
  const rhrRecovery =
    today.restingHR != null
      ? clamp(50 + (baseline - today.restingHR) * 5, 0, 100)
      : 50;

  const sorenessScore = today.soreness != null ? ((5 - today.soreness) / 4) * 100 : 50;
  const fatigueScore = today.fatigue != null ? ((5 - today.fatigue) / 4) * 100 : 50;
  const physicalScore = (sorenessScore + fatigueScore) / 2;

  const recovery = Math.round(
    hrvRecovery * 0.40 +
    sleepRecovery * 0.30 +
    rhrRecovery * 0.15 +
    physicalScore * 0.15
  );
  return clamp(recovery, 0, 100);
}

/** Berechnet für jeden Tag im Array die rollierenden Metriken */
export function buildDailyMetrics(days: WellnessDay[]): DayMetrics[] {
  return days.map((_, idx) => {
    const slice = days.slice(0, idx + 1);
    const hrv7 = calcHRV7(slice);
    const cv = calcCV(slice);
    const todayHRV = getHRV(days[idx]);
    const trendRatio = calcTrendRatio(todayHRV, hrv7);
    return { date: days[idx].id, hrv7, cv, trendRatio };
  });
}

/**
 * Trend-Richtung für einen Messwert (Vergleich heute mit Ø der letzten N Tage).
 * positiveIsGood: true = Anstieg = gut (grün), false = Anstieg = schlecht (z.B. RHR)
 */
export function calcValueTrend(
  values: (number | null)[],
  lookback = 5,
  threshold = 0.03
): "up" | "neutral" | "down" {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length < 2) return "neutral";
  const latest = valid[valid.length - 1];
  const prevSlice = valid.slice(-lookback - 1, -1);
  if (prevSlice.length === 0) return "neutral";
  const prevAvg = mean(prevSlice);
  if (prevAvg === 0) return "neutral";
  const change = (latest - prevAvg) / Math.abs(prevAvg);
  if (change > threshold) return "up";
  if (change < -threshold) return "down";
  return "neutral";
}

/** Alle Kennzahlen für den letzten verfügbaren Tag */
export function calcAllMetrics(days: WellnessDay[]): CalculatedMetrics {
  if (days.length === 0) {
    return {
      hrv7: null,
      cv: null,
      trendRatio: null,
      trainingReadiness: 50,
      recoveryScore: 50,
      cvZone: "green",
      cvZoneLabel: "Keine Daten",
      cvZoneAdvice: "Bitte Wellness-Daten importieren.",
    };
  }
  const today = days[days.length - 1];
  const hrv7 = calcHRV7(days);
  const cv = calcCV(days);
  const trendRatio = calcTrendRatio(getHRV(today), hrv7);
  const trainingReadiness = calcTrainingReadiness(today, days);
  const recoveryScore = calcRecoveryScore(today, days);
  const { zone, label, advice } = calcCVZone(trendRatio, cv);

  return {
    hrv7,
    cv,
    trendRatio,
    trainingReadiness,
    recoveryScore,
    cvZone: zone,
    cvZoneLabel: label,
    cvZoneAdvice: advice,
  };
}
