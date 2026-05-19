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

/**
 * HRV-Trend → Score 0–100
 * Normaler Schwankungsbereich 85–115 % des 7-Tage-Ø gilt als gut (Score 50–100).
 * Exakt am Ø (100 %) → ~75 Punkte; unter 85 % → 0–50 (linear); über 115 % → 100 (Bonus, gedeckelt).
 * Damit ist der theoretische Maximalwert bei durchschnittlicher HRV ~75 statt ~50.
 */
function hrvTrendScore(trend: number): number {
  if (trend > 115) return 100;
  if (trend >= 85) return 50 + ((trend - 85) / 30) * 50;
  return (trend / 85) * 50;
}

/**
 * Schlafdauer in Stunden → Score 0–100
 * Piecewise-Formel nach NSF-Empfehlungen (Hirshkowitz et al. 2015):
 *   ≤ 4h → 0        (extremer Schlafmangel)
 *   4–6h → 0–30     (starker Schlafmangel)
 *   6–7h → 30–70    (unter Empfehlung)
 *   7–9h → 70–100   (empfohlener Bereich, Optimum bei 9h)
 *   > 9h → 80–100   (leichter Abfall)
 * Quelle: Notion – Berechnungsformeln (Einzige Quelle der Wahrheit)
 */
function sleepHoursToScore(hours: number): number {
  if (hours <= 4) return 0;
  if (hours <= 6) return clamp(((hours - 4) / 2) * 30, 0, 30);
  if (hours <= 7) return clamp(30 + (hours - 6) * 40, 30, 70);
  if (hours <= 9) return clamp(70 + ((hours - 7) / 2) * 30, 70, 100);
  return clamp(100 - (hours - 9) * 10, 80, 100);
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

/**
 * Trainingsbelastungs-Score aus TSB (Training Stress Balance = CTL − ATL).
 * TSB negativ = Erschöpfung überwiegt → Score sinkt.
 * TSB = 0   → Score 50 (neutral)
 * TSB = −30 → Score ≈ 5  (stark erschöpft, z.B. nach 5h-Ride)
 * TSB = +10 → Score 65   (frisch, Tapering)
 * Skalierungsfaktor 1.5 kalibriert für Ausdauersportler mit normalem TSB-Bereich −40…+20.
 */
function calcLoadScore(today: WellnessDay): number {
  if (today.ctl == null || today.atl == null) return 50;
  const tsb = today.ctl - today.atl;
  return clamp(50 + tsb * 1.5, 0, 100);
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
 * Gewichtung (Notion – Einzige Quelle der Wahrheit):
 *   Load/TSB 25 % · HRV-Trend 25 % · Subjektiv 15 % · Schlaf 15 % · RHR 10 % · CV-Stabilität 10 %
 * Load/TSB: dominanter Faktor, da er direkte Erschöpfung durch Workouts abbildet.
 * Subjektiv: Erschöpfung / Kater / Stimmung / Motivation gleichgewichtet (je 25 %)
 * Fallback bei fehlendem CTL/ATL: Load-Score = 50 (neutral)
 */
export function calcTrainingReadiness(
  today: WellnessDay,
  allDays: WellnessDay[]
): number {
  const hrv = getHRV(today);
  const hrv7 = calcHRV7(allDays);
  const cv = calcCV(allDays);
  const trend = hrv !== null && hrv7 !== null ? (hrv / hrv7) * 100 : 100;

  const hrvScore = hrvTrendScore(trend);

  // Schlaf
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

  // Subjektiv: alle vier Faktoren gleichgewichtet (je 25 %)
  const fatigue = today.fatigue != null ? (5 - today.fatigue) / 4 : 0.5;
  const soreness = today.soreness != null ? (5 - today.soreness) / 4 : 0.5;
  const mood = today.mood != null ? (today.mood - 1) / 4 : 0.5;
  const motivation = today.motivation != null ? (today.motivation - 1) / 4 : 0.5;
  const subjectiveScore = ((fatigue + soreness + mood + motivation) / 4) * 100;

  // CV-Stabilität
  const cvScore = cv != null ? clamp(((10 - cv) / 10) * 100, 0, 100) : 50;

  // Trainingsbelastung via TSB (CTL − ATL)
  const loadScore = calcLoadScore(today);

  const readiness = Math.round(
    loadScore   * 0.25 +
    hrvScore    * 0.25 +
    subjectiveScore * 0.15 +
    sleepScore  * 0.15 +
    rhrScore    * 0.10 +
    cvScore     * 0.10
  );
  return clamp(readiness, 0, 100);
}

/**
 * Erholungswert 0–100 %
 * Gewichtung (Notion – Einzige Quelle der Wahrheit):
 *   Schlaf 25 % · HRV-Ratio 30 % · Load/TSB 20 % · RHR 15 % · Muskelkater 10 %
 * Load/TSB: erfasst metabolische/muskuläre Erschöpfung durch vorangegangene Workouts,
 *   die HRV und RHR oft erst verzögert abbilden.
 * Fallback bei fehlendem CTL/ATL: Load-Score = 50 (neutral)
 */
export function calcRecoveryScore(
  today: WellnessDay,
  allDays: WellnessDay[]
): number {
  const hrv = getHRV(today);
  const hrv7 = calcHRV7(allDays);
  const trend = hrv !== null && hrv7 !== null ? (hrv / hrv7) * 100 : 100;
  const hrvRecovery = hrvTrendScore(trend);

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

  // Nur Muskelkater (kein Fatigue) – laut Notion
  const sorenessScore = today.soreness != null ? ((5 - today.soreness) / 4) * 100 : 50;

  // Trainingsbelastung via TSB (CTL − ATL)
  const loadScore = calcLoadScore(today);

  const recovery = Math.round(
    hrvRecovery  * 0.30 +
    sleepRecovery * 0.25 +
    loadScore    * 0.20 +
    rhrRecovery  * 0.15 +
    sorenessScore * 0.10
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
      tsb: null,
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
  const tsb = (today.ctl != null && today.atl != null) ? today.ctl - today.atl : null;
  const trainingReadiness = calcTrainingReadiness(today, days);
  const recoveryScore = calcRecoveryScore(today, days);
  const { zone, label, advice } = calcCVZone(trendRatio, cv);

  return {
    hrv7,
    cv,
    trendRatio,
    tsb,
    trainingReadiness,
    recoveryScore,
    cvZone: zone,
    cvZoneLabel: label,
    cvZoneAdvice: advice,
  };
}
