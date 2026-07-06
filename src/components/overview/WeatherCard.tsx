"use client";
import { useState, useEffect } from "react";
import {
  Sun, Cloud, CloudSun, CloudRain, CloudDrizzle, CloudSnow,
  CloudLightning, CloudFog, Droplets, Wind, Thermometer,
} from "lucide-react";

interface HourPoint {
  time: string;
  temp: number | null;
  code: number | null;
  pop: number | null;
}

interface Weather {
  name: string;
  tempNow: number | null;
  feelsLike: number | null;
  humidity: number | null;
  tempMax: number | null;
  tempMin: number | null;
  precip: number | null;
  wind: number | null;
  code: number | null;
  hourly: HourPoint[];
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
      <div className="bg-dash-card border border-dash-border rounded-2xl p-4 text-xs text-dash-muted h-full min-h-[140px] flex items-center">
        Wetter nicht verfügbar.
      </div>
    );
  }
  if (!w) {
    return <div className="animate-pulse rounded-2xl bg-dash-card border border-dash-border h-full min-h-[140px]" />;
  }

  const { label, Icon } = describe(w.code);

  return (
    <div className="bg-dash-card border border-dash-border rounded-2xl p-4 flex flex-col justify-between h-full min-h-[140px] gap-3">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-dash-muted uppercase tracking-wider font-medium">
            {w.name}
          </span>
          <Icon size={18} className="text-sky-400" />
        </div>

        <div className="flex items-end gap-2 mt-1">
          <span className="text-3xl font-bold tabular-nums leading-none text-white">
            {w.tempNow != null ? Math.round(w.tempNow) : "–"}
          </span>
          <span className="text-dash-muted text-sm pb-1">°C</span>
          <span className="text-xs text-dash-muted pb-1 ml-1">{label}</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-dash-muted mt-2">
          {w.feelsLike != null && (
            <span className="flex items-center gap-1 tabular-nums">
              <Thermometer size={11} /> gefühlt {Math.round(w.feelsLike)}°
            </span>
          )}
          <span className="tabular-nums">
            {w.tempMin != null ? Math.round(w.tempMin) : "–"}° / {w.tempMax != null ? Math.round(w.tempMax) : "–"}°
          </span>
          {w.humidity != null && (
            <span className="flex items-center gap-1 tabular-nums">
              <Droplets size={11} /> {Math.round(w.humidity)} %
            </span>
          )}
          <span className="flex items-center gap-1 tabular-nums">
            <Wind size={11} /> {w.wind != null ? Math.round(w.wind) : "–"} km/h
          </span>
          {w.precip != null && w.precip > 0 && (
            <span className="flex items-center gap-1 tabular-nums text-sky-400">
              <CloudRain size={11} /> {w.precip.toFixed(1)} mm
            </span>
          )}
        </div>
      </div>

      {/* Stündliche Vorschau */}
      {w.hourly && w.hourly.length > 0 && (
        <div className="flex items-stretch justify-between gap-1 pt-2 border-t border-dash-border">
          {w.hourly.map((h) => {
            const { Icon: HIcon } = describe(h.code);
            return (
              <div key={h.time} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                <span className="text-[9px] text-dash-muted tabular-nums">{h.time}</span>
                <HIcon size={14} className="text-sky-400/80" />
                <span className="text-[11px] text-white font-medium tabular-nums">{h.temp != null ? `${h.temp}°` : "–"}</span>
                {h.pop != null && h.pop >= 20 && (
                  <span className="text-[8px] text-sky-400 tabular-nums leading-none">{h.pop}%</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
