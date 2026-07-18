// src/lib/notionSync.ts
//
// Geteilte Notion-Sync-Logik ("🏃 Habits Tracker").
// Wird sowohl vom on-demand Sync (src/app/api/notion-sync/route.ts, ausgelöst
// durch den "→ intervals.icu"-Button) als auch vom automatischen Nacht-Sync
// (src/lib/autoSync.ts, siehe src/instrumentation.ts) verwendet.
//
// Liest keine Dateien selbst — habits/history werden vom Aufrufer übergeben.
//
// Env (.env.local):
//   NOTION_HABITS_TOKEN — Notion Integration Token (ntn_...)
//   NOTION_DB_ID        — Notion Datenbank-ID

const NOTION_TOKEN = process.env.NOTION_HABITS_TOKEN ?? "";
const NOTION_DB_ID = process.env.NOTION_DB_ID ?? "";
const NOTION_API = "https://api.notion.com/v1";
const NOTION_HEADERS = {
  Authorization: `Bearer ${NOTION_TOKEN}`,
  "Content-Type": "application/json",
  "Notion-Version": "2022-06-28",
};

// Umbenannte / vertippte Habit-Namen → bestehende Notion-Spalte mappen.
// "emoji name (auto-generiert)" → "Notion-Spaltenname (existierend)"
const COLUMN_ALIASES: Record<string, string> = {
  "💪 Trainigsplan": "💪 Trainingsplan",
};

// ── Typen (nur die für den Sync relevanten Felder) ──────────────────────────
export interface Habit {
  id: string;
  name: string;
  emoji?: string;
  unit?: string;
  habitType?: string;
  numTarget?: number;
}
export interface DayData {
  checked?: string[];
  numeric?: Record<string, number>;
  mood?: number | null;
  dynamicTargets?: Record<string, number>;
  drinks?: Record<string, Record<string, number>>;
  lastDrinkTime?: Record<string, string>;
  wellness?: Record<string, number>;
  nutrition?: { kcal?: number; carbs?: number; protein?: number };
}
export type History = Record<string, DayData>;

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
  const sum = Object.entries(drinks).reduce((s, [label, n]) => s + (DRINK_SD[label] ?? 0) * n, 0);
  return Math.round(sum * 10) / 10;
}

type NotionType = "checkbox" | "number" | "rich_text";
type Schema = Record<string, string>;

// ── Hilfsfunktionen ─────────────────────────────────────────────────────────
const fmt = (val: number): string => val.toFixed(1).replace(".", ",");

function colName(h: Habit, suffix = ""): string {
  let raw = `${h.emoji ?? ""} ${h.name ?? ""}`.trim();
  if (suffix) raw = `${raw} ${suffix}`;
  return COLUMN_ALIASES[raw] ?? raw;
}

