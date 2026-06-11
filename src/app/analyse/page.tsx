"use client";

/* =============================================================================
 * Recovery-Analyse  ·  /analyse
 * -----------------------------------------------------------------------------
 * Verknüpft Habit-Daten (/api/habits) mit Wellness-Daten (useWellness) und
 * vergleicht je Habit "aktiv vs. inaktiv" gegen die Recovery-Metriken des
 * NÄCHSTEN Morgens (Lag +1: Abend-Verhalten -> Schlaf/HRV der Folgenacht).
 *
 * Grundprinzipien (bewusst konservativ, n-of-1):
 *  - Korrektes Lag: Habit an Tag D  ->  Wellness an Tag D+lag.
 *  - n-Gating: Ergebnis erscheint erst ab MIN_N pro Gruppe.
 *  - Varianz-Gate: fast immer / fast nie ausgeführte Habits sind nicht
 *    auswertbar (nichts zu vergleichen) und werden ausgeblendet.
 *  - Confound-Hinweis: unterscheidet sich die Trainingslast (TSB) der Gruppen
 *    stark, wird gewarnt (Ruhetag-Effekt statt Habit-Effekt).
 *  - Auto: iteriert über das gefetchte habits[] -> neue Habits erscheinen
 *    automatisch, ohne Code-Änderung.
 *
 * Das ist Hypothesen-Generierung, KEIN Beweis. Korrelation, keine Kausalität.
 * ============================================================================= */

import { useEffect, useMemo, useState } from "react";
import { useWellness } from "@/hooks/useWellness";
import { WellnessDay } from "@/lib/types";

/* ── Schwellen (hier anpassbar) ─────────────────────────────────────────────
   MIN_N  = Mindest-n pro Gruppe, damit überhaupt ein Vergleich gezeigt wird.
   Bewusst konservativ. Zum "Reinschauen" auf 6–8 senken (auf eigene Gefahr). */
const MIN_N = 10;
const TSB_CONFOUND = 8;        // |ΔTSB| ab hier: Trainingslast-Warnung
const LOOKBACK_DAYS = 180;     // Wellness-Fenster, das geladen wird

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

