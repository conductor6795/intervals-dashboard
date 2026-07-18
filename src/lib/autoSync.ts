// src/lib/autoSync.ts
//
// Automatischer Nacht-Sync: habits.json → intervals.icu (Wellness) + Notion.
// Wird um 05:00 Serverzeit von src/instrumentation.ts angestoßen, damit der
// Sync auch läuft wenn niemand manuell auf "→ intervals.icu" klickt.
//
// Portiert die doSync()-Payload-Logik aus src/app/habits/page.tsx serverseitig
// (dort läuft sie im Browser und kann daher nachts nicht von selbst feuern).
// Muss inhaltlich mit doSync() in src/app/habits/page.tsx übereinstimmen.
//
// Standard-Zieltage: gestern + heute (Servertag, siehe TZ env / Dockerfile).
// "Gestern" ist der Tag, der um 05:00 gerade zu Ende gegangen ist — der
// eigentliche Zweck des Nacht-Syncs. "Heute" wird zusätzlich mitgenommen,
// falls schon vor 05:00 Uhr etwas für den neuen Tag eingetragen wurde
// (z.B. Drinks nach Mitternacht); ein späterer manueller Sync überschreibt
// den Eintrag später ohnehin per Upsert.

import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { syncDatesToNotion, isNotionConfigured, type Habit, type History, type DayData } from "./notionSync";

const DATA_DIR = process.env.HABITS_DATA_DIR ?? path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "habits.json");

// ── Subjektive Befinden-Felder (1–4) → muss mit IV_WELLNESS_FIELDS in
//    src/app/habits/page.tsx übereinstimmen. ─────────────────────────────────
const IV_WELLNESS_KEYS = ["soreness", "fatigue", "stress", "motivation", "injury"] as const;

// Standarddrinks nach Getränketyp (SD = 10g reiner Alkohol) — muss mit
// DRINK_BUTTONS in src/app/habits/page.tsx übereinstimmen.
const DRINK_SD: Record<string, number> = {
  "0,2L Bier": 0.6,
  "0,33L Bier": 1.0,
  "0,5L Bier": 1.5,
  Shot: 1.3,
  Mische: 1.5,
  Cocktail: 1.3,
};
function calcDrinkSD(drinks: Record<string, number>): number {
  return Math.round(Object.entries(drinks).reduce((s, [label, n]) => s + (DRINK_SD[label] ?? 0) * n, 0) * 10) / 10;
}
function formatDrinkLabel(drinks: Record<string, number>): string {
  const parts = Object.entries(drinks).filter(([, n]) => n > 0).map(([label, n]) => `${n}× ${label}`);
  if (!parts.length) return "";
  return `${parts.join(", ")} (${calcDrinkSD(drinks)} SD)`;
}

// Dashboard-Stimmung (1–5, 1=schlecht) → intervals mood (1=GREAT … 4=GRUMPY)
function moodTo4(m: number): number {
  return ({ 5: 1, 4: 2, 3: 3, 2: 4, 1: 4 } as Record<number, number>)[m] ?? 3;
}
// Hydration (subjektiv, 1–4) aus erreichtem Anteil des Wasserziels
function hydrationFromRatio(ratio: number): number {
  if (ratio >= 1.0) return 1;
  if (ratio >= 0.8) return 2;
  if (ratio >= 0.6) return 3;
  return 4;
}

