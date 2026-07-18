// src/app/api/notion-sync/route.ts
//
// Serverseitiger Habits-Sync zu Notion ("🏃 Habits Tracker").
// Läuft on-demand beim "→ intervals.icu"-Sync (doSync) und zusätzlich
// automatisch jede Nacht um 05:00 (siehe src/instrumentation.ts + src/lib/autoSync.ts).
//
// Liest habits.json direkt von der Platte (gleiche DATA_FILE-Konvention wie
// /api/habits) und schiebt einen Tag (oder mit { all:true } die ganze Historie)
// als Upsert nach Notion. Die eigentliche Sync-Logik lebt in src/lib/notionSync.ts,
// damit der Nacht-Sync sie mitverwenden kann.
//
// Request-Body: { "date": "2026-06-15" }  oder  { "all": true }

import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { syncDatesToNotion, type Habit, type History } from "@/lib/notionSync";

export const dynamic = "force-dynamic";

const DATA_DIR = process.env.HABITS_DATA_DIR ?? path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "habits.json");

export async function POST(req: Request) {
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
  let history: History;
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
    const { ok, errors } = await syncDatesToNotion(habits, history, dates);
    if (errors.length && ok === 0) {
      return NextResponse.json({ error: errors.slice(0, 3).join(" | ") }, { status: 502 });
    }
    return NextResponse.json({ ok: true, synced: ok, errors: errors.slice(0, 3) });
  } catch (e) {
    return NextResponse.json({ error: `Notion-Sync fehlgeschlagen: ${String(e)}` }, { status: 502 });
  }
}
