"use client";
import { useState, useEffect } from "react";
import { AthleteData } from "@/lib/types";

export function useAthlete() {
  const [data, setData] = useState<AthleteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/athlete");
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error ?? `HTTP ${res.status}`);
        }
        setData(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { data, loading, error };
}
