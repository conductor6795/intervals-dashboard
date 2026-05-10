export interface WellnessDay {
  id: string; // YYYY-MM-DD
  ctl?: number;
  atl?: number;
  rampRate?: number;
  ctlLoad?: number;
  atlLoad?: number;
  strain?: number;    // intervals.icu täglicher Trainingsbelastungswert (falls vorhanden)
  hrv?: number;
  hrv4t?: number;
  restingHR?: number;
  weight?: number;
  sleepSecs?: number;
  sleepScore?: number;
  sleepQuality?: number;
  spO2Average?: number;
  readiness?: number;
  fatigue?: number;   // 1-5, 1=sehr leicht, 5=extrem
  stress?: number;    // 1-5
  soreness?: number;  // 1-5
  mood?: number;      // 1-5, 1=sehr schlecht, 5=sehr gut
  motivation?: number; // 1-5
  injury?: number;
}

export interface Activity {
  id: string;
  start_date_local: string;
  type: string;
  name: string;
  moving_time?: number;
  elapsed_time?: number;
  distance?: number;
  total_elevation_gain?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  icu_training_load?: number;
  icu_intensity?: number;
  average_watts?: number;
  max_watts?: number;
  description?: string;
  race?: boolean;
  commute?: boolean;
}

export interface IntervalsEvent {
  id: string | number;
  start_date_local: string;
  name: string;
  type?: string;
  description?: string;
  color?: string;
  category?: string;
  load?: number; // geplanter TSS
}

export interface AthleteData {
  name?: string;
  sex?: string;
  weight?: number;
  // FTP – intervals.icu nutzt verschiedene Felder je nach Version
  ftp?: number;
  threshold_power?: number;
  // LTHR
  lt_hr?: number;
  lthr?: number;
  // Max HR
  max_hr?: number;
  maxHr?: number;
  // Resting HR
  rest_hr?: number;
  resting_hr?: number;
  restingHr?: number;
  // VO2max (von Garmin/Wahoo synchronisiert)
  vo2max?: number;
  // Index-Signatur für alle weiteren API-Felder
  [key: string]: unknown;
}

export interface ProRace {
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD (same as start for 1-day races)
  category: "WT" | "WT-Stage" | "Monument" | "GrandTour";
  country?: string;
}

export type CVZone = "green" | "yellow" | "orange" | "red";

export interface CalculatedMetrics {
  hrv7: number | null;
  cv: number | null;
  trendRatio: number | null;
  trainingReadiness: number;
  recoveryScore: number;
  cvZone: CVZone;
  cvZoneLabel: string;
  cvZoneAdvice: string;
}

export interface DayMetrics {
  date: string;
  hrv7: number | null;
  cv: number | null;
  trendRatio: number | null;
}
