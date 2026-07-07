"use client";

/* =============================================================================
 * Recovery-Analyse  ·  /analyse
 * -----------------------------------------------------------------------------
 * Verknüpft Habit-Daten (/api/habits) mit Wellness-Daten (useWellness) und
 * vergleicht je Habit "aktiv vs. inaktiv" gegen die Recovery-Metriken des
 * NÄCHSTEN Morgens (Lag +1: Abend-Verhalten -> Schlaf/HRV der Folgenacht).
 *
 * Auswahl: pro Habit ein-/ausblendbar. Gespeichert wird nur die Ausschluss-
 * Liste (/api/analysis-settings) -> neue Habits sind automatisch dabei.
 *
 * Darstellung: Effekt-Balken um die Null (rechts/grün = bessere Recovery,
 * links/rot = schlechtere, Länge = Effektstärke). Top-Signale oben.
 * Bewusst konservativ, n-of-1: Hypothesen, kein Beweis.
 * ============================================================================= */

import { useEffect, useMemo, useState } from "react";
import { useWellness } from "@/hooks/useWellness";
import { WellnessDay } from "@/lib/types";
import SleepAnalysis from "@/components/analyse/SleepAnalysis";

/* ── Schwellen (hier anpassbar) ───────────────────────────────────────────── */
const MIN_N = 10;            // Mindest-n pro Gruppe für eine Anzeige
const TSB_CONFOUND = 8;      // |ΔTSB| ab hier: Trainingslast-Warnung (pro Habit)
const LOOKBACK_DAYS = 180;   // geladenes Wellness-Fenster

/* ── Lokale Typen (spiegeln /api/habits) ───────────────────────────────────── */
interface Habit {
  id: string; name: string; emoji: string; color: string;
  habitType: "checkbox" | "numeric"; unit: string;
  numTarget: number; goalType: string; goalValue: number;
}
interface DayData {
  checked: string[];
  numeric: Record<string, number>;
  mood: number | null;
  drinks?: Record<string, Record<string, number>>;
}
type History = Record<string, DayData>;

/* ── Outcomes. `notable` = Δ, das als deutlich gilt (skaliert Balken + Ranking) */
interface OutcomeCfg {
  key: string; label: string; sub: string; unit: string;
  good: "high" | "low"; decimals: number; notable: number;
  transform?: (v: number) => number;
}
const OUTCOMES: OutcomeCfg[] = [
  { key: "hrv",        label: "HRV",          sub: "nächster Morgen", unit: " ms",  good: "high", decimals: 0, notable: 8 },
  { key: "restingHR",  label: "Ruhepuls",     sub: "nächster Morgen", unit: " bpm", good: "low",  decimals: 0, notable: 4 },
  { key: "sleepScore", label: "Schlaf-Score", sub: "Folgenacht",      unit: "",     good: "high", decimals: 0, notable: 8 },
  { key: "sleepSecs",  label: "Schlafdauer",  sub: "Folgenacht",      unit: " h",   good: "high", decimals: 1, notable: 0.6, transform: (v) => v / 3600 },
];

/* ── Helfer ────────────────────────────────────────────────────────────────── */
function numField(d: WellnessDay, k: string): number | null {
  const v = (d as unknown as Record<string, unknown>)[k];
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}
function tsbOf(d: WellnessDay): number | null {
  const c = numField(d, "ctl");
  const a = numField(d, "atl");
  return c != null && a != null ? c - a : null;
}
function shiftDate(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}
function habitDone(h: Habit, day: DayData): boolean {
  if (h.habitType === "checkbox") return day.checked.includes(h.id);
  const v = day.numeric?.[h.id];
  if (h.goalType === "max_per_days") return (v ?? 0) > 0.2; // konsumiert (0.1 = Alt-Marker)
  return (v ?? 0) >= (h.numTarget ?? 0);
}
function activeWord(h: Habit): string {
  if (h.habitType === "checkbox") return "erledigt";
  return h.goalType === "max_per_days" ? "konsumiert" : "Ziel erreicht";
}
function mean(a: number[]): number { return a.reduce((s, v) => s + v, 0) / a.length; }
function fmt(v: number | null, dec: number): string { return v == null ? "–" : v.toFixed(dec); }

