"use client";
import { useState, useEffect } from "react";
import {
  Sun, Cloud, CloudSun, CloudRain, CloudDrizzle, CloudSnow,
  CloudLightning, CloudFog, Droplets, Wind,
} from "lucide-react";

interface Weather {
  name: string;
  tempNow: number | null;
  tempMax: number | null;
  tempMin: number | null;
  precip: number | null;
  wind: number | null;
  code: number | null;
}

// WMO-Wettercode → Icon + deutsches Label
function describe(code: number | null): { label: string; Icon: typeof Sun } {
  if (code == null) return { label: "–", Icon: Cloud };
  if (code === 0) return { label: "Klar", Icon: Sun };
  if (code <= 2) return { label: "Teils bewölkt", Icon: CloudSun };
  if (code === 3) return { label: "Bedeckt", Icon: Cloud };
  if (code <= 48) return { label: "Nebel", Icon: CloudFog };
  if (code <= 57) return { label: "Nieselregen", Icon: CloudDrizzle };
  if (code <= 67) return { label: "Regen", Icon: CloudRain };
  if (code <= 77) return { label: "Schnee", Icon: CloudSnow };
  if (code <= 82) return { label: "Schauer", Icon: CloudRain };
  if (code <= 86) return { label: "Schneeschauer", Icon: CloudSnow };
  return { label: "Gewitter", Icon: CloudLightning };
}

export default function WeatherCard() {
  const [w, setW] = useState<Weather | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/weather");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setW(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  if (error) {
    return (
      <div className="bg-dash-card border border-dash-border rounded-2xl p-4 text-xs text-dash-muted">
        Wetter nicht verfügbar.
      </div>
    );
  }
  if (!w) {
    return <div className="animate-pulse rounded-2xl bg-dash-card border border-dash-border h-[140px]" />;
  }

  const { label, Icon } = describe(w.code);

  return (
    <div className="bg-dash-card border border-dash-border rounded-2xl p-4 flex flex-col justify-between h-[140px]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-dash-muted uppercase tracking-wider font-medium">
          {w.name}
        </span>
        <Icon size={18} className="text-sky-400" />
      </div>

      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold tabular-nums leading-none text-white">
          {w.tempNow != null ? Math.round(w.tempNow) : "–"}
        </span>
        <span className="text-dash-muted text-sm pb-1">°C</span>
        <span className="text-xs text-dash-muted pb-1 ml-1">{label}</span>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-dash-muted">
        <span className="tabular-nums">
          {w.tempMin != null ? Math.round(w.tempMin) : "–"}° / {w.tempMax != null ? Math.round(w.tempMax) : "–"}°
        </span>
        <span className="flex items-center gap-1 tabular-nums">
          <Droplets size={11} /> {w.precip != null ? w.precip.toFixed(1) : "0"} mm
        </span>
        <span className="flex items-center gap-1 tabular-nums">
          <Wind size={11} /> {w.wind != null ? Math.round(w.wind) : "–"} km/h
        </span>
      </div>
    </div>
  );
}
