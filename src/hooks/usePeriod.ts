"use client";
import { useState } from "react";

export type Period = "7d" | "30d" | "3m" | "6m" | "ytd" | "1y" | "all";

export const PERIODS: Period[] = ["7d", "30d", "3m", "6m", "ytd", "1y", "all"];

export const PERIOD_LABELS: Record<Period, string> = {
  "7d":  "7T",
  "30d": "30T",
  "3m":  "3M",
  "6m":  "6M",
  "ytd": new Date().getFullYear().toString(), // "2025", "2026", …
  "1y":  "1J",
  "all": "Alle",
};

export function periodToDays(period: Period): number {
  // YTD: full days elapsed since Jan 1 of the current year
  if (period === "ytd") {
    const now  = new Date();
    const jan1 = new Date(now.getFullYear(), 0, 1);
    return Math.floor((now.getTime() - jan1.getTime()) / 86_400_000);
  }
  const map: Record<Exclude<Period, "ytd">, number> = {
    "7d":  7,
    "30d": 30,
    "3m":  90,
    "6m":  180,
    "1y":  365,
    "all": 1825,
  };
  return map[period];
}

export function usePeriod(initial: Period = "30d") {
  const [period, setPeriod] = useState<Period>(initial);
  return { period, setPeriod, days: periodToDays(period) };
}