/* ── Vertrauens-Stufe nach kleinerer Gruppe ────────────────────────────────── */
function tier(minN: number): { label: string; cls: string } | null {
  if (minN < MIN_N) return null;
  if (minN < 18) return { label: "sehr vorläufig", cls: "text-amber-400" };
  if (minN < 30) return { label: "vorläufig",      cls: "text-sky-400" };
  return { label: "erste Tendenz", cls: "text-emerald-400" };
}

/* ── Analyse ───────────────────────────────────────────────────────────────── */
interface OutcomeResult {
  cfg: OutcomeCfg;
  nDone: number; nNot: number;
  meanDone: number | null; meanNot: number | null;
}
interface HabitAnalysis {
  habit: Habit;
  active: number; rated: number; rate: number;
  constant: boolean;
  confound: boolean; tsbDone: number | null; tsbNot: number | null;
  outcomes: OutcomeResult[];
  topScore: number;
}

function derive(r: OutcomeResult) {
  const t = r.meanDone != null && r.meanNot != null ? tier(Math.min(r.nDone, r.nNot)) : null;
  if (!t || r.meanDone == null || r.meanNot == null) return { gated: true as const };
  const delta = r.meanDone - r.meanNot;
  const signedGood = r.cfg.good === "high" ? delta : -delta;
  const score = Math.abs(delta) / r.cfg.notable;
  const negligible = score < 0.2;
  const mag = Math.min(1, score);
  const barCls = negligible ? "bg-slate-500/60" : signedGood > 0 ? "bg-emerald-500" : "bg-rose-500";
  const txtCls = negligible ? "text-dash-muted" : signedGood > 0 ? "text-emerald-400" : "text-rose-400";
  return { gated: false as const, delta, signedGood, score, negligible, mag, barCls, txtCls, tierInfo: t };
}

function analyzeHabit(
  h: Habit, history: History, byDate: Record<string, WellnessDay>, lag: number,
): HabitAnalysis {
  const dates = Object.keys(history).filter((d) => byDate[shiftDate(d, lag)]);
  const active = dates.filter((d) => habitDone(h, history[d])).length;
  const rate = dates.length ? active / dates.length : 0;
  const constant = dates.length === 0 || rate <= 0.1 || rate >= 0.9;

  const tD: number[] = [], tN: number[] = [];
  for (const d of dates) {
    const t = tsbOf(byDate[shiftDate(d, lag)]);
    if (t != null) (habitDone(h, history[d]) ? tD : tN).push(t);
  }
  const tsbDone = tD.length ? mean(tD) : null;
  const tsbNot = tN.length ? mean(tN) : null;
  const confound = tsbDone != null && tsbNot != null && Math.abs(tsbDone - tsbNot) > TSB_CONFOUND;

  const outcomes: OutcomeResult[] = OUTCOMES.map((cfg) => {
    const dv: number[] = [], nv: number[] = [];
    for (const d of dates) {
      const w = byDate[shiftDate(d, lag)];
      let val = numField(w, cfg.key);
      if (val == null) continue;
      if (cfg.transform) val = cfg.transform(val);
      (habitDone(h, history[d]) ? dv : nv).push(val);
    }
    return {
      cfg, nDone: dv.length, nNot: nv.length,
      meanDone: dv.length ? mean(dv) : null,
      meanNot: nv.length ? mean(nv) : null,
    };
  });

  let topScore = 0;
  if (!confound) {
    for (const r of outcomes) {
      const dr = derive(r);
      if (!dr.gated && !dr.negligible && dr.score > topScore) topScore = dr.score;
    }
  }

  return { habit: h, active, rated: dates.length, rate, constant, confound, tsbDone, tsbNot, outcomes, topScore };
}

