/**
 * Biologisches Alter / Fitness-Alter — im Stil von Garmins "Fitness Age".
 *
 * Kern ist VO2max: Für jedes Alter gibt es einen typischen VO2max-Durchschnitt.
 * Aus dem gemessenen VO2max wird per Umkehrung das Alter geschätzt, bei dem dieser
 * Wert dem Bevölkerungsschnitt entspricht. Ruhepuls und HRV justieren fein nach
 * (guter RHR / hohe HRV → jünger). Rein informativ, keine medizinische Aussage.
 */
import { WellnessDay } from "./types";
import { getHRV, calcHRV7 } from "./calculations";

export interface BiologicalAgeResult {
  fitnessAge: number | null;
  chronologicalAge: number | null;
  deltaYears: number | null;         // negativ = jünger als chronologisch
  vo2max: number | null;
  vo2maxSource: string;
  rhrAdjust: number;                 // Beitrag Ruhepuls (Jahre)
  hrvAdjust: number;                 // Beitrag HRV (Jahre)
  rating: string;
  hasData: boolean;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Durchschnittlicher VO2max nach Alter (ml/kg/min), grob nach Bevölkerungsnormen.
 * Männer: ~50 bei 20 J, linear ~0,35/Jahr fallend. Frauen ~7 Punkte darunter.
 */
function normVo2max(age: number, sex: "M" | "F"): number {
  const base = 50 - 0.35 * (age - 20);
  return sex === "F" ? base - 7 : base;
}

/** Umkehrung: aus VO2max das Alter schätzen, bei dem dieser Wert Durchschnitt ist. */
function vo2maxToAge(vo2max: number, sex: "M" | "F"): number {
  const base = sex === "F" ? vo2max + 7 : vo2max;
  const age = 20 + (50 - base) / 0.35;
  return clamp(age, 18, 85);
}

export function calcBiologicalAge(
  wellnessDays: WellnessDay[],
  vo2max: number | null,
  vo2maxSource: string,
  chronologicalAge: number | null,
  sex: "M" | "F" = "M"
): BiologicalAgeResult {
  const empty: BiologicalAgeResult = {
    fitnessAge: null, chronologicalAge, deltaYears: null,
    vo2max, vo2maxSource, rhrAdjust: 0, hrvAdjust: 0,
    rating: "Keine Daten", hasData: false,
  };
  if (vo2max == null || vo2max <= 0) return empty;

  let age = vo2maxToAge(vo2max, sex);

  // ── Feinjustierung Ruhepuls: guter RHR macht "jünger" ──
  const rhrVals = wellnessDays
    .slice(-14)
    .map((d) => d.restingHR)
    .filter((v): v is number => v != null && v > 0);
  const rhr = rhrVals.length ? rhrVals.reduce((a, b) => a + b, 0) / rhrVals.length : null;
  let rhrAdjust = 0;
  if (rhr != null) {
    // Referenz 58 bpm; je 4 bpm besser/schlechter → ∓1 Jahr, gedeckelt ±4
    rhrAdjust = clamp((rhr - 58) / 4, -4, 4);
  }

  // ── Feinjustierung HRV: hohe HRV ggü. Alterserwartung macht "jünger" ──
  const hrv7 = calcHRV7(wellnessDays) ?? (wellnessDays.length ? getHRV(wellnessDays[wellnessDays.length - 1]) : null);
  let hrvAdjust = 0;
  if (hrv7 != null && hrv7 > 0) {
    // grobe Alterserwartung HRV (RMSSD-ähnlich): ~65 ms bei 20 J, ~0,6/Jahr fallend
    const expectedHrv = 65 - 0.6 * (age - 20);
    hrvAdjust = clamp((expectedHrv - hrv7) / 6, -4, 4); // HRV über Erwartung → jünger
  }

  const fitnessAge = Math.round(clamp(age + rhrAdjust + hrvAdjust, 18, 85));
  const deltaYears = chronologicalAge != null ? fitnessAge - chronologicalAge : null;

  let rating: string;
  if (deltaYears != null) {
    if (deltaYears <= -5) rating = "Deutlich jünger als dein Alter";
    else if (deltaYears < 0) rating = "Jünger als dein Alter";
    else if (deltaYears === 0) rating = "Genau auf deinem Alter";
    else if (deltaYears <= 5) rating = "Etwas älter als dein Alter";
    else rating = "Älter als dein Alter — Ausdauerbasis ausbauen";
  } else {
    if (fitnessAge <= 30) rating = "Sehr gute aerobe Fitness";
    else if (fitnessAge <= 45) rating = "Gute aerobe Fitness";
    else rating = "Ausdauerbasis ausbaufähig";
  }

  return {
    fitnessAge, chronologicalAge, deltaYears,
    vo2max, vo2maxSource, rhrAdjust, hrvAdjust, rating, hasData: true,
  };
}
