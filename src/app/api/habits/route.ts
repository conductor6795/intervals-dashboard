import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// Verhindert Next.js-Caching des GET-Response → Handy bekommt immer aktuellen Stand
export const dynamic = "force-dynamic";

// Speicherpfad: /app/data/habits.json im Container
// → via docker-compose Volume persistent auf dem Host
const DATA_DIR  = process.env.HABITS_DATA_DIR ?? path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "habits.json");

// CORS-Header für externe Aufrufe (z.B. Claude Artifacts)
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

async function ensureDir() {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
}

// Prüft ob der Token im Query-Parameter mit dem Env-Wert übereinstimmt
function isAuthorized(req: NextRequest): boolean {
  const token = req.nextUrl.searchParams.get("token");
  const expected = process.env.HABITS_READ_TOKEN;
  if (!expected) return false;           // Kein Token konfiguriert → Zugriff verweigert
  return token === expected;
}

// Preflight-Request für CORS (Browser schickt das vor dem eigentlichen GET)
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET: öffentlich lesbar, aber nur mit gültigem Token
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }
  try {
    await ensureDir();
    if (!existsSync(DATA_FILE)) return NextResponse.json({}, { headers: CORS_HEADERS });
    const raw = await readFile(DATA_FILE, "utf-8");
    return NextResponse.json(JSON.parse(raw), { headers: CORS_HEADERS });
  } catch {
    return NextResponse.json({}, { status: 500, headers: CORS_HEADERS });
  }
}

// POST: kein Token nötig — nur intern vom Dashboard erreichbar (kein CORS)
export async function POST(req: NextRequest) {
  try {
    await ensureDir();
    const body = await req.json();
    await writeFile(DATA_FILE, JSON.stringify(body), "utf-8");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "write failed" }, { status: 500 });
  }
}
