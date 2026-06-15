import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// Datenpfad — wird durch docker-compose Volume persistent gemacht:
// ./habits-data:/app/dataroot  →  DATA_DIR = /app/dataroot
const DATA_DIR  = process.env.HABITS_DATA_DIR ?? path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "habits.json");

// CORS für externe Aufrufe (Artifacts etc.)
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-token",
};

/* ── Auth-Check ─────────────────────────────────────────────────────────────
   Interne Aufrufe (vom Dashboard selbst, gleiche Origin) → immer erlaubt.
   Externe Aufrufe MIT Token → erlaubt wenn Token stimmt.
   Externe Aufrufe OHNE Token → 401.
   Wenn HABITS_READ_TOKEN nicht gesetzt → alle Aufrufe erlaubt (Entwicklung).
   ────────────────────────────────────────────────────────────────────────── */
function isAuthorized(req: NextRequest): boolean {
  const expectedToken = process.env.HABITS_READ_TOKEN;

  // Kein Token konfiguriert → offen (Entwicklung / reines Heimnetz)
  if (!expectedToken) return true;

  // Interner Aufruf: gleiche Origin oder kein Origin-Header (server-side)
  const origin  = req.headers.get("origin")  ?? "";
  const referer = req.headers.get("referer") ?? "";
  const host    = req.headers.get("host")    ?? "";
  if (!origin || origin.includes(host) || referer.includes(host)) return true;

  // Externer Aufruf: Token in Header oder Query-Param prüfen
  const headerToken = req.headers.get("x-token") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  const queryToken  = new URL(req.url).searchParams.get("token");
  return headerToken === expectedToken || queryToken === expectedToken;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });
  }
  try {
    if (!existsSync(DATA_FILE)) return NextResponse.json({}, { headers: CORS });
    const raw  = await readFile(DATA_FILE, "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json(data, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS });
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });
  }
  try {
    const body = await req.json();
    if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
    await writeFile(DATA_FILE, JSON.stringify(body, null, 2), "utf-8");
    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS });
  }
}
