"use client";
import { useState } from "react";
import { RefreshCw, Zap, Activity, Heart, Scale } from "lucide-react";
import { clsx } from "clsx";

import { useAthleteProfile } from "@/hooks/useAthleteProfile";
import { useWellness } from "@/hooks/useWellness";
import { ZoneEntry } from "@/lib/types";

// ── Typen ─────────────────────────────────────────────────────────────────────

type SportTab = "Ride" | "Run";

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function tsbLabel(tsb: number | null): string {
  if (tsb == null) return "–";
  if (tsb > 5)   return "Frisch";
  if (tsb < -10) return "Müde";
  return "Ausgeglichen";
}

const ZONE_COLORS: Record<number, string> = {
  1: "#22c55e",
  2: "#3b82f6",
  3: "#eab308",
  4: "#f97316",
  5: "#ef4444",
  6: "#a855f7",
};
function zoneColor(id: number, fallback?: string): string {
  return ZONE_COLORS[id] ?? fallback ?? "#94a3b8";
}

// ── Sub-Komponenten ───────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "animate-pulse rounded-2xl bg-dash-card border border-dash-border",
        className,
      )}
    />
  );
}

function MetricCard({
  label,
  value,
  unit,
  sub,
  color,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string;
  unit: string;
  sub?: string;
  color: string;
  icon: React.ElementType;
  loading?: boolean;
}) {
  if (loading) return <Skeleton className="h-[100px]" />;
  return (
    <div className="bg-dash-card border border-dash-border rounded-2xl p-4 flex flex-col justify-between min-h-[100px]">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium">
          {label}
        </p>
        <Icon size={14} className="text-dash-muted/50" />
      </div>
      <div>
        <div className="flex items-end gap-1">
          <span className={clsx("text-2xl font-bold tabular-nums leading-none", color)}>
            {value}
          </span>
          {value !== "–" && (
            <span className="text-dash-muted text-xs pb-0.5">{unit}</span>
          )}
        </div>
        {sub && (
          <p className="text-[10px] text-dash-muted/60 mt-0.5">{sub}</p>
        )}
      </div>
    </div>
  );
}

