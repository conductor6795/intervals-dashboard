"use client";
import { useState, useEffect, useCallback } from "react";

export interface GarminDay {
  date: string;
  bbHigh: number | null;
  bbLow: number | null;
  bbRecent: number | null;
  stressAvg: number | null;
  stressMax: number | null;
  stressRestSecs: number | null;
  stressLowSecs: number | null;
  stressMediumSecs: number | null;
  stressHighSecs: number | null;
  sleepSecs: number | null;
  deepSecs: number | null;
  lightSecs: number | null;
  remSecs: number | null;
  awakeSecs: number | null;
  sleepScore: number | null;
  // ISO-Zeitstempel (lokale Uhrzeit): wann eingeschlafen / aufgewacht laut Garmin.
  // "Zu Bett gegangen" ist darüber NICHT direkt messbar (siehe garmin-sync.py) —
  // der Schlafcoach schätzt die Bettzeit aus sleepStartLocal ab.
  sleepStartLocal: string | null;
  sleepEndLocal: string | null;
  respirationAvg: number | null;
  respirationLow: number | null;
  respirationHigh: number | null;
  readinessScore: number | null;
  readinessLevel: string | null;
  trainingStatus: string | null;
  restingHr: number | null;
  acwr: number | null;
  acwrStatus: string | null;
  vo2maxCycling: number | null;
  vo2maxRunning: number | null;
}

/**
 * Liest die nightly von garmin-sync.py geschriebene garmin.json über /api/garmin.
 * Gibt die Tage als aufsteigend sortiertes Array zurück (ältester zuerst),
 * damit Sparklines direkt von links nach rechts laufen.
 */
export function useGarmin() {
  const [data, setData] = useState<GarminDay[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/garmin");
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      const days: Record<string, Omit<GarminDay, "date">> = json.days ?? {};
      const arr: GarminDay[] = Object.keys(days)
        .sort()
        .map((d) => ({ date: d, ...days[d] }));
      setData(arr);
      setLastSync(json.lastSync ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, lastSync, loading, error, refetch: fetchData };
}