function buildWellnessPayload(habits: Habit[], date: string, d: DayData): Record<string, unknown> {
  const checked = new Set(d.checked ?? []);
  const numeric = d.numeric ?? {};

  const tags = habits.filter(h => checked.has(h.id)).map(h => h.name.replace(/\s+/g, "_"));
  const nums = habits
    .filter(h => h.habitType === "numeric" && numeric[h.id] !== undefined)
    .map(h => {
      if ((h.unit ?? "").toLowerCase() === "sd") {
        const label = formatDrinkLabel(d.drinks?.[h.id] ?? {});
        return label ? `${h.name}: ${label}` : `${h.name}: ${numeric[h.id]} SD`;
      }
      return `${h.name}: ${numeric[h.id]} ${h.unit ?? ""}`;
    })
    .join(", ");

  const waterHabit = habits.find(h => h.habitType === "numeric" && ["l", "liter"].includes((h.unit ?? "").toLowerCase()));
  const waterL = waterHabit ? numeric[waterHabit.id] : undefined;

  const payload: Record<string, unknown> = { id: date };
  const commentParts = [tags.length > 0 ? tags.join(", ") : null, nums || null].filter(Boolean).join(" | ");
  if (commentParts) payload.comments = `Habit Tracker – ${commentParts}`;
  if (d.mood !== null && d.mood !== undefined) payload.mood = moodTo4(d.mood);

  for (const key of IV_WELLNESS_KEYS) {
    const v = d.wellness?.[key];
    if (v !== undefined && v >= 1 && v <= 4) payload[key] = v;
  }

  if (waterHabit && waterL !== undefined && waterL > 0) {
    payload.hydrationVolume = waterL;
    const target = d.dynamicTargets?.[waterHabit.id] ?? waterHabit.numTarget ?? 0;
    if (target > 0) payload.hydration = hydrationFromRatio(waterL / target);
  }
  if (d.nutrition?.kcal !== undefined) payload.kcalConsumed = d.nutrition.kcal;
  if (d.nutrition?.carbs !== undefined) payload.carbohydrates = d.nutrition.carbs;
  if (d.nutrition?.protein !== undefined) payload.protein = d.nutrition.protein;

  return payload;
}

async function pushWellness(date: string, payload: Record<string, unknown>): Promise<void> {
  const athleteId = process.env.INTERVALS_ATHLETE_ID;
  const apiKey = process.env.INTERVALS_API_KEY;
  if (!athleteId || !apiKey) throw new Error("nicht konfiguriert (.env.local)");

  const auth = "Basic " + Buffer.from(`API_KEY:${apiKey}`).toString("base64");
  const res = await fetch(`https://intervals.icu/api/v1/athlete/${athleteId}/wellness/${date}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`intervals.icu ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

// ── Lokales Kalenderdatum (respektiert TZ env, siehe Dockerfile) ────────────
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function yesterdayLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDateStr(d);
}
function todayLocal(): string {
  return localDateStr(new Date());
}

export interface AutoSyncDayResult {
  date: string;
  skipped?: boolean;
  ivOk?: boolean;
  ivError?: string;
  notionOk?: boolean;
  notionError?: string;
}

export async function runAutoSync(dates?: string[]): Promise<AutoSyncDayResult[]> {
  const targetDates = dates && dates.length ? dates : [yesterdayLocal(), todayLocal()];

  if (!existsSync(DATA_FILE)) {
    return targetDates.map(date => ({ date, ivError: "habits.json nicht gefunden" }));
  }

  let habits: Habit[];
  let history: History;
  try {
    const parsed = JSON.parse(await readFile(DATA_FILE, "utf-8"));
    habits = parsed.habits ?? [];
    history = parsed.history ?? {};
  } catch (e) {
    return targetDates.map(date => ({ date, ivError: `habits.json unlesbar: ${String(e)}` }));
  }

  const results: AutoSyncDayResult[] = [];
  const datesWithData = targetDates.filter(date => history[date] !== undefined);

  // Notion: einmal für alle Tage mit Daten (Spalten werden nur einmal geprüft).
  let notionResult: { ok: number; errors: string[] } | undefined;
  let notionSetupError: string | undefined;
  if (isNotionConfigured() && datesWithData.length > 0) {
    try {
      notionResult = await syncDatesToNotion(habits, history, datesWithData);
    } catch (e) {
      notionSetupError = String(e);
    }
  }

  for (const date of targetDates) {
    const day = history[date];
    if (!day) {
      results.push({ date, skipped: true });
      continue;
    }

    const result: AutoSyncDayResult = { date };
    try {
      const payload = buildWellnessPayload(habits, date, day);
      await pushWellness(date, payload);
      result.ivOk = true;
    } catch (e) {
      result.ivError = String(e);
    }

    if (!isNotionConfigured()) {
      result.notionOk = true; // Notion optional — kein Fehler wenn nicht konfiguriert
    } else if (notionSetupError) {
      result.notionError = notionSetupError;
    } else {
      const err = notionResult?.errors.find(e => e.startsWith(`${date}:`));
      result.notionOk = !err;
      if (err) result.notionError = err;
    }

    results.push(result);
  }

  return results;
}