function ZoneTable({
  title,
  zones,
  unit,
  anchor,
  loading,
}: {
  title: string;
  zones: ZoneEntry[];
  unit: string;
  anchor?: number | null;  // FTP für Watt-Zonen, LTHR für HF-Zonen
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-[220px]" />;
  if (zones.length === 0) return null;

  return (
    <div className="bg-dash-card border border-dash-border rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-dash-border">
        <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium">
          {title}
        </p>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-dash-border">
            <th className="text-left px-5 py-2 text-dash-muted font-medium w-16">Zone</th>
            <th className="text-left px-5 py-2 text-dash-muted font-medium">Bereich</th>
            <th className="text-right px-5 py-2 text-dash-muted font-medium">{unit}</th>
          </tr>
        </thead>
        <tbody>
          {zones.map((z) => {
            const color = z.color ?? zoneColor(z.id);

            const rangeStr =
              z.min != null && z.max != null
                ? `${z.min} – ${z.max}`
                : z.min != null
                ? `> ${z.min}`
                : "–";

            // Prozentwerte: aus Zone-Daten ODER direkt aus bpm÷anchor berechnen
            const fromPct =
              z.fromPct != null
                ? z.fromPct
                : anchor && z.min != null
                ? Math.round((z.min / anchor) * 100)
                : null;
            const toPct =
              z.toPct != null
                ? z.toPct
                : anchor && z.max != null
                ? Math.round((z.max / anchor) * 100)
                : null;

            const pctStr =
              fromPct != null && toPct != null
                ? `${fromPct}–${toPct}%`
                : fromPct != null
                ? `> ${fromPct}%`
                : "–";

            return (
              <tr
                key={z.id}
                className="border-b border-dash-border/50 last:border-0 hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-5 py-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-1 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="font-medium text-white">{z.name}</span>
                  </div>
                </td>
                <td className="px-5 py-2.5 text-dash-muted">{pctStr}</td>
                <td className="px-5 py-2.5 text-right font-mono text-white/80">
                  {rangeStr}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Seite ─────────────────────────────────────────────────────────────────────

export default function LeistungPage() {
  const [sport, setSport] = useState<SportTab>("Ride");

  const {
    ftp, lthr, weight, vo2max,
    powerZones, hrZones,
    loading: profileLoading,
    error: profileError,
    refetch,
  } = useAthleteProfile(sport);

  // Wellness für CTL / TSB — 14 Tage damit sicher ein befüllter Eintrag dabei ist
  const { data: wellness, loading: wellnessLoading } = useWellness(14);
  const latestWellness = [...wellness]
    .reverse()
    .find((d) => d.ctl != null);

  const ctl = latestWellness?.ctl ?? null;

  // TSB = `form` in intervals.icu (= CTL − ATL)
  // Fallback: manuell aus CTL und ATL berechnen falls `form` fehlt
  const wellnessAny = latestWellness as (typeof latestWellness & Record<string, unknown>) | undefined;
  const tsbFromField =
    wellnessAny?.form ??
    (wellnessAny?.["icu_form"] as number | undefined) ??
    null;
  const tsbComputed =
    latestWellness?.ctl != null && latestWellness?.atl != null
      ? parseFloat((latestWellness.ctl - latestWellness.atl).toFixed(1))
      : null;
  const tsb: number | null =
    tsbFromField !== null && tsbFromField !== undefined
      ? Number(tsbFromField)
      : tsbComputed;

  // Gewicht: aus Athletenprofil (API route) ODER letzter Wellness-Eintrag als Fallback
  const profileWeight = weight;
  const wellnessWeight = [...wellness]
    .reverse()
    .find((d) => d.weight != null)?.weight ?? null;
  const displayWeight = profileWeight ?? wellnessWeight;

  const noParams = !profileLoading && ftp == null && lthr == null;
  const loading  = profileLoading || wellnessLoading;

  return (
    <>
      {/* ── Header ── */}
      <header className="sticky top-0 z-10 bg-dash-bg/95 backdrop-blur border-b border-dash-border px-3 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-sm font-semibold text-white">Leistungsdaten</h1>
          <p className="text-[10px] text-dash-muted">
            FTP, Zonen und aktuelle Trainingsform
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Sport-Switcher */}
          <div className="flex rounded-xl border border-dash-border overflow-hidden text-xs">
            {(["Ride", "Run"] as SportTab[]).map((s) => (
              <button
                key={s}
                onClick={() => setSport(s)}
                className={clsx(
                  "px-3 py-1.5 transition-colors",
                  sport === s
                    ? "bg-white/10 text-white"
                    : "text-dash-muted hover:text-white",
                )}
              >
                {s === "Ride" ? "Rad" : "Lauf"}
              </button>
            ))}
          </div>

          <button
            onClick={refetch}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-dash-border text-dash-muted hover:text-white hover:border-white/30 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      {/* ── Fehler-Banner ── */}
      {profileError && (
        <div className="mx-6 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          {profileError}
        </div>
      )}

      {/* ── Kein-Parameter-Hinweis ── */}
      {noParams && (
        <div className="mx-6 mt-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-400">
          <span className="font-semibold">Keine Leistungsparameter gefunden</span>
          <span className="text-yellow-400/70 ml-1">
            — Setze FTP und LTHR in intervals.icu → Einstellungen → Athletenprofil.
            VO2max wird von Garmin/Wahoo synchronisiert.
          </span>
        </div>
      )}

      <div className="p-3 sm:p-6 space-y-6 w-full">

        {/* ── LEISTUNGSPARAMETER ── */}
        <section>
          <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-3">
            Leistungsparameter
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard
              label="FTP"
              value={ftp != null ? String(ftp) : "–"}
              unit="W"
              color="text-yellow-400"
              icon={Zap}
              loading={profileLoading}
            />
            <MetricCard
              label="VO2MAX"
              value={vo2max != null ? vo2max.toFixed(1) : "–"}
              unit="ml/min/kg"
              sub="Gerät-Messung"
              color="text-cyan-400"
              icon={Activity}
              loading={profileLoading}
            />
            <MetricCard
              label="LTHR"
              value={lthr != null ? String(lthr) : "–"}
              unit="bpm"
              color="text-red-400"
              icon={Heart}
              loading={profileLoading}
            />
            <MetricCard
              label="Gewicht"
              value={displayWeight != null ? Number(displayWeight).toFixed(1) : "–"}
              unit="kg"
              color="text-purple-400"
              icon={Scale}
              loading={profileLoading}
            />
          </div>
        </section>

        {/* ── AKTUELLE FORM ── */}
        <section>
          <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-3">
            Aktuelle Form
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MetricCard
              label="CTL (Fitness)"
              value={ctl != null ? ctl.toFixed(1) : "–"}
              unit=""
              sub="42-Tage-EMA"
              color="text-blue-400"
              icon={Activity}
              loading={wellnessLoading}
            />
            <MetricCard
              label="TSB (Form)"
              value={tsb != null ? tsb.toFixed(1) : "–"}
              unit=""
              sub={tsb != null ? tsbLabel(tsb) : undefined}
              color={
                tsb == null      ? "text-dash-muted"
                  : tsb > 5     ? "text-green-400"
                  : tsb < -10   ? "text-orange-400"
                  : "text-yellow-400"
              }
              icon={Activity}
              loading={wellnessLoading}
            />
          </div>
        </section>

        {/* ── WATTZONEN ── */}
        {(profileLoading || powerZones.length > 0) && (
          <section>
            <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-3">
              Wattzonen
            </p>
            <ZoneTable
              title={`Leistungszonen · ${sport === "Ride" ? "Rad" : "Lauf"}`}
              zones={powerZones}
              unit="Watt"
              anchor={ftp}
              loading={profileLoading}
            />
          </section>
        )}

        {/* ── HF-ZONEN ── */}
        {(profileLoading || hrZones.length > 0) && (
          <section>
            <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-3">
              Herzfrequenzzonen
            </p>
            <ZoneTable
              title={`HF-Zonen · ${sport === "Ride" ? "Rad" : "Lauf"}`}
              zones={hrZones}
              unit="bpm"
              anchor={lthr}
              loading={profileLoading}
            />
          </section>
        )}

      </div>
    </>
  );
}
