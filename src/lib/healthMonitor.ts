/**
 * Gesundheitsmonitor — vergleicht Ruhepuls, Atemfrequenz, Stress und SpO2 des
 * aktuellen Tages gegen die persönliche 28-Tage-Baseline. Jeder Wert bekommt:
 *  - eine Position auf einer vertikalen Skala (0 = niedrig, 1 = hoch, Mitte = normal),
 *  - ein Status-Label (Niedrig / Normal / Hoch),
 *  - eine Ampelstufe (normal / attention / alert) je nachdem, ob die Abweichung
 *    in die problematische Richtung geht.
 * Angelehnt an Bevels Health Monitor / Garmins Health Snapshot, ausschließlich aus
 * bereits vorhandenen Garmin- und Wellness-Feldern abgeleitet.
 */
import { GarminDay } from "@/hooks/useGarmin";
import { WellnessDay } from "./types";

export type HealthFlagLevel = "normal" | "attention" | "alert";
export type HealthStatus = "Niedrig" | "Normal" | "Hoch";

export interface HealthFlag {
  key: string;
  label: string;
  valueText: string;
  baselineText: string;
  position: number;        // 0..1 für den Punkt auf der vertikalen Leiste (0=unten/niedrig)
  status: HealthStatus;
  level: HealthFlagLevel;
  detail: string;
}

export interface HealthMonitorResult {
  overall: HealthFlagLevel;
  flags: HealthFlag[];
  hasEnoughData: boolean;
}

function mean(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
function worse(a: HealthFlagLevel, b: HealthFlagLevel): HealthFlagLevel {
  const rank: Record<HealthFlagLevel, number> = { normal: 0, attention: 1, alert: 2 };
  return rank[a] >= rank[b] ? a : b;
}

/** Position (0..1) und Status aus Wert, Baseline und Halbspanne (Wert bei
 *  baseline+halfSpan → Position 1.0). */
function positionAndStatus(value: number, baseline: number, halfSpan: number): { position: number; status: HealthStatus } {
  const position = clamp(0.5 + (value - baseline) / (2 * halfSpan), 0, 1);
  const status: HealthStatus = position < 0.4 ? "Niedrig" : position > 0.6 ? "Hoch" : "Normal";
  return { position, status };
}

export function calcHealthMonitor(
  garminDays: GarminDay[],
  wellnessDays: WellnessDay[]
): HealthMonitorResult {
  const flags: HealthFlag[] = [];
  const sorted = [...garminDays].sort((a, b) => a.date.localeCompare(b.date));
  const today = sorted[sorted.length - 1];
  const history = sorted.slice(0, -1).slice(-28);

  let dataPoints = 0;

  // ── Ruhepuls (hoch = ungünstig) ──
  const rhrBaseline = mean(history.map((d) => d.restingHr).filter((v): v is number => v != null));
  if (today?.restingHr != null && rhrBaseline > 0) {
    dataPoints++;
    const diff = today.restingHr - rhrBaseline;
    const { position, status } = positionAndStatus(today.restingHr, rhrBaseline, 12);
    let level: HealthFlagLevel = "normal";
    if (diff >= 10) level = "alert";
    else if (diff >= 5) level = "attention";
    flags.push({
      key: "rhr",
      label: "Ruhepuls",
      valueText: `${today.restingHr} bpm`,
      baselineText: `Ø ${rhrBaseline.toFixed(0)}`,
      position, status, level,
      detail: level === "normal"
        ? `Im Normalbereich (Ø ${rhrBaseline.toFixed(0)} bpm).`
        : `${diff.toFixed(0)} bpm über Ø. Kann auf Übertraining, Infekt oder Stress hindeuten.`,
    });
  }

  // ── Atemfrequenz (hoch = ungünstig) ──
  const respBaseline = mean(history.map((d) => d.respirationAvg).filter((v): v is number => v != null));
  if (today?.respirationAvg != null && respBaseline > 0) {
    dataPoints++;
    const diff = today.respirationAvg - respBaseline;
    const { position, status } = positionAndStatus(today.respirationAvg, respBaseline, 5);
    let level: HealthFlagLevel = "normal";
    if (diff >= 4) level = "alert";
    else if (diff >= 2) level = "attention";
    flags.push({
      key: "respiration",
      label: "Atemfrequenz",
      valueText: `${today.respirationAvg.toFixed(1)} /min`,
      baselineText: `Ø ${respBaseline.toFixed(1)}`,
      position, status, level,
      detail: level === "normal"
        ? `Im Normalbereich (Ø ${respBaseline.toFixed(1)} /min).`
        : `${diff.toFixed(1)} /min über Ø. Möglicher früher Hinweis auf beginnenden Infekt.`,
    });
  }

  // ── Stress (hoch = ungünstig) ──
  const stressBaseline = mean(history.map((d) => d.stressAvg).filter((v): v is number => v != null));
  if (today?.stressAvg != null && stressBaseline > 0) {
    dataPoints++;
    const ratio = today.stressAvg / stressBaseline;
    const { position, status } = positionAndStatus(today.stressAvg, stressBaseline, stressBaseline * 0.7);
    let level: HealthFlagLevel = "normal";
    if (ratio >= 1.6) level = "alert";
    else if (ratio >= 1.3) level = "attention";
    flags.push({
      key: "stress",
      label: "Stress",
      valueText: `Ø ${today.stressAvg}`,
      baselineText: `Ø28 ${stressBaseline.toFixed(0)}`,
      position, status, level,
      detail: level === "normal"
        ? `Im Normalbereich (Ø28 ${stressBaseline.toFixed(0)}).`
        : `Deutlich über Ø28 ${stressBaseline.toFixed(0)}. Erholung heute priorisieren.`,
    });
  }

  // ── SpO2 (niedrig = ungünstig) ──
  const wellnessHistory = wellnessDays.slice(0, -1).slice(-28);
  const spo2Baseline = mean(wellnessHistory.map((d) => d.spO2Average).filter((v): v is number => v != null));
  const todaySpo2 = wellnessDays[wellnessDays.length - 1]?.spO2Average;
  if (todaySpo2 != null && spo2Baseline > 0) {
    dataPoints++;
    const diff = spo2Baseline - todaySpo2; // niedriger = schlechter
    const { position, status } = positionAndStatus(todaySpo2, spo2Baseline, 4);
    let level: HealthFlagLevel = "normal";
    if (diff >= 4) level = "alert";
    else if (diff >= 2) level = "attention";
    flags.push({
      key: "spo2",
      label: "SpO2",
      valueText: `${todaySpo2.toFixed(1)} %`,
      baselineText: `Ø ${spo2Baseline.toFixed(1)} %`,
      position, status, level,
      detail: level === "normal"
        ? `Im Normalbereich (Ø ${spo2Baseline.toFixed(1)} %).`
        : `${diff.toFixed(1)} % unter Ø. Bei anhaltend niedrigen Werten ärztlich abklären.`,
    });
  }

  const overall = flags.reduce<HealthFlagLevel>((acc, f) => worse(acc, f.level), "normal");

  return { overall, flags, hasEnoughData: dataPoints >= 2 };
}
