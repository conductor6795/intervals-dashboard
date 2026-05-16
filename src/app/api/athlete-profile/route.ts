import { NextRequest, NextResponse } from "next/server";
import { ZoneEntry } from "@/lib/types";

const BASE = "https://intervals.icu/api/v1/athlete";

function authHeader() {
  const key = process.env.INTERVALS_API_KEY ?? "";
  return "Basic " + Buffer.from(`API_KEY:${key}`).toString("base64");
}

type RawZone = Record<string, unknown>;

type SportSetting = {
  types?: string[];
  type?: string;
  ftp?: number | null;
  indoor_ftp?: number | null;
  lthr?: number | null;
  vo2max?: number | null;
  power_zones?: RawZone[] | number[];
  hr_zones?: RawZone[] | number[];
  [k: string]: unknown;
};

function positiveNum(v: unknown): number | null {
  if (typeof v === "number" && v > 0) return v;
  return null;
}

/**
 * Zones kommen in zwei Formaten aus der API:
 * 1. Array von Objekten: [{ id, name, min, max, ... }, ...]
 * 2. Array von Prozentwerten (obere Grenzen): [55, 75, 90, 105, 120, 150]
 */
function normalizeZones(
  raw: RawZone[] | number[] | undefined | null,
  anchor: number | null, // FTP (für Watt) oder LTHR (für bpm)
  isPower: boolean,
): ZoneEntry[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const ZONE_COLORS = ["#22c55e", "#3b82f6", "#eab308", "#f97316", "#ef4444", "#a855f7"];
  const ZONE_NAMES  = ["Z1", "Z2", "Z3", "Z4", "Z5", "Z6", "Z7"];

  // Format 2: Array von Zahlen
  // Power-Zonen: Prozentwerte (z.B. [54, 71, 93, 100]) → mit FTP multiplizieren
  // HF-Zonen:    absolute bpm-Werte (z.B. [139, 160, 172, 185]) → direkt verwenden
  if (typeof raw[0] === "number") {
    const nums = raw as number[];
    const isAbsoluteBpm = !isPower && nums.some((n) => n > 60);
    const lastIdx = nums.length - 1;
    return nums.map((upper, i) => {
      const lower = i === 0 ? 0 : nums[i - 1];
      let minVal: number | null;
      let maxVal: number | null;
      let fromPct: number | null = null;
      let toPct: number | null   = null;

      if (isAbsoluteBpm) {
        minVal  = lower;
        // Letzte Zone: kein sinnvoller oberer Grenzwert → null
        maxVal  = i === lastIdx ? null : upper;
        // Bereich als % von LTHR berechnen (für Anzeige in "Bereich"-Spalte)
        if (anchor) {
          fromPct = Math.round((lower / anchor) * 100);
          toPct   = i === lastIdx ? null : Math.round((upper / anchor) * 100);
        }
      } else {
        minVal  = anchor ? Math.round((lower / 100) * anchor) : null;
        // Letzte Zone: Sentinel-Werte (>= 200%) abfangen
        maxVal  = (i === lastIdx || upper >= 200)
          ? null
          : anchor ? Math.round((upper / 100) * anchor) : null;
        fromPct = lower;
        toPct   = (i === lastIdx || upper >= 200) ? null : upper;
      }

      return {
        id: i + 1,
        name: ZONE_NAMES[i] ?? `Z${i + 1}`,
        min: minVal,
        max: maxVal,
        fromPct,
        toPct,
        color: ZONE_COLORS[i],
      } satisfies ZoneEntry;
    });
  }

  // Format 1: Array von Objekten
  const isLastIdx = (raw as RawZone[]).length - 1;
  return (raw as RawZone[]).map((z, i) => {
    const minRaw = z.min_watts ?? z.min_bpm ?? z.min;
    const maxRaw = z.max_watts ?? z.max_bpm ?? z.max;
    const fromPctRaw = z.from_ftp_pct ?? z.from_lthr_pct ?? z.from_pct;
    const toPctRaw   = z.to_ftp_pct   ?? z.to_lthr_pct   ?? z.to_pct;

    let minVal: number | null = minRaw != null ? Number(minRaw) : null;
    let maxVal: number | null = maxRaw != null ? Number(maxRaw) : null;

    // Sentinel-Werte abfangen (letzte Zone hat oft 9999 oder ähnlich)
    const isSentinelMax = maxVal != null && (
      (isPower  && anchor && maxVal > anchor * 4) ||
      (!isPower && maxVal > 250)
    );
    if (i === isLastIdx || isSentinelMax) maxVal = null;

    // Absolutwerte aus Prozentwerten berechnen wenn nötig
    if (anchor && fromPctRaw != null && minVal == null)
      minVal = Math.round((Number(fromPctRaw) / 100) * anchor);
    if (anchor && toPctRaw != null && maxVal == null && i !== isLastIdx)
      maxVal = Math.round((Number(toPctRaw) / 100) * anchor);

    // Prozentwerte: für Power aus Feld, für HR aus bpm÷LTHR berechnen
    let fromPct: number | null = fromPctRaw != null ? Number(fromPctRaw) : null;
    let toPct:   number | null = (toPctRaw   != null && i !== isLastIdx) ? Number(toPctRaw) : null;
    if (!isPower && anchor) {
      if (fromPct == null && minVal != null) fromPct = Math.round((minVal / anchor) * 100);
      if (toPct   == null && maxVal != null) toPct   = Math.round((maxVal / anchor) * 100);
    }

    return {
      id: z.id != null ? Number(z.id) : i + 1,
      name: String(z.name ?? ZONE_NAMES[i] ?? `Z${i + 1}`),
      min: minVal,
      max: maxVal,
      fromPct,
      toPct,
      color: z.color && z.color !== "#000000" && z.color !== ""
        ? String(z.color)
        : ZONE_COLORS[i],
    } satisfies ZoneEntry;
  });
}

