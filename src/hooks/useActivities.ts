"use client";
import { useState, useEffect, useCallback } from "react";
import { Activity, IntervalsEvent } from "@/lib/types";

export function useActivities(days = 60) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const oldest = getDateDaysAgo(days);
      const res = await fetch(`/api/activities?oldest=${oldest}`);
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      const json: Activity[] = await res.json();
      setActivities(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { activities, loading, error, refetch: fetchData };
}

export function useEvents() {
  const [events, setEvents] = useState<IntervalsEvent[]>([]);
  const [athleteId, setAthleteId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/events");
        if (!res.ok) return;
        const json = await res.json();
        setEvents(json.events ?? json);
        if (json.athleteId) setAthleteId(json.athleteId);
      } catch {
        setError("Events konnten nicht geladen werden");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { events, athleteId, loading, error };
}

function getDateDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