/* ── Outcome-Konfiguration ─────────────────────────────────────────────────── */
interface OutcomeCfg {
  key: string; label: string; sub: string; unit: string;
  good: "high" | "low"; decimals: number; transform?: (v: number) => number;
}
const OUTCOMES: OutcomeCfg[] = [
  { key: "hrv",        label: "HRV",          sub: "nächster Morgen", unit: " ms",  good: "high", decimals: 0 },
  { key: "restingHR",  label: "Ruhepuls",     sub: "nächster Morgen", unit: " bpm", good: "low",  decimals: 0 },
  { key: "sleepScore", label: "Schlaf-Score", sub: "Folgenacht",      unit: "",     good: "high", decimals: 0 },
  { key: "sleepSecs",  label: "Schlafdauer",  sub: "Folgenacht",      unit: " h",   good: "high", decimals: 1, transform: (v) => v / 3600 },
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
function fmt(v: number | null, dec: number): string {
  return v == null ? "–" : v.toFixed(dec);
}

/* ── Analyse-Strukturen ────────────────────────────────────────────────────── */
interface OutcomeResult {
  cfg: OutcomeCfg;
  nDone: number; nNot: number;
  meanDone: number | null; meanNot: number | null;
  tsbDone: number | null; tsbNot: number | null;
}
interface HabitAnalysis {
  habit: Habit;
  active: number; rated: number; rate: number;
  constant: boolean;
  outcomes: OutcomeResult[];
}

function analyzeHabit(
  h: Habit, history: History, byDate: Record<string, WellnessDay>, lag: number,
): HabitAnalysis {
  const dates = Object.keys(history).filter((d) => byDate[shiftDate(d, lag)]);
  const active = dates.filter((d) => habitDone(h, history[d])).length;
  const rate = dates.length ? active / dates.length : 0;
  const constant = dates.length === 0 || rate <= 0.1 || rate >= 0.9;

  const outcomes: OutcomeResult[] = OUTCOMES.map((cfg) => {
    const dv: number[] = [], nv: number[] = [], dt: number[] = [], nt: number[] = [];
    for (const d of dates) {
      const w = byDate[shiftDate(d, lag)];
      let val = numField(w, cfg.key);
      if (val == null) continue;
      if (cfg.transform) val = cfg.transform(val);
      const isDone = habitDone(h, history[d]);
      (isDone ? dv : nv).push(val);
      const t = tsbOf(w);
      if (t != null) (isDone ? dt : nt).push(t);
    }
    return {
      cfg,
      nDone: dv.length, nNot: nv.length,
      meanDone: dv.length ? mean(dv) : null,
      meanNot: nv.length ? mean(nv) : null,
      tsbDone: dt.length ? mean(dt) : null,
      tsbNot: nt.length ? mean(nt) : null,
    };
  });

  return { habit: h, active, rated: dates.length, rate, constant, outcomes };
}

/* ── Vertrauens-Stufe nach kleinerer Gruppe ────────────────────────────────── */
function tier(minN: number): { label: string; cls: string } | null {
  if (minN < MIN_N) return null;
  if (minN < 18) return { label: "sehr vorläufig", cls: "text-amber-400 border-amber-400/30 bg-amber-400/10" };
  if (minN < 30) return { label: "vorläufig",      cls: "text-sky-400 border-sky-400/30 bg-sky-400/10" };
  return { label: "erste Tendenz", cls: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" };
}

/* ── UI: einzelne Outcome-Zeile ────────────────────────────────────────────── */
function OutcomeRow({ r }: { r: OutcomeResult }) {
  const minN = Math.min(r.nDone, r.nNot);
  const t = tier(minN);

  if (!t || r.meanDone == null || r.meanNot == null) {
    const need = Math.max(0, MIN_N - minN);
    return (
      <div className="flex items-center justify-between py-2 border-t border-dash-border/60">
        <div>
          <span className="text-[13px] text-white">{r.cfg.label}</span>
          <span className="text-[11px] text-dash-muted ml-2">{r.cfg.sub}</span>
        </div>
        <span className="text-[11px] text-dash-muted">
          noch zu wenig (n={r.nDone}/{r.nNot}{need ? ` · ${need} fehlen` : ""})
        </span>
      </div>
    );
  }

  const delta = r.meanDone - r.meanNot;
  const betterWhenDone = r.cfg.good === "high" ? delta > 0 : delta < 0;
  const deltaCls = Math.abs(delta) < 0.05
    ? "text-dash-muted"
    : betterWhenDone ? "text-emerald-400" : "text-rose-400";
  const confound =
    r.tsbDone != null && r.tsbNot != null && Math.abs(r.tsbDone - r.tsbNot) > TSB_CONFOUND;

  const scale = Math.max(r.meanDone, r.meanNot) || 1;
  const wDone = Math.max(4, (r.meanDone / scale) * 100);
  const wNot = Math.max(4, (r.meanNot / scale) * 100);

  return (
    <div className="py-3 border-t border-dash-border/60">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-[13px] text-white">{r.cfg.label}</span>
          <span className="text-[11px] text-dash-muted ml-2">{r.cfg.sub}</span>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${t.cls}`}>{t.label}</span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-dash-muted w-16 shrink-0">aktiv</span>
          <div className="flex-1 h-2 rounded-full bg-dash-border/40 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${wDone}%` }} />
          </div>
          <span className="text-[12px] text-white w-20 text-right tabular-nums">
            {fmt(r.meanDone, r.cfg.decimals)}{r.cfg.unit} <span className="text-dash-muted">·{r.nDone}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-dash-muted w-16 shrink-0">inaktiv</span>
          <div className="flex-1 h-2 rounded-full bg-dash-border/40 overflow-hidden">
            <div className="h-full rounded-full bg-slate-500/60" style={{ width: `${wNot}%` }} />
          </div>
          <span className="text-[12px] text-white w-20 text-right tabular-nums">
            {fmt(r.meanNot, r.cfg.decimals)}{r.cfg.unit} <span className="text-dash-muted">·{r.nNot}</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <span className={`text-[12px] font-medium tabular-nums ${deltaCls}`}>
          Δ {delta > 0 ? "+" : ""}{delta.toFixed(r.cfg.decimals)}{r.cfg.unit}
        </span>
        {confound && (
          <span className="text-[10px] text-amber-400/90 border border-amber-400/30 bg-amber-400/10 rounded-full px-2 py-0.5">
            ⚠ Trainingslast unterscheidet sich (TSB {fmt(r.tsbDone, 0)} vs {fmt(r.tsbNot, 0)}) – evtl. Ruhetag-Effekt
          </span>
        )}
      </div>
    </div>
  );
}