function today()        { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const athleteId = process.env.INTERVALS_ATHLETE_ID;
  if (!athleteId) {
    return NextResponse.json({ error: "INTERVALS_ATHLETE_ID nicht konfiguriert" }, { status: 500 });
  }

  const sportType = req.nextUrl.searchParams.get("type") ?? "Ride";
  const hdrs      = { Authorization: authHeader() };

  try {
    // Nur zwei Calls: Athletenprofil + Wellness (für VO2max-Fallback)
    const [profileRes, wellnessRes] = await Promise.all([
      fetch(`${BASE}/${athleteId}`, {
        headers: hdrs,
        next: { revalidate: 3600 },
      }),
      fetch(`${BASE}/${athleteId}/wellness?oldest=${daysAgo(60)}&newest=${today()}`, {
        headers: hdrs,
        next: { revalidate: 300 },
      }),
    ]);

    if (!profileRes.ok) {
      const text = await profileRes.text();
      return NextResponse.json(
        { error: `intervals.icu API Fehler ${profileRes.status}: ${text.slice(0, 200)}` },
        { status: profileRes.status },
      );
    }

    const profile: Record<string, unknown> = await profileRes.json();
    const wellness: Record<string, unknown>[] = wellnessRes.ok
      ? await wellnessRes.json()
      : [];

    // ── Sport-Settings finden ────────────────────────────────────────────────
    // sportSettings ist ein Array, jedes Element hat ein `types`-Array
    // z. B. { types: ["Ride", "VirtualRide"], ftp: 280, lthr: 172, ... }
    const allSettings: SportSetting[] = Array.isArray(profile.sportSettings)
      ? (profile.sportSettings as SportSetting[])
      : [];

    const sportSetting: SportSetting =
      // Exakter Match auf sportType
      allSettings.find((s) => s.types?.includes(sportType)) ??
      // Fallback: einzelnes `type`-Feld (älteres API-Format)
      allSettings.find((s) => s.type === sportType) ??
      // Fallback: erstes Element
      allSettings[0] ??
      {};

    // ── Kernwerte ────────────────────────────────────────────────────────────
    const ftp    = positiveNum(sportSetting.ftp)    ?? positiveNum(sportSetting.indoor_ftp) ?? null;
    const lthr   = positiveNum(sportSetting.lthr)   ?? null;
    // Gewicht steht auf Top-Level des Profils (kg)
    const weight = positiveNum(profile.weight as unknown) ?? null;

    // ── VO2max ───────────────────────────────────────────────────────────────
    // Reihenfolge: sportSettings → Top-Level Profil → letzter Wellness-Eintrag
    let vo2max: number | null =
      positiveNum(sportSetting.vo2max) ??
      positiveNum((profile as Record<string, unknown>).vo2max) ??
      null;

    if (vo2max == null && Array.isArray(wellness)) {
      for (let i = wellness.length - 1; i >= 0; i--) {
        const v = wellness[i]?.vo2max;
        if (v != null && Number(v) > 0) { vo2max = Number(v); break; }
      }
    }

    // ── Zonen ────────────────────────────────────────────────────────────────
    const powerZones = normalizeZones(
      sportSetting.power_zones as RawZone[] | number[] | undefined,
      ftp,
      true,
    );
    const hrZones = normalizeZones(
      sportSetting.hr_zones as RawZone[] | number[] | undefined,
      lthr,
      false,
    );

    // Alle verfügbaren Sport-Typen für den Switcher im Frontend
    const sportTypes = allSettings.flatMap((s) => s.types ?? (s.type ? [s.type] : []));

    return NextResponse.json({
      ftp,
      lthr,
      weight,
      vo2max,
      powerZones,
      hrZones,
      sportTypes: [...new Set(sportTypes)],
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
