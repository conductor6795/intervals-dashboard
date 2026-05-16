function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function formatHours(h: number): string {
  const wholeHours = Math.floor(h);
  const remainingMins = Math.round((h - wholeHours) * 60);
  if (wholeHours === 0) return `ca. ${remainingMins}min`;
  if (remainingMins === 0) return `ca. ${wholeHours}h`;
  return `ca. ${wholeHours}h ${remainingMins}min`;
}

type RecType = "rest" | "z1" | "z2mod" | "intensity" | "z2long" | "fallback";

function calcDuration(
  type: RecType,
  ctl: number | null,
  weeklyHours: number | null,
): string {
  if (type === "rest" || type === "fallback") return "";

  let rawHours: number;

  if (ctl !== null) {
    const typical = (ctl / 100) * 1.5;
    switch (type) {
      case "z1":        rawHours = clamp(typical * 0.6, 0.5, 1.0);  break;
      case "z2mod":     rawHours = clamp(typical * 1.0, 0.75, 1.5); break;
      case "intensity": rawHours = clamp(typical * 0.8, 0.75, 1.5); break;
      case "z2long":    rawHours = clamp(typical * 2.0, 1.5, 3.5);  break;
      default:          rawHours = 1.0;
    }
  } else {
    // Standardwerte ohne CTL
    switch (type) {
      case "z1":        rawHours = 0.75; break;
      case "z2mod":     rawHours = 1.0;  break;
      case "intensity": rawHours = 1.0;  break;
      case "z2long":    rawHours = 1.5;  break;
      default:          rawHours = 1.0;
    }
  }

  // 10%-Wochenvolumen-Steigerungsgrenze
  if (weeklyHours !== null) {
    const maxWeekly = weeklyHours * 1.1;
    const remaining = maxWeekly - weeklyHours; // = weeklyHours * 0.1
    if (rawHours > remaining) {
      rawHours = Math.max(0.5, remaining);
    }
  }

  return formatHours(Math.round(rawHours * 4) / 4);
}

export function getTrainingRecommendation(
  cvQuadrant: string,
  tsb: number | null,
  readiness: number | null,
  ctl: number | null,
  weeklyHours: number | null,
): { icon: string; short: string; detail: string; duration: string } {

  let type: RecType;
  let icon: string;
  let short: string;
  let detail: string;

  if (
    (readiness !== null && readiness < 30) ||
    (tsb !== null && tsb < -25)
  ) {
    type = "rest"; icon = "🛑";
    short = "Ruhetag";
    detail = "Körper braucht vollständige Erholung";

  } else if (
    (readiness !== null && readiness < 50) ||
    (tsb !== null && tsb < -15) ||
    cvQuadrant === "tief-fallend"
  ) {
    type = "z1"; icon = "🟡";
    short = "Nur Z1";
    detail = "Lockeres Spinning oder Spaziergang — aktive Erholung";

  } else if (
    cvQuadrant === "hoch-steigend" &&
    (tsb === null || tsb >= 5) &&
    (readiness === null || readiness >= 75)
  ) {
    type = "intensity"; icon = "🔥";
    short = "Intensität okay";
    detail = "Intervalle, Schwelle oder HIT möglich";

  } else if (
    cvQuadrant === "hoch-steigend" &&
    (tsb === null || tsb > -5)
  ) {
    type = "z2long"; icon = "🟢";
    short = "Lange Z2-Einheit";
    detail = "Idealer Tag für 2h+ ruhiges Grundlagentraining";

  } else if (
    cvQuadrant.includes("hoch") ||
    (cvQuadrant === "tief-steigend" && (readiness === null || readiness >= 50))
  ) {
    type = "z2mod"; icon = "🔵";
    short = "Moderates Z2";
    detail = "Normaler Trainingstag — kein Druck";

  } else {
    type = "fallback"; icon = "⚪";
    short = "Auf Körper hören";
    detail = "Daten unvollständig";
  }

  return { icon, short, detail, duration: calcDuration(type, ctl, weeklyHours) };
}
