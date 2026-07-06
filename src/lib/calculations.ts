import { WellnessDay, CalculatedMetrics, CVZone, DayMetrics } from "./types";
import { HRV_PCT, HRV_CV, DAY_SIGNAL, TSB, HARD } from "./athlete";

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** Stichproben-Standardabweichung (n−1), analog Python statistics.stdev.
 *  athleten-konstanten.md / Spec §2 rechnet hrv_cv mit statistics.stdev, nicht
 *  mit der Populations-Variante (÷n) — Letztere macht CV systematisch zu niedrig. */
function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

/** Effektiver HRV-Wert eines Tages (hrv bevorzugt, Fallback hrv4t) */
export function getHRV(day: WellnessDay): number | null {
  if (day.hrv != null && day.hrv > 0) return day.hrv;
  if (day.hrv4t != null && day.hrv4t > 0) return day.hrv4t;
  return null;
}

/** hrv7 — Ø der letzten 7 HRV-MESSTAGE (nicht Kalendertage; Lücken durch fehlende
 *  Messungen verschieben das Fenster sonst). Nenner für hrv_cv und Basis fürs Tagessignal. */
export function calcHRV7(days: WellnessDay[]): number | null {
  const values = days
    .map(getHRV)
    .filter((v): v is number => v !== null)
    .slice(-7);
  if (values.length < 3) return null;
  return parseFloat(mean(values).toFixed(1));
}

/** hrv_cv — SEKUNDÄRSIGNAL (athleten-konstanten.md / Spec §2):
 *  Variationskoeffizient der letzten 7 HRV-Messtage in %, Nenner = hrv7 (Ø der 7),
 *  Stichproben-Stdev (n−1). Bänder: <12 % grün · 12–15 % gelb · >15 % ANS-instabil.
 *  Fenster in HRV-Messtagen (nur Tage mit Wert), nicht Kalendertagen. */
