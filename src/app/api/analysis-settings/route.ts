import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// Eigener kleiner Store für die Analyse-Auswahl.
// Liegt im SELBEN Volume wie habits.json (./habits-data:/app/dataroot),
// aber in eigener Datei -> wird von der Habits-Seite niemals überschrieben.
const DATA_DIR  = process.env.HABITS_DATA_DIR ?? path.join(process.cwd(), "dataroot");
const DATA_FILE = path.join(DATA_DIR, "analysis-settings.json");

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Gespeichert wird eine Ausschluss-Liste: nur explizit ausgeblendete Habit-IDs.
// Alles, was nicht drinsteht (inkl. neuer Habits), ist in der Analyse sichtbar.
interface AnalysisSettings { hidden: string[] }
const DEFAULTS: AnalysisSettings = { hidden: [] };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET() {
  try {
    if (!existsSync(DATA_FILE)) return NextResponse.json(DEFAULTS, { headers: CORS });
    const raw = await readFile(DATA_FILE, "utf-8");
    const data = JSON.parse(raw);
    const hidden = Array.isArray(data?.hidden) ? data.hidden.filter((x: unknown) => typeof x === "string") : [];
    return NextResponse.json({ hidden }, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ error: String(e), hidden: [] }, { status: 500, headers: CORS });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const hidden = Array.isArray(body?.hidden) ? body.hidden.filter((x: unknown) => typeof x === "string") : [];
    if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
    await writeFile(DATA_FILE, JSON.stringify({ hidden }, null, 2), "utf-8");
    return NextResponse.json({ ok: true, hidden }, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS });
  }
}
