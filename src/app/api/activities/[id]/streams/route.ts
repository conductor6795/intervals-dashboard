import { NextRequest, NextResponse } from "next/server";

const BASE = "https://intervals.icu/api/v1/athlete";

function authHeader() {
  const key = process.env.INTERVALS_API_KEY ?? "";
  return "Basic " + Buffer.from(`API_KEY:${key}`).toString("base64");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const athleteId = process.env.INTERVALS_ATHLETE_ID;
  if (!athleteId) return NextResponse.json({ error: "Not configured" }, { status: 500 });

  const { id } = await params;

  try {
    const res = await fetch(
      `${BASE}/${athleteId}/activities/${id}/streams?` +
        `types=latlng,altitude,heartrate,distance,velocity_smooth,watts,cadence`,
      {
        headers: { Authorization: authHeader() },
        next: { revalidate: 3600 },
      }
    );
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `${res.status} ${text}` }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
