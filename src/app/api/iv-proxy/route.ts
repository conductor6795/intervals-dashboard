import { NextRequest, NextResponse } from "next/server";

/**
 * Server-seitiger Proxy für die intervals.icu API.
 * Umgeht CORS-Blockade im Browser.
 *
 * Aufruf: GET /api/iv-proxy?path=%2Fathlete%2Fi12345%2Factivities%3Foldest%3D...
 * Header: x-iv-key: <api-key>
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path    = searchParams.get("path");
  const apiKey  = request.headers.get("x-iv-key");

  if (!path || !apiKey) {
    return NextResponse.json({ error: "Missing path or x-iv-key header" }, { status: 400 });
  }

  const url = `https://intervals.icu/api/v1${path}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: "Basic " + Buffer.from(`API_KEY:${apiKey}`).toString("base64"),
        "Content-Type": "application/json",
      },
      // Kein Cache — immer aktuelle Daten
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `intervals.icu API: HTTP ${res.status}`, detail: text },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Proxy fetch failed", detail: String(err) },
      { status: 502 }
    );
  }
}
