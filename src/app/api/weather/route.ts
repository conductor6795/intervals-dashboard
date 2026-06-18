import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Coesfeld — gleiche Koordinaten wie im Tagescheck-Skill. Open-Meteo, kein API-Key.
const LAT = 51.9443;
const LON = 7.168;
const NAME = "Coesfeld";

export async function GET() {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&current=temperature_2m,precipitation,weather_code,wind_speed_10m` +
    `&hourly=temperature_2m&forecast_days=1&timezone=Europe%2FBerlin`;

  try {
    const res = await fetch(url, { next: { revalidate: 1800 } }); // 30 min Cache
    if (!res.ok) {
      return NextResponse.json({ error: `Open-Meteo ${res.status}` }, { status: res.status });
    }
    const d = await res.json();
    const temps: number[] = d.hourly?.temperature_2m ?? [];
    const dayTemps = temps.slice(6, 20); // 06:00–20:00 Uhr (wie im Skill)
    const tempMax = dayTemps.length ? Math.round(Math.max(...dayTemps) * 10) / 10 : null;
    const tempMin = dayTemps.length ? Math.round(Math.min(...dayTemps) * 10) / 10 : null;

    return NextResponse.json({
      name: NAME,
      tempNow: d.current?.temperature_2m ?? null,
      tempMax,
      tempMin,
      precip: d.current?.precipitation ?? null,
      wind: d.current?.wind_speed_10m ?? null,
      code: d.current?.weather_code ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