/* ── UI: Effekt-Balken um die Null ─────────────────────────────────────────── */
function EffectBar({ signedGood, mag, barCls }: { signedGood: number; mag: number; barCls: string }) {
  const right = signedGood > 0;
  return (
    <div className="relative h-1.5 w-full rounded-full bg-dash-border/40">
      <div className="absolute inset-y-0 left-1/2 w-px bg-dash-muted/40" />
      <div
        className={`absolute inset-y-0 ${barCls} rounded-full`}
        style={right ? { left: "50%", width: `${mag * 50}%` } : { right: "50%", width: `${mag * 50}%` }}
      />
    </div>
  );
}

/* ── UI: Outcome-Zeile (nur getierte) ──────────────────────────────────────── */
function OutcomeRow({ r }: { r: OutcomeResult }) {
  const dr = derive(r);
  if (dr.gated) return null;
  return (
    <div className="py-2.5 border-t border-dash-border/60">
      <div className="flex items-center gap-3">
        <div className="w-24 shrink-0">
          <div className="text-[12px] text-white leading-tight">{r.cfg.label}</div>
          <div className="text-[10px] text-dash-muted">{r.cfg.sub}</div>
        </div>
        <div className="flex-1 min-w-0"><EffectBar signedGood={dr.signedGood} mag={dr.mag} barCls={dr.barCls} /></div>
        <div className="w-24 text-right shrink-0">
          <div className={`text-[12px] font-medium tabular-nums ${dr.txtCls}`}>
            {dr.delta > 0 ? "+" : ""}{dr.delta.toFixed(r.cfg.decimals)}{r.cfg.unit}
          </div>
          <div className={`text-[10px] ${dr.tierInfo.cls}`}>{dr.tierInfo.label}</div>
        </div>
      </div>
      <div className="text-[10px] text-dash-muted mt-1 pl-[6.75rem] tabular-nums">
        aktiv {fmt(r.meanDone, r.cfg.decimals)}{r.cfg.unit} · {r.nDone}
        <span className="mx-1.5 text-dash-muted/40">|</span>
        inaktiv {fmt(r.meanNot, r.cfg.decimals)}{r.cfg.unit} · {r.nNot}
      </div>
    </div>
  );
}

/* ── UI: Habit-Karte ───────────────────────────────────────────────────────── */
function HabitCard({ a }: { a: HabitAnalysis }) {
  const tiered = a.outcomes.filter((r) => !derive(r).gated);
  const gated = a.outcomes.filter((r) => derive(r).gated);
  return (
    <div className="rounded-2xl border border-dash-border bg-dash-card p-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">{a.habit.emoji}</span>
          <h3 className="text-sm font-semibold text-white">{a.habit.name}</h3>
        </div>
        {a.confound && (
          <span className="text-[10px] text-amber-400 border border-amber-400/30 bg-amber-400/10 rounded-full px-2 py-0.5 shrink-0">
            ⚠ Trainingslast unterscheidet sich (TSB {fmt(a.tsbDone, 0)} vs {fmt(a.tsbNot, 0)})
          </span>
        )}
      </div>
      <p className="text-[11px] text-dash-muted mb-1">
        {activeWord(a.habit)} an {a.active}/{a.rated} Tagen
        {a.confound && " · Effekt evtl. nur Ruhetag-Unterschied"}
      </p>

      {tiered.map((r) => <OutcomeRow key={r.cfg.key} r={r} />)}

      {gated.length > 0 && (
        <p className="text-[10px] text-dash-muted/70 mt-2 pt-2 border-t border-dash-border/60">
          Noch zu wenig Daten: {gated.map((r) => r.cfg.label).join(", ")} (n &lt; {MIN_N})
        </p>
      )}
    </div>
  );
}

/* ── UI: Top-Signale ───────────────────────────────────────────────────────── */
interface Signal { habit: Habit; cfg: OutcomeCfg; delta: number; txtCls: string; tierLabel: string; tierCls: string; score: number; }

