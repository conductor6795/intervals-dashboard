// src/app/api/notion-sync/route.ts
//
// Serverseitiger Habits-Sync zu Notion ("🏃 Habits Tracker").
// TS-Port von habits-sync/habits-sync.py — läuft jetzt on-demand beim
// "→ intervals.icu"-Sync (doSync) statt als separater, unzuverlässiger Cron.
//
// Liest habits.json direkt von der Platte (gleiche DATA_FILE-Konvention wie
// /api/habits) und schiebt einen Tag (oder mit { all:true } die ganze Historie)
// als Upsert nach Notion. Spalten werden automatisch angelegt, nie gelöscht.
//
// Request-Body: { "date": "2026-06-15" }  oder  { "all": true }
//
// Env (.env.local):
//   NOTION_HABITS_TOKEN — Notion Integration Token (ntn_...)
//   NOTION_DB_ID        — Notion Datenbank-ID
//   HABITS_DATA_DIR     — optional, Ordner von habits.json (Default: ./data)

import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const DATA_DIR = process.env.HABITS_DATA_DIR ?? path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "habits.json");

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
interface Habit {
  id: string;
  name: string;
  emoji?: string;
  unit?: string;
  habitType?: string;
  numTarget?: number;
}
interface DayData {
  checked?: string[];
  numeric?: Record<string, number>;
  mood?: number | null;
  dynamicTargets?: Record<string, number>;
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
      // Nur SD-Zahl — kein Checkbox, keine Aufschlüsselung
      const c = colName(h, "(SD)");
      needed[c] = "number";
      const val = numeric[hid];
      if (val) props[c] = { number: Math.round(val * 100) / 100 };
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

// ── Route ───────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  if (!NOTION_TOKEN || !NOTION_DB_ID) {
    return NextResponse.json(
      { error: "NOTION_HABITS_TOKEN / NOTION_DB_ID nicht konfiguriert (.env.local)" },
      { status: 500 },
    );
  }

  let body: { date?: string; all?: boolean };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (!existsSync(DATA_FILE)) {
    return NextResponse.json({ error: "habits.json nicht gefunden" }, { status: 404 });
  }

  let habits: Habit[];
  let history: Record<string, DayData>;
  try {
    const parsed = JSON.parse(await readFile(DATA_FILE, "utf-8"));
    habits = parsed.habits ?? [];
    history = parsed.history ?? {};
  } catch (e) {
    return NextResponse.json({ error: `habits.json unlesbar: ${String(e)}` }, { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const dates = body.all ? Object.keys(history).sort() : [body.date ?? today];

  try {
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

    if (errors.length && ok === 0) {
      return NextResponse.json({ error: errors.slice(0, 3).join(" | ") }, { status: 502 });
    }
    return NextResponse.json({ ok: true, synced: ok, errors: errors.slice(0, 3) });
  } catch (e) {
    return NextResponse.json({ error: `Notion-Sync fehlgeschlagen: ${String(e)}` }, { status: 502 });
  }
}
