// src/app/api/auto-sync/route.ts
//
// Manueller Trigger für den automatischen Nacht-Sync (siehe src/lib/autoSync.ts
// + src/instrumentation.ts, die diese Logik täglich um 05:00 anstoßen).
// Nützlich zum Testen ohne bis 05:00 zu warten:
//
//   curl -X POST http://localhost:3003/api/auto-sync
//   curl -X POST http://localhost:3003/api/auto-sync -d '{"date":"2026-07-17"}'

import { NextResponse } from "next/server";
import { runAutoSync } from "@/lib/autoSync";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { date?: string; dates?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    // kein Body → Standard-Zieltage (gestern + heute)
  }
  const dates = body.dates ?? (body.date ? [body.date] : undefined);
  const results = await runAutoSync(dates);
  return NextResponse.json({ ok: true, results });
}

export async function GET() {
  const results = await runAutoSync();
  return NextResponse.json({ ok: true, results });
}
