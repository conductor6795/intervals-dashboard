/**
 * Nutzer-Einstellungen für den Schlafcoach (localStorage, analog settings.ts).
 * baseSleepNeedH: Fallback-Basisbedarf in Stunden, solange der Coach noch keinen
 *   individuellen Optimalwert aus den eigenen Daten gelernt hat.
 * targetWakeTimeWeekday / targetWakeTimeWeekend: gewünschte Aufstehzeit "HH:MM"
 *   getrennt für Wochentage (z.B. 06:30) und Wochenende — Anker der Rückrechnung.
 * onsetLatencyMin: angenommene Einschlafzeit (Bett → Schlaf), da Garmin nur den
 *   erkannten Schlafbeginn liefert, nicht den Zeitpunkt des Zubettgehens.
 */
export interface SleepCoachSettings {
  baseSleepNeedH: number;
  targetWakeTimeWeekday: string;
  targetWakeTimeWeekend: string;
  onsetLatencyMin: number;
}

export const DEFAULT_SLEEP_SETTINGS: SleepCoachSettings = {
  baseSleepNeedH: 8,
  targetWakeTimeWeekday: "06:30",
  targetWakeTimeWeekend: "08:00",
  onsetLatencyMin: 15,
};

const STORAGE_KEY = "dashboard-sleep-coach-settings";

export function getSleepSettings(): SleepCoachSettings {
  if (typeof window === "undefined") return DEFAULT_SLEEP_SETTINGS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_SLEEP_SETTINGS;
    const parsed = JSON.parse(stored);
    // Migration: alter Einzelwert targetWakeTime → Wochentag/Wochenende
    if (parsed.targetWakeTime && !parsed.targetWakeTimeWeekday) {
      parsed.targetWakeTimeWeekday = parsed.targetWakeTime;
      parsed.targetWakeTimeWeekend = parsed.targetWakeTime;
    }
    return { ...DEFAULT_SLEEP_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SLEEP_SETTINGS;
  }
}

export function setSleepSettings(settings: SleepCoachSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event("sleep-settings-changed"));
}