function TopSignals({ signals }: { signals: Signal[] }) {
  if (signals.length === 0) {
    return (
      <p className="text-[12px] text-dash-muted">
        Noch keine Zusammenhänge über dem Rauschen. Sammle weiter – vor allem Alkohol mit Menge
        und Stimmung täglich, dann erscheinen hier die ersten Tendenzen.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {signals.map((s, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-base leading-none w-5 text-center">{s.habit.emoji}</span>
          <span className="text-[13px] text-white flex-1 min-w-0 truncate">
            {s.habit.name} <span className="text-dash-muted">→ {s.cfg.label}</span>
          </span>
          <span className={`text-[13px] font-medium tabular-nums ${s.txtCls}`}>
            {s.delta > 0 ? "+" : ""}{s.delta.toFixed(s.cfg.decimals)}{s.cfg.unit}
          </span>
          <span className={`text-[10px] ${s.tierCls} w-20 text-right`}>{s.tierLabel}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Hauptseite ────────────────────────────────────────────────────────────── */
export default function AnalysePage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [history, setHistory] = useState<History>({});
  const [habitsLoaded, setHabitsLoaded] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const [lag, setLag] = useState(1);

  const { data: wellness, loading: wLoading } = useWellness(LOOKBACK_DAYS);

  useEffect(() => {
    let alive = true;
    fetch("/api/habits", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (Array.isArray(d?.habits)) setHabits(d.habits);
        if (d?.history && typeof d.history === "object") setHistory(d.history);
      })
      .catch(() => { /* leerer Zustand wird unten behandelt */ })
      .finally(() => { if (alive) setHabitsLoaded(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/analysis-settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (alive && Array.isArray(d?.hidden)) setHidden(d.hidden); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const isHidden = (id: string) => hidden.includes(id);

  const toggleHabit = (id: string) => {
    setHidden((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      // server-persistieren (eigener Store, kein Clobber durch Habits-Seite)
      fetch("/api/analysis-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: next }),
      }).catch(() => {});
      return next;
    });
  };

  const byDate = useMemo(() => {
    const m: Record<string, WellnessDay> = {};
    for (const w of wellness) m[w.id] = w;
    return m;
  }, [wellness]);

  const analyses = useMemo(
    () => habits.map((h) => analyzeHabit(h, history, byDate, lag)),
    [habits, history, byDate, lag],
  );

  const stats = useMemo(() => {
    const habitDays = Object.keys(history);
    const overlap = habitDays.filter((d) => {
      const w = byDate[shiftDate(d, lag)];
      return w && (numField(w, "hrv") != null || numField(w, "sleepScore") != null);
    }).length;
    const moodDays = habitDays.filter((d) => history[d].mood != null).length;
    return { total: habitDays.length, overlap, moodDays };
  }, [history, byDate, lag]);

  const visible = analyses.filter((a) => !isHidden(a.habit.id));
  const evaluable = useMemo(
    () => visible.filter((a) => !a.constant).sort((a, b) => b.topScore - a.topScore),
    [visible],
  );
  const dormant = visible.filter((a) => a.constant);

  const signals = useMemo<Signal[]>(() => {
    const out: Signal[] = [];
    for (const a of analyses) {
      if (isHidden(a.habit.id) || a.constant || a.confound) continue;
      for (const r of a.outcomes) {
        const dr = derive(r);
        if (dr.gated || dr.negligible) continue;
        out.push({
          habit: a.habit, cfg: r.cfg, delta: dr.delta, txtCls: dr.txtCls,
          tierLabel: dr.tierInfo.label, tierCls: dr.tierInfo.cls, score: dr.score,
        });
      }
    }
    return out.sort((x, y) => y.score - x.score).slice(0, 5);
  }, [analyses, hidden]);

  const loading = wLoading || !habitsLoaded;

  return (
    <div className="space-y-4">
      {/* Kopf */}
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold text-white">Recovery-Analyse</h1>
        <div className="flex items-center gap-1 text-[11px]">
          <span className="text-dash-muted mr-1">Lag</span>
          {[0, 1].map((l) => (
            <button
              key={l}
              onClick={() => setLag(l)}
              className={`px-2 py-1 rounded-lg border ${
                lag === l
                  ? "border-sky-400/40 bg-sky-400/10 text-sky-300"
                  : "border-dash-border text-dash-muted hover:text-white"
              }`}
            >
              {l === 0 ? "selber Tag" : "+1 Tag"}
            </button>
          ))}
        </div>
      </div>

      {/* Habit-Auswahl */}
      {habits.length > 0 && (
        <div className="rounded-2xl border border-dash-border bg-dash-card px-5 py-4">
          <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-3">
            In Analyse · klick zum Aus-/Einblenden
          </p>
          <div className="flex flex-wrap gap-2">
            {habits.map((h) => {
              const off = isHidden(h.id);
              return (
                <button
                  key={h.id}
                  onClick={() => toggleHabit(h.id)}
                  className={`flex items-center gap-1.5 text-[12px] rounded-full border px-3 py-1 transition-colors ${
                    off
                      ? "border-dash-border text-dash-muted/50 hover:text-dash-muted"
                      : "border-sky-400/40 bg-sky-400/10 text-white"
                  }`}
                >
                  <span className="leading-none">{h.emoji}</span>
                  <span className={off ? "line-through" : ""}>{h.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Schlaf-Analyse */}
      <SleepAnalysis wellness={wellness} />

      {/* Top-Signale */}
      <div className="rounded-2xl border border-dash-border bg-dash-card p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium">
            Stärkste Zusammenhänge
          </p>
          <span className="text-[10px] text-dash-muted">
            rechts/grün = bessere Recovery · links/rot = schlechtere
          </span>
        </div>
        {loading
          ? <p className="text-[12px] text-dash-muted animate-pulse">Lade Daten …</p>
          : <TopSignals signals={signals} />}
      </div>

      {/* Datenreife (kompakt) */}
      <div className="rounded-2xl border border-dash-border bg-dash-card px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="text-[11px] text-dash-muted">
            <b className="text-white tabular-nums">{stats.total}</b> Habit-Tage
          </span>
          <span className="text-[11px] text-dash-muted">
            <b className="text-white tabular-nums">{stats.overlap}</b> mit Folgetag-Wellness
          </span>
          <span className="text-[11px] text-dash-muted">
            <b className="text-white tabular-nums">{stats.moodDays}</b> mit Stimmung
          </span>
          <span className="text-[11px] text-dash-muted">
            <b className="text-white tabular-nums">{evaluable.length}</b> auswertbare Habits
          </span>
          <span className="text-[11px] text-dash-muted/70 ml-auto">
            alle Tage · n ≥ {MIN_N} pro Gruppe · Korrelation ≠ Kausalität
          </span>
        </div>
      </div>

      {/* Karten */}
      {loading ? (
        <div className="rounded-2xl border border-dash-border bg-dash-card p-5 animate-pulse text-[12px] text-dash-muted">
          Lade Habit- und Wellness-Daten …
        </div>
      ) : habits.length === 0 ? (
        <div className="rounded-2xl border border-dash-border bg-dash-card p-5 text-[12px] text-dash-muted">
          Keine Habits gefunden. Lege im Habit-Tracker Habits an, dann erscheinen sie hier automatisch.
        </div>
      ) : evaluable.length === 0 ? (
        <div className="rounded-2xl border border-dash-border bg-dash-card p-5 text-[12px] text-dash-muted">
          Keine auswertbaren Habits ausgewählt. Blende oben welche ein.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {evaluable.map((a) => <HabitCard key={a.habit.id} a={a} />)}
          </div>

          {dormant.length > 0 && (
            <div className="rounded-2xl border border-dash-border bg-dash-card px-5 py-4">
              <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-1">
                Nicht auswertbar (zu konstant)
              </p>
              <p className="text-[12px] text-dash-muted">
                {dormant.map((a) => `${a.habit.emoji} ${a.habit.name}`).join("   ·   ")}
                <span className="text-dash-muted/60"> — fast immer oder fast nie, also nichts zu vergleichen.</span>
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
