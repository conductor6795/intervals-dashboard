/**
 * Athleten-Konstanten — Spiegel von athleten-konstanten.md (Single Point of Truth).
 *
 * WICHTIG: Wenn sich in athleten-konstanten.md etwas ändert, NUR hier anpassen —
 * calculations.ts und die Ampel-/Readiness-Logik lesen alle von hier. Damit gibt es
 * im Dashboard genau eine Quelle für Schwellenwerte (keine 6,5-vs-12-Spaltung mehr).
 */

// ── HRV: rollender 28-Tage-Perzentil (Hauptsignal Langzeittrend) ──
export const HRV_PCT = {
  balanced: 60, // ≥60 ausbalanciert / erholt
  neutral: 40, // 40–59 neutral (Build)
  suppressed: 20, // 20–39 leicht gedrückt
  critical: 5, // <5 kritisch → Deload
} as const;

// ── HRV-CV (Variationskoeffizient der letzten 7 Messtage, %) ──
export const HRV_CV = {
  warn: 12, // 12–15 % → HIT-Budget −1
  unstable: 15, // >15 % → ANS-Instabilität
} as const;

// ── Tagessignal: hrv_today / hrv7 ──
export const DAY_SIGNAL = {
  recovered: 1.05, // > → erholt
  imbalanced: 0.95, // < → unausgewogen
  low: 0.85, // < → niedrig
  suspension: 0.92, // ≥ → CV-Spike als transient werten
  downTrend: 0.9, // < an 3+ Tagen → Hard-Trigger
} as const;

// ── TSB-Klassen (absolut, athleten-konstanten.md) ──
export const TSB = {
  fresh: 0, // >0 frisch
  productiveFloor: -20, // −5..−20 produktiv; < −20 hoch belastet
  overload: -30, // < −30 Überbelastung
} as const;

// ── Hard-Trigger (sync mit tagescheck-SKILL.md) ──
export const HARD = {
  CV: 15.0, // CV > 15 (nur mit hrv_pct < 20 zusammen ein Hard-Trigger)
  CV_PCT: 20.0, // hrv_pct-Schwelle, unter der CV > 15 zum Hard-Trigger wird
  HRV_PCT: 5.0, // hrv_pct < 5
  TSB: -30, // TSB < −30
  FLOOR_RATIO: 0.88, // hrv7 < hrv60 × 0.88 → Absolut-Drift-Banner (kein Sofort-Deload)
} as const;

// ── Statische Athletenparameter (Spiro 26.03.2026) ──
export const ATHLETE = {
  ftp: 300,
  hfMax: 201,
  vt1Hr: 160,
  vt2Hr: 187,
  pmax: 407,
  z2HrLow: 140,
  z2HrHigh: 160,
  weightCorridor: [81, 83] as const,
  // Für das biologische Alter (Fitness-Alter). birthYear = null → nur Fitness-Alter
  // ohne Vergleich zum chronologischen Alter. Bei Bedarf hier eintragen.
  birthYear: null as number | null,
  sex: "M" as "M" | "F",
} as const;

// ── Wattzonen (abgeleitet von FTP 300 W) ──
export const POWER_ZONES = {
  z1: [0, 168],
  z2: [168, 225],
  sst: [264, 279], // 88–93 %
  threshold: [279, 315], // 93–105 %
  vo2: [345, 360], // 115–120 %
} as const;
