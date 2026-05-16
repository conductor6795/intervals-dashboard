import { NextRequest, NextResponse } from "next/server";

const BASE = "https://intervals.icu/api/v1/athlete";

function authHeader() {
  const key = process.env.INTERVALS_API_KEY ?? "";
  return "Basic " + Buffer.from(`API_KEY:${key}`).toString("base64");
}

export async function GET(req: NextRequest) {
  const athleteId = process.env.INTERVALS_ATHLETE_ID;
  if (!athleteId) {
    return NextResponse.json({ error: "INTERVALS_ATHLETE_ID nicht konfiguriert" }, { status: 500 });
  }

  const { searchParams } = req.nextUrl;
  const oldest = searchParams.get("oldest") ?? getDateDaysAgo(30);
  const newest = searchParams.get("newest") ?? getDateDaysAhead(365);

  const url = `${BASE}/${athleteId}/events?oldest=${oldest}&newest=${newest}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: authHeader() },
      next: { revalidate: 600 },
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `intervals.icu: ${res.status} ${text}` }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json({ events: data, athleteId });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

function getDateDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function getDateDaysAhead(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
