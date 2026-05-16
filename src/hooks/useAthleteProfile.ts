"use client";
import { useState, useEffect, useCallback } from "react";
import { AthleteProfile } from "@/lib/types";

const empty: AthleteProfile = {
  ftp: null, lthr: null, weight: null, vo2max: null,
  powerZones: [], hrZones: [], sportTypes: [],
};

export function useAthleteProfile(sportType = "Ride") {
  const [profile, setProfile] = useState<AthleteProfile>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/athlete-profile?type=${encodeURIComponent(sportType)}`);
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setProfile(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [sportType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { ...profile, loading, error, refetch: fetchData };
}