/* ── UI: Habit-Karte ───────────────────────────────────────────────────────── */
function HabitCard({ a }: { a: HabitAnalysis }) {
  return (
    <div className="rounded-2xl border border-dash-border bg-dash-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg leading-none">{a.habit.emoji}</span>
        <h3 className="text-sm font-semibold text-white">{a.habit.name}</h3>
      </div>
      <p className="text-[11px] text-dash-muted mb-2">
        {activeWord(a.habit)} an {a.active}/{a.rated} Tagen (mit Folgetag-Wellness)
      </p>

      {a.constant ? (
        <p className="text-[12px] text-dash-muted border-t border-dash-border/60 pt-3">
          Zu konstant ({Math.round(a.rate * 100)}% der Tage) – nichts zu vergleichen.
          Erst auswertbar, wenn dieser Habit mal aktiv und mal inaktiv ist.
        </p>
      ) : (
        a.outcomes.map((r) => <OutcomeRow key={r.cfg.key} r={r} />)
      )}
    </div>
  );
}

/* ── Hauptseite ────────────────────────────────────────────────────────────── */
export default function AnalysePage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [history, setHistory] = useState<History>({});
  const [habitsLoaded, setHabitsLoaded] = useState(false);
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
      .catch(() => { /* still: leerer Zustand wird unten behandelt */ })
      .finally(() => { if (alive) setHabitsLoaded(true); });
    return () => { alive = false; };
  }, []);

  const byDate = useMemo(() => {
    const m: Record<string, WellnessDay> = {};
    for (const w of wellness) m[w.id] = w;
    return m;
  }, [wellness]);

  const analyses = useMemo(
    () => habits.map((h) => analyzeHabit(h, history, byDate, lag)),
    [habits, history, byDate, lag],
  );

  /* Datenreife-Kennzahlen */
  const stats = useMemo(() => {
    const habitDays = Object.keys(history);
    const overlap = habitDays.filter((d) => {
      const w = byDate[shiftDate(d, lag)];
      return w && (numField(w, "hrv") != null || numField(w, "sleepScore") != null);
    }).length;
    const moodDays = habitDays.filter((d) => history[d].mood != null).length;
    const constant = analyses.filter((a) => a.constant).map((a) => a.habit.name);
    return { total: habitDays.length, overlap, moodDays, constant };
  }, [history, byDate, lag, analyses]);

  const loading = wLoading || !habitsLoaded;
  const evaluable = analyses.filter((a) => !a.constant);
  const dormant = analyses.filter((a) => a.constant);

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

      {/* Datenreife-Banner */}
      <div className="rounded-2xl border border-dash-border bg-dash-card p-5">
        <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-3">
          Datenreife
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
          <div>
            <div className="text-lg font-semibold text-white tabular-nums">{stats.total}</div>
            <div className="text-[11px] text-dash-muted">Habit-Tage</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-white tabular-nums">{stats.overlap}</div>
            <div className="text-[11px] text-dash-muted">davon mit Folgetag-Wellness</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-white tabular-nums">{stats.moodDays}</div>
            <div className="text-[11px] text-dash-muted">Tage mit Stimmung</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-white tabular-nums">{evaluable.length}</div>
            <div className="text-[11px] text-dash-muted">auswertbare Habits</div>
          </div>
        </div>
        <p className="text-[11px] text-dash-muted leading-relaxed">
          Vergleich „aktiv vs. inaktiv" gegen die Recovery-Werte
          {lag === 0 ? " desselben Tages" : " des nächsten Morgens"}. Genutzt werden <b>alle</b> erfassten
          Tage (kein Zeitraumfilter – mehr Daten = belastbarer). Ergebnisse erscheinen erst ab
          n ≥ {MIN_N} pro Gruppe. Das ist Hypothesen-Suche, kein Beweis: Korrelation ≠ Kausalität,
          und bei n-of-1-Daten ist vieles Rauschen.
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dash-border bg-dash-card p-5 animate-pulse text-[12px] text-dash-muted">
          Lade Habit- und Wellness-Daten …
        </div>
      ) : habits.length === 0 ? (
        <div className="rounded-2xl border border-dash-border bg-dash-card p-5 text-[12px] text-dash-muted">
          Keine Habits gefunden. Lege im Habit-Tracker Habits an, dann erscheinen sie hier automatisch.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {evaluable.map((a) => <HabitCard key={a.habit.id} a={a} />)}
          </div>

          {dormant.length > 0 && (
            <div className="rounded-2xl border border-dash-border bg-dash-card p-5">
              <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-2">
                Nicht auswertbar (zu konstant)
              </p>
              <p className="text-[12px] text-dash-muted">
                {dormant.map((a) => `${a.habit.emoji} ${a.habit.name}`).join("  ·  ")}
              </p>
              <p className="text-[11px] text-dash-muted mt-2">
                Diese Habits machst du fast immer oder fast nie – ohne Variation gibt es nichts zu
                vergleichen. Tauchen automatisch auf, sobald sich das ändert.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
