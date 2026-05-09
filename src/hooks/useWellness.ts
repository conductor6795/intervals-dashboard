"use client";
import { useState, useEffect, useCallback } from "react";
import { WellnessDay } from "@/lib/types";

export function useWellness(days = 90) {
  const [data, setData] = useState<WellnessDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const oldest = getDateDaysAgo(days);
      const res = await fetch(`/api/wellness?oldest=${oldest}`);
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      const json: WellnessDay[] = await res.json();
      // Sortierung sicherstellen
      json.sort((a, b) => a.id.localeCompare(b.id));
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

function getDateDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
