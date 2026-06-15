// src/app/api/wellness-sync/route.ts
//
// Serverseitiger Wellness-Sync zu intervals.icu.
// Wird vom Habit-Tracker (doSync) aufgerufen, statt direkt aus dem Browser –
// das umgeht Browser-CORS und nutzt denselben INTERVALS_API_KEY aus .env.local
// wie das übrige Dashboard.
//
// Request-Body: { "date": "2026-06-15", "payload": { ...Wellness-Felder... } }

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const athleteId = process.env.INTERVALS_ATHLETE_ID;
  const apiKey = process.env.INTERVALS_API_KEY;

  if (!athleteId || !apiKey) {
    return NextResponse.json(
      { error: "INTERVALS_ATHLETE_ID / INTERVALS_API_KEY nicht konfiguriert (.env.local)" },
      { status: 500 },
    );
  }

  let body: { date?: string; payload?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }

  const { date, payload } = body;
  if (!date || !payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Felder 'date' und 'payload' erforderlich" }, { status: 400 });
  }

  // intervals.icu: Basic-Auth mit Benutzername "API_KEY" und dem Key als Passwort.
  const auth = "Basic " + Buffer.from(`API_KEY:${apiKey}`).toString("base64");

  try {
    const res = await fetch(
      `https://intervals.icu/api/v1/athlete/${athleteId}/wellness/${date}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: auth },
        body: JSON.stringify(payload),
        cache: "no-store",
      },
    );

    const text = await res.text();
    if (!res.ok) {
      // intervals-Fehlertext durchreichen, damit er im Habit-UI sichtbar wird
      return NextResponse.json(
        { error: `intervals.icu ${res.status}: ${text.slice(0, 300)}` },
        { status: res.status },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: `Netzwerkfehler: ${String(e)}` }, { status: 502 });
  }
}