// ── Notion: Schema laden / Spalten sicherstellen ────────────────────────────
async function getDbSchema(): Promise<Schema> {
  const r = await fetch(`${NOTION_API}/databases/${NOTION_DB_ID}`, {
    headers: NOTION_HEADERS,
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Notion DB-Schema ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const json = (await r.json()) as { properties: Record<string, { type: string }> };
  const schema: Schema = {};
  for (const [k, v] of Object.entries(json.properties)) schema[k] = v.type;
  return schema;
}

async function ensureCol(name: string, notionType: NotionType, schema: Schema): Promise<void> {
  if (schema[name] === notionType) return; // stimmt bereits
  const typeCfg: Record<NotionType, object> = {
    checkbox: { checkbox: {} },
    number: { number: { format: "number" } },
    rich_text: { rich_text: {} },
  };
  const r = await fetch(`${NOTION_API}/databases/${NOTION_DB_ID}`, {
    method: "PATCH",
    headers: NOTION_HEADERS,
    body: JSON.stringify({ properties: { [name]: { ...typeCfg[notionType], name } } }),
    cache: "no-store",
  });
  if (r.ok) schema[name] = notionType;
  // Fehler beim Spalten-Anlegen nicht fatal — Upsert überspringt fehlende Spalte
}

// ── Notion: Seite finden / upserten ─────────────────────────────────────────
async function findPage(dateStr: string): Promise<string | null> {
  const r = await fetch(`${NOTION_API}/databases/${NOTION_DB_ID}/query`, {
    method: "POST",
    headers: NOTION_HEADERS,
    body: JSON.stringify({ filter: { property: "Datum", date: { equals: dateStr } } }),
    cache: "no-store",
  });
  if (!r.ok) return null;
  const res = ((await r.json()) as { results?: { id: string }[] }).results ?? [];
  return res.length ? res[0].id : null;
}

async function upsertPage(dateStr: string, props: Record<string, unknown>): Promise<void> {
  const pageId = await findPage(dateStr);
  if (pageId) {
    const r = await fetch(`${NOTION_API}/pages/${pageId}`, {
      method: "PATCH",
      headers: NOTION_HEADERS,
      body: JSON.stringify({ properties: props }),
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`Update ${r.status}: ${(await r.text()).slice(0, 200)}`);
  } else {
    const r = await fetch(`${NOTION_API}/pages`, {
      method: "POST",
      headers: NOTION_HEADERS,
      body: JSON.stringify({
        parent: { database_id: NOTION_DB_ID },
        properties: { Datum: { date: { start: dateStr } }, ...props },
      }),
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`Create ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
}

// ── Properties aus Habits + Tag ableiten ────────────────────────────────────
function buildProps(
  habits: Habit[],
  day: DayData,
): { props: Record<string, unknown>; needed: Record<string, NotionType> } {
  const checked = new Set(day.checked ?? []);
  const numeric = day.numeric ?? {};
  const props: Record<string, unknown> = {};
  const needed: Record<string, NotionType> = {};

  for (const h of habits) {
    const hid = h.id;
    const unit = (h.unit ?? "").toLowerCase();
    const htype = h.habitType ?? "checkbox";
    const tgt = h.numTarget ?? 0;

    if (unit === "sd") {
      // Nur SD-Zahl — kein Checkbox, keine Aufschlüsselung.
      // SD aus den Getränken ableiten (wie die Dashboard-Anzeige), da
      // numeric[hid] durch Toggles auf numTarget veraltet sein kann.
      const c = colName(h, "(SD)");
      needed[c] = "number";
      const sdFromDrinks = calcDrinkSD(day.drinks?.[hid] ?? {});
      const val = sdFromDrinks > 0 ? sdFromDrinks : (numeric[hid] ?? 0);
      if (val) props[c] = { number: Math.round(val * 100) / 100 };

      // Uhrzeit des letzten Drinks (aktualisiert sich bei jedem neuen Drink).
      const timeCol = colName(h, "(Uhrzeit)");
      needed[timeCol] = "rich_text";
      const lastTime = day.lastDrinkTime?.[hid];
      if (lastTime) props[timeCol] = { rich_text: [{ text: { content: lastTime } }] };
    } else if (unit === "l" || unit === "liter") {
      // Wasser: Textspalte "getrunken/ziel" (z.B. "3,7/3,5")
      const c = colName(h);
      needed[c] = "rich_text";
      const actual = numeric[hid];
      const effectiveTgt = day.dynamicTargets?.[hid] ?? tgt;
      if (actual !== undefined && actual !== null) {
        const text = `${fmt(actual)}/${fmt(effectiveTgt)}`;
        props[c] = { rich_text: [{ text: { content: text } }] };
      }
    } else if (htype === "numeric") {
      const c = colName(h);
      needed[c] = "number";
      const val = numeric[hid];
      if (val !== undefined && val !== null) props[c] = { number: Math.round(val * 100) / 100 };
    } else {
      // Checkbox
      const c = colName(h);
      needed[c] = "checkbox";
      props[c] = { checkbox: checked.has(hid) };
    }
  }

  // Stimmung → bestehende "Mood (1-5)" Spalte als Zahl
  const mood = day.mood;
  if (mood !== undefined && mood !== null) {
    needed["Mood (1-5)"] = "number";
    props["Mood (1-5)"] = { number: mood };
  }

  return { props, needed };
}

export interface NotionSyncResult {
  ok: number;
  errors: string[];
}

// ── Orchestrator: Spalten sicherstellen + Tage upserten ─────────────────────
export async function syncDatesToNotion(
  habits: Habit[],
  history: History,
  dates: string[],
): Promise<NotionSyncResult> {
  if (!NOTION_TOKEN || !NOTION_DB_ID) {
    throw new Error("NOTION_HABITS_TOKEN / NOTION_DB_ID nicht konfiguriert (.env.local)");
  }
  if (dates.length === 0) return { ok: 0, errors: [] };

  // Spalten einmalig prüfen/anlegen (aus dem jüngsten Tag ableiten)
  const schema = await getDbSchema();
  const sample = history[dates[dates.length - 1]] ?? {};
  const { needed } = buildProps(habits, sample);
  for (const [name, ntype] of Object.entries(needed)) await ensureCol(name, ntype, schema);

  let ok = 0;
  const errors: string[] = [];
  for (const d of dates) {
    const { props } = buildProps(habits, history[d] ?? {});
    if (Object.keys(props).length === 0) continue;
    try {
      await upsertPage(d, props);
      ok++;
    } catch (e) {
      errors.push(`${d}: ${String(e)}`);
    }
  }
  return { ok, errors };
}

export function isNotionConfigured(): boolean {
  return !!(NOTION_TOKEN && NOTION_DB_ID);
}
