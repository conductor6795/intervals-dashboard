import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// Gleiche Volume-Konvention wie /api/habits:
// docker-compose mountet ./habits-data:/app/data → DATA_DIR = /app/data
const DATA_DIR  = process.env.HABITS_DATA_DIR ?? path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "garmin.json");

// Form der Datei (von garmin-sync.py geschrieben):
// { lastSync: string, days: { "2026-06-17": { bbHigh, bbLow, bbRecent,
//   stressAvg, stressMax, sleepSecs, deepSecs, lightSecs, remSecs, awakeSecs,
//   sleepScore, readinessScore, readinessLevel, trainingStatus, restingHr } } }

export async function GET() {
  try {
    if (!existsSync(DATA_FILE)) {
      return NextResponse.json({ lastSync: null, days: {} });
    }
    const raw  = await readFile(DATA_FILE, "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
