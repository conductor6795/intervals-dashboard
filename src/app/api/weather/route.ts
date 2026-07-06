import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Coesfeld — gleiche Koordinaten wie im Tagescheck-Skill. Open-Meteo, kein API-Key.
const LAT = 51.9443;
const LON = 7.168;
const NAME = "Coesfeld";

export async function GET() {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m` +
    `&hourly=temperature_2m,weather_code,precipitation_probability` +
    `&forecast_days=2&timezone=Europe%2FBerlin`;

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

    // Stündliche Vorschau ab der AKTUELLEN Stunde (Europe/Berlin), in 2-h-Schritten.
    // Berlin-Stunde serverunabhängig via Intl bestimmen (nicht new Date().getHours(),
    // das läuft in der Container-Zeitzone und wäre um den UTC-Offset verschoben).
    const times: string[] = d.hourly?.time ?? [];
    const codes: number[] = d.hourly?.weather_code ?? [];
    const pops: number[] = d.hourly?.precipitation_probability ?? [];
    const berlinNow = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(new Date()).replace(" ", "T").slice(0, 13); // "YYYY-MM-DDTHH"
    let startIdx = times.findIndex((t) => t.slice(0, 13) >= berlinNow);
    if (startIdx < 0) startIdx = 0;
    const hourly: { time: string; temp: number | null; code: number | null; pop: number | null }[] = [];
    for (let i = startIdx; i < times.length && hourly.length < 5; i += 2) {
      hourly.push({
        time: times[i].slice(11, 16),
        temp: temps[i] != null ? Math.round(temps[i]) : null,
        code: codes[i] ?? null,
        pop: pops[i] ?? null,
      });
    }

    return NextResponse.json({
      name: NAME,
      tempNow: d.current?.temperature_2m ?? null,
      feelsLike: d.current?.apparent_temperature ?? null,
      humidity: d.current?.relative_humidity_2m ?? null,
      tempMax,
      tempMin,
      precip: d.current?.precipitation ?? null,
      wind: d.current?.wind_speed_10m ?? null,
      code: d.current?.weather_code ?? null,
      hourly,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
