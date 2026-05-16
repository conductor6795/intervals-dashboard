import { NextResponse } from "next/server";

const BASE = "https://intervals.icu/api/v1/athlete";

function authHeader() {
  const key = process.env.INTERVALS_API_KEY ?? "";
  return "Basic " + Buffer.from(`API_KEY:${key}`).toString("base64");
}

export async function GET() {
  const athleteId = process.env.INTERVALS_ATHLETE_ID;
  if (!athleteId) return NextResponse.json({ error: "no athlete id" }, { status: 500 });

  const hdrs = { Authorization: authHeader() };

  const urls = [
    `${BASE}/${athleteId}/power_zones?weeks=0`,
    `${BASE}/${athleteId}/hr_zones?weeks=0`,
    `${BASE}/${athleteId}/power_zones`,
    `${BASE}/${athleteId}/hr_zones`,
  ];

  const results: Record<string, unknown> = {};
  for (const url of urls) {
    const key = url.replace(`${BASE}/${athleteId}/`, "");
    try {
      const res = await fetch(url, { headers: hdrs, cache: "no-store" });
      results[key] = { status: res.status, body: res.ok ? await res.json() : await res.text() };
    } catch (e) {
      results[key] = { error: String(e) };
    }
  }

  return NextResponse.json(results);
}