export function calcCV(days: WellnessDay[]): number | null {
  const values = days
    .map(getHRV)
    .filter((v): v is number => v !== null)
    .slice(-7);
  if (values.length < 3) return null;
  const m = mean(values);
  if (m === 0) return null;
  return parseFloat(((stdDev(values) / m) * 100).toFixed(1));
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
 * Rollender 28-Tage-Perzentil von hrv7 (athleten-konstanten.md).
 * Höher = besser erholt. Hauptsignal für den Langzeittrend.
 */
export function calcHrvPct(days: WellnessDay[]): number | null {
  const vals = days.map(getHRV).filter((v): v is number => v !== null);
  if (vals.length < 7) return null;
  const last28 = vals.slice(-28);
  const last7 = vals.slice(-7);
  const hrv7 = last7.reduce((a, b) => a + b, 0) / last7.length;
  let below = 0;
  let equal = 0;
  for (const v of last28) {
    if (v < hrv7) below++;
    else if (v === hrv7) equal++;
  }
  return Math.round(((below + 0.5 * equal) / last28.length) * 1000) / 10;
}

/**
 * Absolut-Trend-Floor (Spec §6): fängt langsame absolute HRV-Drift, die das
 * rollende 28-Tage-Perzentil wegnormalisiert. hrv7 > 12 % unter dem 60-Tage-Mittel
 * → hrv_floor_flag. Kein Sofort-ERSETZEN, sondern Drift-Banner; 2 Wochenchecks in
 * Folge mit Flag → Deload-Prüfung.
 */
export function calcHrvFloorFlag(days: WellnessDay[]): boolean {
  const vals = days.map(getHRV).filter((v): v is number => v !== null);
  if (vals.length < 7) return false;
  const hrv7 = mean(vals.slice(-7));
  const last60 = vals.slice(-60);
  const hrv60 = mean(last60);
  return hrv7 > 0 && hrv60 > 0 && hrv7 < hrv60 * HARD.FLOOR_RATIO;
}

/** Tagessignal: heutige HRV relativ zum 7-Tage-Schnitt (athleten-konstanten.md). */
function hrvDaySignal(
  hrvToday: number | null,
  hrv7: number | null
): "erholt" | "ausbalanciert" | "unausgewogen" | "niedrig" | null {
  if (hrvToday == null || hrv7 == null || hrv7 === 0) return null;
  const r = hrvToday / hrv7;
  if (r < DAY_SIGNAL.low) return "niedrig";
  if (r < DAY_SIGNAL.imbalanced) return "unausgewogen";
  if (r > DAY_SIGNAL.recovered) return "erholt";
  return "ausbalanciert";
}

/** Hard-Trigger: 3+ Tage in Folge hrv_today < hrv7 × 0.90. */
function threeDaysHrvDown(days: WellnessDay[]): boolean {
  const vals = days.map(getHRV).filter((v): v is number => v !== null);
  if (vals.length < 10) return false;
  const hrv7 = vals.slice(-7).reduce((a, b) => a + b, 0) / 7;
  const last3 = vals.slice(-3);
  return last3.length === 3 && last3.every((v) => v < hrv7 * DAY_SIGNAL.downTrend);
}

/**
 * Hard-Trigger / Sofort-Deload (Spec §4) — mechanisch, kein Reasoning.
 * Einer reicht → Verdikt-Ceiling ERSETZEN. Gibt die Liste der aktiven Trigger für
 * die Anzeige zurück. Kern des Alt-Bugs: CV > 15 % ist KEIN eigenständiger
 * Hard-Trigger mehr, sondern nur kombiniert mit hrv_pct < 20 %.
 */
export function evaluateHardTriggers(args: {
  hrvPct: number | null;
  cv: number | null;
  tsb: number | null;
  threeDaysDown: boolean;
}): { ceiling: "ERSETZEN" | null; active: string[] } {
  const { hrvPct, cv, tsb, threeDaysDown } = args;
  const active: string[] = [];
  if (cv != null && cv > HARD.CV && hrvPct != null && hrvPct < HARD.CV_PCT) {
    active.push(`CV ${cv} % > ${HARD.CV} % UND hrv_pct ${hrvPct} % < ${HARD.CV_PCT} %`);
  }
  if (hrvPct != null && hrvPct < HARD.HRV_PCT) {
    active.push(`hrv_pct ${hrvPct} % < ${HARD.HRV_PCT} % (kritisch)`);
  }
  if (tsb != null && tsb < HARD.TSB) {
    active.push(`TSB ${Math.round(tsb)} < ${HARD.TSB} (überbelastet)`);
  }
  if (threeDaysDown) {
    active.push(`3+ Tage hrv_today < hrv7 × ${DAY_SIGNAL.downTrend}`);
  }
  return { ceiling: active.length > 0 ? "ERSETZEN" : null, active };
}

/**
 * Tagescheck-Verdikt als 4-Stufen-Ampel (ersetzt das alte Plews-Modell).
 * Quelle: athleten-konstanten.md + tagescheck-SKILL.md (Verdikt-Matrix).
 *  green  = Plan steht (BEHALTEN)
 *  yellow = kein HIT, Z2 bleibt (ANPASSEN mild)
 *  orange = Umfang reduzieren (ANPASSEN strukturell, hrv_pct 5–39)
 *  red    = Erholung / Ersetzen (Hard-Trigger / kritisch)
 * HRV ist hier Veto, nicht Treiber: sie kann nur nach unten korrigieren.
 */
export function calcAmpel(args: {
  hrvPct: number | null;
  hrvToday: number | null;
  hrv7: number | null;
  cv: number | null;
  tsb: number | null;
  threeDaysDown: boolean;
}): { zone: CVZone; label: string; advice: string } {
  const { hrvPct, hrvToday, hrv7, cv, tsb, threeDaysDown } = args;

  if (hrvPct == null) {
    return {
      zone: "green",
      label: "Daten unvollständig",
      advice: "Zu wenige HRV-Messtage für ein Verdikt — nach Plan, beobachten.",
    };
  }

  // ── Hard-Trigger → ROT ──
  const hardRed =
    hrvPct < HARD.HRV_PCT ||
    (cv != null && cv > HARD.CV && hrvPct < HARD.CV_PCT) ||
    (tsb != null && tsb < HARD.TSB) ||
    threeDaysDown;
  if (hardRed) {
    return {
      zone: "red",
      label: "Erholung – Ersetzen",
      advice: "Hard-Trigger aktiv (hrv_pct/CV/TSB). Z1 oder Ruhetag, nächste Qualitätseinheit schützen.",
    };
  }

  const day = hrvDaySignal(hrvToday, hrv7);
  const tsbHighLoad = tsb != null && tsb < TSB.productiveFloor; // < −20 (≥ −30, sonst Hard oben)

  // CV-Suspension: transienter Spike, HRV bereits erholt
  const cvSuspended =
    cv != null &&
    cv >= HRV_CV.warn &&
    cv <= HRV_CV.unstable &&
    hrvPct >= HRV_PCT.neutral &&
    hrvToday != null &&
    hrv7 != null &&
    hrvToday >= hrv7 * DAY_SIGNAL.suspension;

  // Schweregrad 0=green 1=yellow 2=orange 3=red, restriktivster Wert gewinnt
  let sev = 0;
  if (hrvPct < HRV_PCT.suppressed) {
    sev = Math.max(sev, 2); // 5–19 strukturell niedrig
  } else if (hrvPct < HRV_PCT.neutral) {
    sev = Math.max(sev, tsbHighLoad || day === "unausgewogen" ? 3 : 1); // 20–39
  } else {
    if (tsbHighLoad) sev = Math.max(sev, 1);
    if (day === "unausgewogen") sev = Math.max(sev, 1);
  }
  if (day === "niedrig") sev = 3;

  // CV-Overlay (athleten-konstanten.md)
  if (cv != null) {
    if (cv > HRV_CV.unstable) {
      sev = Math.max(sev, hrvPct < HRV_PCT.neutral ? 2 : 1);
    } else if (cv >= HRV_CV.warn && !cvSuspended) {
      sev = Math.max(sev, 1);
    }
  }

  const zone: CVZone = sev >= 3 ? "red" : sev === 2 ? "orange" : sev === 1 ? "yellow" : "green";

  const LABELS: Record<CVZone, string> = {
    green: "Plan steht",
    yellow: "Kein HIT – Z2 bleibt",
    orange: "Umfang reduzieren",
    red: "Erholung – Ersetzen",
  };
  const ADVICE: Record<CVZone, string> = {
    green: "hrv_pct & Tagessignal grün — geplante Einheit wie vorgesehen.",
    yellow: cvSuspended
      ? "CV-Spike transient (HRV erholt) — HIT bliebe frei; sonst Intensität raus, Z2 bleibt."
      : "Variabilität oder TSB erhöht — Intensität raus, Z2 bleibt.",
    orange: "Langzeit-HRV gedrückt — Umfang −20 %, höchstens 1 HIT.",
    red: "Kritischer Trend oder Überlastung — Z1 oder Ruhetag.",
  };

  return { zone, label: LABELS[zone], advice: ADVICE[zone] };
}

/**
 * Trainingsbereitschaft = Garmins nativer Readiness-Score, gedeckelt durch die
 * Hard-Trigger (HRV als Veto). Gibt null zurück wenn keine Garmin-Readiness da ist
 * (dann nutzt das Dashboard den hausgemachten Score als Fallback).
 */
export function calcVetoedReadiness(
  garminReadiness: number | null,
  days: WellnessDay[]
): { value: number; capped: boolean; reason: string | null } | null {
  if (garminReadiness == null) return null;
  if (days.length === 0) return { value: garminReadiness, capped: false, reason: null };

  const hrvPct = calcHrvPct(days);
  const cv = calcCV(days);
  const today = days[days.length - 1];
  const tsb = today.ctl != null && today.atl != null ? today.ctl - today.atl : null;
  const threeDaysDown = threeDaysHrvDown(days);

  const hardRed =
    (hrvPct != null && hrvPct < HARD.HRV_PCT) ||
    (cv != null && cv > HARD.CV && hrvPct != null && hrvPct < HARD.CV_PCT) ||
    (tsb != null && tsb < HARD.TSB) ||
    threeDaysDown;
  if (hardRed) {
    return { value: Math.min(garminReadiness, 24), capped: true, reason: "Hard-Trigger — Veto auf Ruhetag." };
  }

  const caution = (hrvPct != null && hrvPct < HRV_PCT.suppressed) || (cv != null && cv > HARD.CV);
  if (caution) {
    return {
      value: Math.min(garminReadiness, 49),
      capped: garminReadiness > 49,
      reason: "HRV/CV gedrückt — Veto auf max. Moderat.",
    };
  }

  return { value: garminReadiness, capped: false, reason: null };
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
      hrvPct: null,
      cv: null,
      trendRatio: null,
      tsb: null,
      trainingReadiness: 50,
      recoveryScore: 50,
      cvZone: "green",
      cvZoneLabel: "Keine Daten",
      cvZoneAdvice: "Bitte Wellness-Daten importieren.",
      hrvFloorFlag: false,
      hardTriggers: [],
    };
  }
  const today = days[days.length - 1];
  const hrv7 = calcHRV7(days);
  const hrvPct = calcHrvPct(days);
  const cv = calcCV(days);
  const trendRatio = calcTrendRatio(getHRV(today), hrv7);
  const tsb = (today.ctl != null && today.atl != null) ? today.ctl - today.atl : null;
  const trainingReadiness = calcTrainingReadiness(today, days);
  const recoveryScore = calcRecoveryScore(today, days);
  const threeDaysDown = threeDaysHrvDown(days);
  const { zone, label, advice } = calcAmpel({
    hrvPct,
    hrvToday: getHRV(today),
    hrv7,
    cv,
    tsb,
    threeDaysDown,
  });
  const { active: hardTriggers } = evaluateHardTriggers({ hrvPct, cv, tsb, threeDaysDown });

  return {
    hrv7,
    hrvPct,
    cv,
    trendRatio,
    tsb,
    trainingReadiness,
    recoveryScore,
    cvZone: zone,
    cvZoneLabel: label,
    cvZoneAdvice: advice,
    hrvFloorFlag: calcHrvFloorFlag(days),
    hardTriggers,
  };
}
