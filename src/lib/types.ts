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

export interface ZoneTime {
  id: string;   // "Z1", "Z2", … "SS"
  secs: number;
}

export interface Activity {
  id: string;
  start_date_local: string;
  type: string;
  name: string;
  moving_time?: number;
  elapsed_time?: number;
  coasting_time?: number;
  distance?: number;
  total_elevation_gain?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_speed?: number;      // m/s
  max_speed?: number;          // m/s
  average_cadence?: number;
  average_temp?: number;
  calories?: number;
  carbs_used?: number;
  // Training load
  icu_training_load?: number;
  power_load?: number;
  hr_load?: number;
  strain_score?: number;
  // Intensity – Intervals gives 0–100 (= IF * 100)
  icu_intensity?: number;
  // Power
  average_watts?: number;
  icu_average_watts?: number;
  max_watts?: number;
  icu_weighted_avg_watts?: number;   // NP from Intervals (primary)
  // Ratios
  icu_efficiency_factor?: number;    // NP / avgHR
  icu_variability_index?: number;    // NP / AP
  icu_power_hr?: number;             // AP / avgHR
  polarization_index?: number;
  decoupling?: number;               // aerobic decoupling %
  // Zone distributions
  icu_zone_times?: ZoneTime[];
  icu_hr_zone_times?: number[];      // seconds in each HR zone [Z1…Z5]
  // FTP at time
  icu_ftp?: number;
  // Flags
  description?: string;
  race?: boolean;
  commute?: boolean;
  sub_type?: string;
  // GPS / map
  start_latlng?: [number, number];
  map?: { summary_polyline?: string; polyline?: string };
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

export interface ZoneEntry {
  id: number;
  name: string;
  min: number | null;
  max: number | null;
  fromPct?: number | null;
  toPct?: number | null;
  color?: string;
}

export interface AthleteProfile {
  ftp: number | null;
  lthr: number | null;
  weight: number | null;
  vo2max: number | null;
  powerZones: ZoneEntry[];
  hrZones: ZoneEntry[];
  sportTypes: string[];
}

export type CVZone = "green" | "yellow" | "orange" | "red";

export interface CalculatedMetrics {
  hrv7: number | null;
  hrvPct: number | null;     // rollender 28-Tage-Perzentil (Hauptsignal Langzeittrend)
  cv: number | null;
  trendRatio: number | null;
  tsb: number | null;        // Training Stress Balance (CTL − ATL), für Anzeige im Dashboard
  trainingReadiness: number;
  recoveryScore: number;
  cvZone: CVZone;
  cvZoneLabel: string;
  cvZoneAdvice: string;
  hrvFloorFlag: boolean;      // Absolut-Trend-Floor: hrv7 > 12 % unter 60-Tage-Mittel (Drift-Banner)
  hardTriggers: string[];     // aktive Sofort-Deload-Trigger (Spec §4), leer = keiner
}

export interface DayMetrics {
  date: string;
  hrv7: number | null;
  cv: number | null;
  trendRatio: number | null;
}
