"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ChevronLeft, ChevronRight, Plus, Trash2, Pencil,
  RefreshCw, Download, Bell, CheckSquare, ChevronUp, ChevronDown,
} from "lucide-react";
import { clsx } from "clsx";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

type HabitType = "checkbox" | "numeric";
type GoalType  = "daily" | "min_per_week" | "max_per_days";
type Tab       = "today" | "stats" | "manage" | "settings";

interface Habit {
  id: string;
  name: string;
  emoji: string;
  color: string;
  habitType: HabitType;
  unit: string;
  numTarget: number;
  goalType: GoalType;
  goalValue: number;
}

interface DayData {
  checked: string[];
  numeric: Record<string, number>;
  mood: number | null;
}
type History = Record<string, DayData>;

interface HabitSettings {
  ivAthleteId: string;
  ivApiKey: string;
  notifEnabled: boolean;
  notifTime: string;
  autoSync: boolean;
  lastSync: string | null;
}

const DEFAULTS: Habit[] = [
  { id:"h1", name:"4L Wasser",    emoji:"💧", color:"#3b82f6", habitType:"numeric",  unit:"L",  numTarget:4, goalType:"daily",        goalValue:1  },
  { id:"h2", name:"Alkohol",      emoji:"🍺", color:"#ef4444", habitType:"checkbox", unit:"",   numTarget:0, goalType:"max_per_days",  goalValue:14 },
  { id:"h3", name:"Sport 30 min", emoji:"🏃", color:"#10b981", habitType:"checkbox", unit:"",   numTarget:0, goalType:"min_per_week",  goalValue:5  },
];

const COLORS  = ["#3b82f6","#10b981","#ef4444","#8b5cf6","#f43f5e","#f59e0b","#84cc16","#06b6d4","#94a3b8"];
const EMOJIS  = ["💧","🍺","🏃","🧠","❤️","🌙","🍎","💊","🔥","🚶","🛌","💪","☕","📚","🌿","🚫","✏️","😴"];
const MOOD_E  = ["😴","😟","😐","😊","🔥"];
const MOOD_L  = ["Sehr schlecht","Schlecht","Okay","Gut","Ausgezeichnet"];
const DOW     = ["Mo","Di","Mi","Do","Fr","Sa","So"];

const TICK_STYLE    = { fill:"#94a3b8", fontSize:10 } as const;
const TOOLTIP_STYLE = { backgroundColor:"#131929", border:"1px solid #1e2d4a", borderRadius:8, fontSize:11 } as const;
const MOOD_COLORS   = ["transparent","#ef4444","#f59e0b","#94a3b8","#3b82f6","#10b981"];

function toDS(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function daysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate()-n); return toDS(d);
}
function fromDS(s: string): Date {
  const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d);
}
function todayStr(): string { return toDS(new Date()); }

function normalizeDay(raw: unknown): DayData {
  if (!raw) return { checked:[], numeric:{}, mood:null };
  if (Array.isArray(raw)) return { checked: raw as string[], numeric:{}, mood:null };
  const r = raw as Partial<DayData>;
  return { checked: r.checked||[], numeric: r.numeric||{}, mood: r.mood??null };
}

function isCompleted(h: Habit, date: string, history: History): boolean {
  const day = normalizeDay(history[date]);
  if (h.habitType === "numeric") {
    const v = day.numeric[h.id];
    return v !== undefined && v >= h.numTarget;
  }
  return day.checked.includes(h.id);
}

function calcStreak(h: Habit, history: History): number {
  const today = todayStr();
  let start = isCompleted(h, today, history) ? 0 : 1;
  let s = 0;
  for (let i = start; i < 365; i++) {
    if (!isCompleted(h, daysAgo(i), history)) break;
    s++;
  }
  return s;
}
function calcWeekCount(h: Habit, history: History): number {
  const dow = (new Date().getDay()+6)%7;
  let c = 0;
  for (let i = 0; i <= dow; i++) { if (isCompleted(h, daysAgo(i), history)) c++; }
  return c;
}
function calcLastDone(h: Habit, history: History): number | null {
  for (let i = 0; i < 90; i++) { if (isCompleted(h, daysAgo(i), history)) return i; }
  return null;
}

/* ── HabitGrid: anklickbare Kästchen ── */
function HabitGrid({
  habit, history, today, onToggle,
}: {
  habit: Habit;
  history: History;
  today: string;
  onToggle?: (date: string) => void;
}) {
  const now = new Date(), dow = (now.getDay()+6)%7;
  const start = new Date(now); start.setDate(now.getDate()-dow-21);

  const cells = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate()+i);
    const ds      = toDS(d);
    const done    = isCompleted(habit, ds, history);
    const isFut   = ds > today;
    const isTod   = ds === today;
    const clickable = !!onToggle && !isFut;
    return (
      <div
        key={ds}
        title={`${ds}${done ? " ✓" : ""}`}
        onClick={clickable ? () => onToggle!(ds) : undefined}
        style={{
          width: 16, height: 16, borderRadius: 3,
          background: done ? habit.color : isFut ? "transparent" : "rgba(30,45,74,0.4)",
          border: isTod ? "2px solid #94a3b8" : "0.5px solid rgba(30,45,74,0.8)",
          boxSizing: "border-box",
          cursor: clickable ? "pointer" : "default",
          opacity: isFut ? 0.2 : 1,
          transition: "opacity 0.15s",
        }}
      />
    );
  });

  return (
    <div className="mt-3">
      <div className="grid grid-cols-7 gap-0.5 mb-0.5">
        {DOW.map(d => <div key={d} className="text-[9px] text-dash-muted/40 text-center">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">{cells}</div>
      {onToggle && <p className="text-[9px] text-dash-muted/40 mt-1">Kästchen anklicken zum Umschalten</p>}
    </div>
  );
}

export default function HabitsPage() {
  const [habits,   setHabits]   = useState<Habit[]>([]);
  const [history,  setHistory]  = useState<History>({});
  const [settings, setSettings] = useState<HabitSettings>({
    ivAthleteId:"", ivApiKey:"", notifEnabled:false,
    notifTime:"22:00", autoSync:false, lastSync:null,
  });
  const [tab,      setTab]      = useState<Tab>("today");
  const [statsSub, setStatsSub] = useState<"stats"|"corr">("stats");
  const [selDate,  setSelDate]  = useState(todayStr());
  const [form,     setForm]     = useState<(Partial<Habit> & { error?: string }) | null>(null);
  const [delId,    setDelId]    = useState<string|null>(null);
  const [syncMsg,  setSyncMsg]  = useState("");
  const [loaded,   setLoaded]   = useState(false);

  useEffect(() => {
    try { setHabits(JSON.parse(localStorage.getItem("ht_habits") || "null") ?? DEFAULTS); }
    catch { setHabits(DEFAULTS); }
    try {
      const raw = JSON.parse(localStorage.getItem("ht_history") || "{}") as Record<string, unknown>;
      const norm: History = {};
      for (const [k, v] of Object.entries(raw)) norm[k] = normalizeDay(v);
      setHistory(norm);
    } catch { setHistory({}); }
    try {
      const s = JSON.parse(localStorage.getItem("ht_settings") || "{}") as Partial<HabitSettings>;
      setSettings(prev => ({ ...prev, ...s }));
    } catch { /* defaults */ }
    setLoaded(true);
  }, []);

  useEffect(() => { if (loaded) localStorage.setItem("ht_habits",   JSON.stringify(habits));   }, [habits,   loaded]);
  useEffect(() => { if (loaded) localStorage.setItem("ht_history",  JSON.stringify(history));  }, [history,  loaded]);
  useEffect(() => { if (loaded) localStorage.setItem("ht_settings", JSON.stringify(settings)); }, [settings, loaded]);

  useEffect(() => {
    if (!loaded || !settings.notifEnabled || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const [hh, mm] = settings.notifTime.split(":").map(Number);
    const now = new Date(), target = new Date(now);
    target.setHours(hh, mm, 0, 0);
    if (target <= now) target.setDate(target.getDate()+1);
    const tid = window.setTimeout(async () => {
      const td = todayStr();
      const done = habits.filter(h => isCompleted(h, td, history)).length;
      if (done < habits.length)
        new Notification("Habit Tracker", { body: `${done}/${habits.length} Habits erledigt 📋`, tag:"ht" });
      if (settings.autoSync) await doSync(td);
    }, target.getTime() - now.getTime());
    return () => clearTimeout(tid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.notifEnabled, settings.notifTime, settings.autoSync, loaded]);

  const today     = todayStr();
  const isToday   = selDate === today;
  const day       = useMemo(() => normalizeDay(history[selDate]), [history, selDate]);
  const doneCount = useMemo(() => habits.filter(h => isCompleted(h, selDate, history)).length, [habits, history, selDate]);
  const pct       = habits.length ? doneCount / habits.length : 0;
  const selLabel  = useMemo(() => {
    const d = fromDS(selDate);
    return {
      dow: d.toLocaleDateString("de-DE", { weekday:"long" }),
      dat: d.toLocaleDateString("de-DE", { day:"numeric", month:"long", year:"numeric" }),
    };
  }, [selDate]);

  const prevDate = () => { const d = fromDS(selDate); d.setDate(d.getDate()-1); setSelDate(toDS(d)); };
  const nextDate = () => { if (isToday) return; const d = fromDS(selDate); d.setDate(d.getDate()+1); setSelDate(toDS(d)); };

  const toggle = useCallback((id: string) => {
    setHistory(prev => {
      const day = normalizeDay(prev[selDate]);
      const i = day.checked.indexOf(id);
      if (i >= 0) day.checked.splice(i, 1); else day.checked.push(id);
      return { ...prev, [selDate]: day };
    });
  }, [selDate]);

  const setNum = useCallback((id: string, raw: string | number) => {
    const v = parseFloat(String(raw));
    setHistory(prev => {
      const day = normalizeDay(prev[selDate]);
      if (isNaN(v)) delete day.numeric[id];
      else day.numeric[id] = Math.max(0, Math.round(v*10)/10);
      return { ...prev, [selDate]: day };
    });
  }, [selDate]);

  const setMood = useCallback((val: number) => {
    setHistory(prev => {
      const day = normalizeDay(prev[selDate]);
      day.mood = day.mood === val ? null : val;
      return { ...prev, [selDate]: day };
    });
  }, [selDate]);

  /* ── Habit togglen für beliebiges Datum (für Grid-Klick im Verlauf) ── */
  const toggleDate = useCallback((hb: Habit, date: string) => {
    setHistory(prev => {
      const day = normalizeDay(prev[date]);
      if (hb.habitType === "checkbox") {
        const i = day.checked.indexOf(hb.id);
        if (i >= 0) day.checked.splice(i, 1); else day.checked.push(hb.id);
      } else {
        if (day.numeric[hb.id] !== undefined) delete day.numeric[hb.id];
        else day.numeric[hb.id] = hb.numTarget;
      }
      return { ...prev, [date]: day };
    });
  }, []);

  /* ── Reihenfolge verschieben ── */
  const moveHabit = (id: string, dir: -1 | 1) => {
    setHabits(prev => {
      const i = prev.findIndex(h => h.id === id);
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  function badge(h: Habit): string {
    if (h.goalType === "daily") {
      const s = calcStreak(h, history);
      return `🔥 ${s} ${s===1?"Tag":"Tage"} Streak`;
    }
    if (h.goalType === "min_per_week") {
      const c = calcWeekCount(h, history), ok = c >= h.goalValue;
      return `${c}/${h.goalValue} diese Woche${ok?" ✓":""}`;
    }
    const l = calcLastDone(h, history);
    if (l === null) return "Noch nie ✓";
    return `${l===0?"Heute":l+" Tage her"} ${l>=h.goalValue?"✓":"⚠"}`;
  }

  const openAdd  = () => setForm({ id:"", name:"", emoji:"💧", color:"#3b82f6", habitType:"checkbox", unit:"", numTarget:0, goalType:"daily", goalValue:3 });
  const openEdit = (h: Habit) => { setForm({ ...h }); setDelId(null); };

  const saveForm = () => {
    if (!form) return;
    if (!form.name?.trim()) { setForm(f => f ? { ...f, error:"Name fehlt" } : null); return; }
    const entry: Habit = {
      id: form.id || "h"+Date.now(),
      name: form.name.trim(),
      emoji: form.emoji || "💧",
      color: form.color || COLORS[0],
      habitType: form.habitType || "checkbox",
      unit: form.unit || "",
      numTarget: form.numTarget || 0,
      goalType: form.goalType || "daily",
      goalValue: form.goalValue || 1,
    };
    setHabits(prev => form.id ? prev.map(h => h.id===form.id ? entry : h) : [...prev, entry]);
    setForm(null);
  };

  const doSync = async (date: string): Promise<boolean> => {
    if (!settings.ivAthleteId || !settings.ivApiKey) return false;
    const d = normalizeDay(history[date]);
    const tags = habits.filter(h => d.checked.includes(h.id)).map(h => h.name.replace(/\s+/g,"_"));
    const nums = habits.filter(h => h.habitType==="numeric" && d.numeric[h.id]!==undefined).map(h => `${h.name}: ${d.numeric[h.id]} ${h.unit}`).join(", ");
    const payload = {
      id: date,
      ...(tags.length > 0 && { tags }),
      ...(nums && { comment: `Habit Tracker – ${nums}` }),
      ...(d.mood !== null && { motivation: d.mood }),
    };
    try {
      const res = await fetch(`https://intervals.icu/api/v1/athlete/${settings.ivAthleteId}/wellness`, {
        method: "PUT",
        headers: { "Content-Type":"application/json", "Authorization":"Basic "+btoa(`API_KEY:${settings.ivApiKey}`) },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSettings(s => ({ ...s, lastSync: new Date().toISOString() }));
      return true;
    } catch (e) { console.error("intervals.icu:", e); return false; }
  };

  const corrData = useMemo(() => Array.from({ length: 12 }, (_, w) => {
    const obj: Record<string, unknown> = { label: `W-${(11-w)*7}d` };
    habits.forEach(h => {
      let c = 0; for (let d=0; d<7; d++) { if (isCompleted(h, daysAgo((11-w)*7+d), history)) c++; }
      obj[h.name] = Math.round(c/7*100);
    });
    return obj;
  }), [habits, history]);

  const exportCSV = () => {
    const heads = ["Datum","Stimmung",...habits.map(h=>h.name)];
    const rows = Object.keys(history).sort().map(date => {
      const d = normalizeDay(history[date]);
      const vals = habits.map(h => h.habitType==="numeric" ? (d.numeric[h.id]??"") : (d.checked.includes(h.id)?1:0));
      return [date, d.mood??"", ...vals].join(",");
    });
    dl(`habits-${today}.csv`, [heads.join(","), ...rows].join("\n"), "text/csv");
  };
  const exportJSON = () => dl(`habits-${today}.json`, JSON.stringify({ habits, history }, null, 2), "application/json");
  function dl(name: string, content: string, type: string) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name; a.click();
  }

  if (!loaded) return <div className="p-6 text-dash-muted text-sm animate-pulse">Lade Habits…</div>;

  return (
    <>
      <header className="sticky top-0 z-10 bg-dash-bg/95 backdrop-blur border-b border-dash-border px-6 py-3 flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-sm font-semibold text-white flex items-center gap-2">
          <CheckSquare size={14} style={{ color: "var(--a-600)" }} />
          Habit Tracker
        </h1>
        <div className="flex items-center gap-1 flex-wrap">
          {(["today","stats","manage","settings"] as const).map(t => {
            const labels: Record<Tab, string> = { today:"Heute", stats:"Verlauf", manage:"Verwalten", settings:"Einstellungen" };
            return (
              <button key={t} onClick={() => { setTab(t); setForm(null); setDelId(null); }}
                className={clsx("text-xs px-3 py-1.5 rounded-xl border transition-colors", tab===t ? "text-white border-transparent" : "text-dash-muted border-dash-border hover:text-white hover:border-indigo-500/50")}
                style={tab===t ? { backgroundColor:"var(--a-600)" } : {}}
              >{labels[t]}</button>
            );
          })}
        </div>
      </header>

      <div className="p-6 max-w-2xl space-y-4">

        {/* ══ HEUTE ══ */}
        {tab === "today" && (
          <>
            {/* Date navigation — Datum anklicken öffnet Kalender */}
            <div className="flex items-center justify-between p-3 rounded-2xl border border-dash-border bg-dash-card">
              <button onClick={prevDate} className="p-2 rounded-xl border border-dash-border text-dash-muted hover:text-white hover:border-indigo-500/50 transition-colors">
                <ChevronLeft size={15} />
              </button>

              {/* ▼ Klick öffnet nativen Datums-Picker ▼ */}
              <div className="text-center cursor-pointer group relative" onClick={() => (document.getElementById("ht-datepicker") as HTMLInputElement)?.showPicker()}>
                <p className="text-[11px] text-dash-muted">
                  {selLabel.dow}
                  {isToday && <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">Heute</span>}
                </p>
                <p className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors">
                  {selLabel.dat} <span className="text-[10px] text-dash-muted/50">▾</span>
                </p>
                <input
                  id="ht-datepicker"
                  type="date"
                  value={selDate}
                  max={today}
                  onChange={e => { if (e.target.value) setSelDate(e.target.value); }}
                  className="sr-only"
                />
              </div>

              <button onClick={nextDate} disabled={isToday} className="p-2 rounded-xl border border-dash-border text-dash-muted hover:text-white hover:border-indigo-500/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRight size={15} />
              </button>
            </div>

            {/* Mood */}
            <div className="flex items-center gap-2 p-3 rounded-2xl border border-dash-border bg-dash-card flex-wrap">
              <span className="text-[11px] text-dash-muted mr-1">Stimmung</span>
              {MOOD_E.map((e, i) => (
                <button key={i} onClick={() => setMood(i+1)}
                  className={clsx("text-xl rounded-lg p-1 transition-all", day.mood===i+1 ? "scale-110 bg-white/10" : "opacity-50 hover:opacity-100")}
                  title={MOOD_L[i]}>{e}</button>
              ))}
              {day.mood && <span className="text-[11px] text-dash-muted ml-1">{MOOD_L[day.mood-1]}</span>}
            </div>

            {/* Progress */}
            {habits.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-dash-card overflow-hidden border border-dash-border">
                  <div className="h-full rounded-full bg-indigo-500 transition-all duration-300" style={{ width:`${Math.round(pct*100)}%` }} />
                </div>
                <span className="text-xs text-dash-muted tabular-nums">{doneCount}/{habits.length}</span>
              </div>
            )}

            {habits.length === 0 && (
              <div className="rounded-2xl border border-dashed border-dash-border p-10 text-center text-dash-muted text-sm">
                Noch keine Habits.<br />Im Tab <strong className="text-white">Verwalten</strong> anfangen.
              </div>
            )}

            {habits.map(hb => {
              const done   = isCompleted(hb, selDate, history);
              const numVal = hb.habitType === "numeric" ? (day.numeric[hb.id] ?? null) : null;
              return (
                <div key={hb.id}
                  className={clsx("flex items-center gap-3 p-3.5 rounded-2xl border bg-dash-card transition-colors", hb.habitType==="checkbox" && "cursor-pointer select-none")}
                  style={{ borderColor: done ? hb.color+"60" : undefined }}
                  onClick={hb.habitType==="checkbox" ? () => toggle(hb.id) : undefined}
                  role={hb.habitType==="checkbox" ? "checkbox" : undefined}
                  aria-checked={hb.habitType==="checkbox" ? done : undefined}
                  tabIndex={hb.habitType==="checkbox" ? 0 : undefined}
                  onKeyDown={hb.habitType==="checkbox" ? e => { if (e.key==="Enter"||e.key===" ") toggle(hb.id); } : undefined}
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-base transition-all"
                    style={{ border:`2px solid ${hb.color}`, background: done ? hb.color : "transparent", color: done ? "#fff" : hb.color }}>
                    {done ? "✓" : hb.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{hb.name}</p>
                    <p className="text-[11px] text-dash-muted">{badge(hb)}</p>
                  </div>
                  {hb.habitType === "numeric" && (
                    <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setNum(hb.id, Math.max(0, Math.round(((numVal??0)*10-5))/10))} className="w-7 h-7 rounded-lg border border-dash-border text-dash-muted hover:text-white text-base flex items-center justify-center transition-colors">−</button>
                      <input type="number" step="0.5" min="0" value={numVal ?? ""} placeholder="0"
                        onChange={e => setNum(hb.id, e.target.value)}
                        onClick={e => (e.target as HTMLInputElement).select()}
                        className="w-12 text-center text-sm bg-dash-bg border border-dash-border rounded-lg py-1 text-white tabular-nums focus:outline-none focus:border-indigo-500 transition-colors" />
                      <button onClick={() => setNum(hb.id, Math.round(((numVal??0)*10+5))/10)} className="w-7 h-7 rounded-lg border border-dash-border text-dash-muted hover:text-white text-base flex items-center justify-center transition-colors">+</button>
                      <span className="text-[11px] text-dash-muted whitespace-nowrap">/{hb.numTarget} {hb.unit}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* ══ VERLAUF ══ */}
        {tab === "stats" && (
          <>
            <div className="flex gap-2">
              {(["stats","corr"] as const).map(s => (
                <button key={s} onClick={() => setStatsSub(s)}
                  className={clsx("text-xs px-3 py-1.5 rounded-xl border transition-colors", statsSub===s ? "text-white border-transparent" : "text-dash-muted border-dash-border hover:text-white")}
                  style={statsSub===s ? { backgroundColor:"var(--a-600)" } : {}}
                >{s==="stats" ? "Statistiken" : "Korrelation"}</button>
              ))}
            </div>

            {statsSub === "stats" && (
              <>
                {habits.length === 0 && <div className="rounded-2xl border border-dashed border-dash-border p-10 text-center text-dash-muted text-sm">Noch keine Habits vorhanden.</div>}

                {habits.map(hb => {
                  let c28=0; for (let i=0;i<28;i++) { if (isCompleted(hb,daysAgo(i),history)) c28++; }
                  const rate=Math.round(c28/28*100), streak=calcStreak(hb,history), wc=calcWeekCount(hb,history), ld=calcLastDone(hb,history);
                  let avgNum: number|null = null;
                  if (hb.habitType==="numeric") {
                    let sum=0,cnt=0;
                    for (let i=0;i<28;i++) { const v=normalizeDay(history[daysAgo(i)]).numeric[hb.id]; if(v!==undefined){sum+=v;cnt++;} }
                    avgNum = cnt>0 ? Math.round(sum/cnt*10)/10 : null;
                  }
                  return (
                    <div key={hb.id} className="rounded-2xl border border-dash-border bg-dash-card p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0" style={{ background:hb.color+"22" }}>{hb.emoji}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white">{hb.name}</p>
                          <p className="text-[11px] text-dash-muted">{hb.goalType==="daily"?"Täglich":hb.goalType==="min_per_week"?`Min. ${hb.goalValue}×/Woche`:`Max. alle ${hb.goalValue} Tage`}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-2xl font-bold tabular-nums" style={{ color:hb.color }}>{rate}%</p>
                          <p className="text-[10px] text-dash-muted">28 Tage</p>
                        </div>
                      </div>

                      {/* ▼ Kästchen im Verlauf sind jetzt anklickbar ▼ */}
                      <HabitGrid
                        habit={hb}
                        history={history}
                        today={today}
                        onToggle={(date) => toggleDate(hb, date)}
                      />

                      <div className="flex gap-5 mt-3 pt-3 border-t border-dash-border flex-wrap">
                        {hb.goalType==="daily" && <div><p className="text-lg font-bold tabular-nums text-white">{streak}</p><p className="text-[10px] text-dash-muted">Streak</p></div>}
                        {hb.goalType==="min_per_week" && <div><p className="text-lg font-bold tabular-nums" style={{color:wc>=hb.goalValue?"#10b981":"#94a3b8"}}>{wc}/{hb.goalValue}</p><p className="text-[10px] text-dash-muted">diese Woche</p></div>}
                        {hb.goalType==="max_per_days" && ld!==null && <div><p className="text-lg font-bold tabular-nums" style={{color:ld>=hb.goalValue?"#10b981":"#ef4444"}}>{ld}</p><p className="text-[10px] text-dash-muted">Tage seit letztem</p></div>}
                        <div><p className="text-lg font-bold tabular-nums text-white">{c28}</p><p className="text-[10px] text-dash-muted">von 28 Tagen</p></div>
                        {avgNum!==null && <div><p className="text-lg font-bold tabular-nums text-white">{avgNum}</p><p className="text-[10px] text-dash-muted">⌀ {hb.unit}/Tag</p></div>}
                      </div>
                    </div>
                  );
                })}

                {(() => {
                  const days28 = Array.from({length:28},(_,i)=>({ds:daysAgo(27-i),m:normalizeDay(history[daysAgo(27-i)]).mood}));
                  if (!days28.some(x=>x.m!==null)) return null;
                  return (
                    <div className="rounded-2xl border border-dash-border bg-dash-card p-4">
                      <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-3">Stimmung – letzte 28 Tage</p>
                      <div className="grid grid-cols-7 gap-1 mb-0.5">{DOW.map(d=><div key={d} className="text-[9px] text-dash-muted/40 text-center">{d}</div>)}</div>
                      <div className="grid grid-cols-7 gap-1">
                        {days28.map(({ds,m})=>(
                          <div key={ds} title={`${ds}: ${m?MOOD_L[m-1]:"–"}`}
                            style={{aspectRatio:"1",borderRadius:4,background:m?MOOD_COLORS[m]:"rgba(30,45,74,0.4)",opacity:m?1:0.4,border:"0.5px solid rgba(30,45,74,0.8)"}} />
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-3">
                        {MOOD_E.map((e,i)=><span key={i} className="text-[10px] text-dash-muted">{e} {MOOD_L[i]}</span>)}
                      </div>
                    </div>
                  );
                })()}
                <p className="text-[10px] text-dash-muted text-center">Letzte 4 Wochen · Montag bis Sonntag · Heute mit Rahmen markiert</p>
              </>
            )}

            {statsSub === "corr" && (
              <>
                <div className="rounded-2xl border border-dash-border bg-dash-card p-4">
                  <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-4">Wochentag-Muster (12 Wochen)</p>
                  <div className="flex gap-2 mb-2 ml-24">{DOW.map(d=><div key={d} className="w-5 text-[9px] text-dash-muted/40 text-center">{d}</div>)}</div>
                  {habits.map(hb => {
                    const currDow=(new Date().getDay()+6)%7;
                    return (
                      <div key={hb.id} className="flex items-center gap-2 mb-2">
                        <span className="text-[11px] text-dash-muted w-24 truncate" title={hb.name}>{hb.name}</span>
                        <div className="flex gap-1">
                          {DOW.map((_,di)=>{
                            let done=0,total=0;
                            for(let w=0;w<12;w++){const back=(currDow-di+7)%7+w*7;const ds=daysAgo(back);if(ds<=today){total++;if(isCompleted(hb,ds,history))done++;}}
                            const p=total>0?done/total:0;
                            return <div key={di} className="w-5 h-5 rounded-sm" style={{background:hb.color,opacity:0.08+p*0.92,border:"0.5px solid rgba(30,45,74,0.8)"}} title={`${DOW[di]}: ${Math.round(p*100)}%`}/>;
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-2xl border border-dash-border bg-dash-card p-4">
                  <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-4">12-Wochen-Verlauf (Erfüllungsrate)</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={corrData} margin={{top:4,right:8,left:0,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
                      <XAxis dataKey="label" tick={TICK_STYLE} tickLine={false} axisLine={false} />
                      <YAxis tick={TICK_STYLE} tickLine={false} axisLine={false} domain={[0,100]} tickFormatter={v=>`${v}%`} width={42} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{color:"#e2e8f0"}} formatter={(v:unknown)=>[`${v}%`]} />
                      {habits.map(h=><Line key={h.id} type="monotone" dataKey={h.name} stroke={h.color} strokeWidth={2} dot={false} connectNulls />)}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-yellow-200/70 leading-relaxed">
                  💡 <strong className="text-yellow-200/90">intervals.icu-Korrelation:</strong> Mit API-Key wird hier zukünftig die Lag-1-Korrelation von Habits zu HRV und Readiness angezeigt — z. B. „Tage nach Alkohol: HRV −12%".
                </div>
              </>
            )}
          </>
        )}

        {/* ══ VERWALTEN ══ */}
        {tab === "manage" && (
          <>
            {habits.length===0 && !form && (
              <div className="rounded-2xl border border-dashed border-dash-border p-10 text-center text-dash-muted text-sm">Noch keine Habits.</div>
            )}

            {/* ▼ Hier ist idx für die ↑↓ Buttons ▼ */}
            {habits.map((hb, idx) => {
              if (delId===hb.id) return (
                <div key={hb.id} className="flex items-center gap-3 p-3 rounded-2xl border border-red-500/30 bg-dash-card text-sm flex-wrap">
                  <span className="flex-1 text-dash-muted min-w-0">„{hb.name}" löschen? (Verlauf bleibt erhalten)</span>
                  <button onClick={()=>{setHabits(p=>p.filter(x=>x.id!==hb.id));setDelId(null);}} className="text-xs px-3 py-1.5 rounded-xl text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors">Löschen</button>
                  <button onClick={()=>setDelId(null)} className="text-xs px-3 py-1.5 rounded-xl text-dash-muted border border-dash-border hover:text-white transition-colors">Abbrechen</button>
                </div>
              );
              return (
                <div key={hb.id} className="flex items-center gap-3 p-3 rounded-2xl border border-dash-border bg-dash-card">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-base" style={{background:hb.color+"22"}}>{hb.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{hb.name}</p>
                    <p className="text-[11px] text-dash-muted">{hb.habitType==="numeric"?`Numerisch · ${hb.numTarget} ${hb.unit} · `:""}Ziel: {hb.goalType==="daily"?"täglich":hb.goalType==="min_per_week"?`${hb.goalValue}×/Woche`:`alle ${hb.goalValue} Tage`}</p>
                  </div>
                  {/* ▼ Reihenfolge-Buttons ▼ */}
                  <button onClick={()=>moveHabit(hb.id,-1)} disabled={idx===0}
                    className="p-2 rounded-xl border border-dash-border text-dash-muted hover:text-white transition-colors disabled:opacity-20">
                    <ChevronUp size={14}/>
                  </button>
                  <button onClick={()=>moveHabit(hb.id,1)} disabled={idx===habits.length-1}
                    className="p-2 rounded-xl border border-dash-border text-dash-muted hover:text-white transition-colors disabled:opacity-20">
                    <ChevronDown size={14}/>
                  </button>
                  <button onClick={()=>openEdit(hb)} className="p-2 rounded-xl border border-dash-border text-dash-muted hover:text-white transition-colors"><Pencil size={14}/></button>
                  <button onClick={()=>{setDelId(hb.id);setForm(null);}} className="p-2 rounded-xl border border-dash-border text-dash-muted hover:text-red-400 transition-colors"><Trash2 size={14}/></button>
                </div>
              );
            })}

            {!form && (
              <button onClick={openAdd} className="w-full py-3 rounded-2xl border border-dashed border-dash-border text-dash-muted hover:text-white hover:border-indigo-500/40 transition-colors flex items-center justify-center gap-2 text-sm">
                <Plus size={15}/> Habit hinzufügen
              </button>
            )}

            {form && (
              <div className="rounded-2xl border border-dash-border bg-dash-card p-4 space-y-3">
                <p className="text-sm font-medium text-white">{form.id?"Habit bearbeiten":"Neuer Habit"}</p>
                <div>
                  <label className="text-[11px] text-dash-muted block mb-1">Name</label>
                  <input type="text" value={form.name||""} onChange={e=>setForm(f=>f?{...f,name:e.target.value,error:""}:null)} placeholder="z. B. Morgensport" className="w-full px-3 py-2 text-sm bg-dash-bg border border-dash-border rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
                <div>
                  <label className="text-[11px] text-dash-muted block mb-1">Typ</label>
                  <div className="flex gap-4">
                    {(["checkbox","numeric"] as const).map(t=>(
                      <label key={t} className="flex items-center gap-2 text-sm text-dash-muted cursor-pointer">
                        <input type="radio" name="htype" checked={form.habitType===t} onChange={()=>setForm(f=>f?{...f,habitType:t}:null)} /> {t==="checkbox"?"Checkbox":"Numerisch"}
                      </label>
                    ))}
                  </div>
                </div>
                {form.habitType==="numeric" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-dash-muted block mb-1">Einheit</label>
                      <input type="text" value={form.unit||""} onChange={e=>setForm(f=>f?{...f,unit:e.target.value}:null)} placeholder="L, km, h …" className="w-full px-3 py-2 text-sm bg-dash-bg border border-dash-border rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                    </div>
                    <div>
                      <label className="text-[11px] text-dash-muted block mb-1">Zielwert</label>
                      <input type="number" min="0" step="0.5" value={form.numTarget||0} onChange={e=>setForm(f=>f?{...f,numTarget:parseFloat(e.target.value)||0}:null)} className="w-full px-3 py-2 text-sm bg-dash-bg border border-dash-border rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-[11px] text-dash-muted block mb-1">Icon</label>
                  <div className="flex flex-wrap gap-1">
                    {EMOJIS.map(e=>(
                      <button key={e} type="button" onClick={()=>setForm(f=>f?{...f,emoji:e}:null)} className={clsx("w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all",form.emoji===e?"bg-white/15 ring-1 ring-indigo-400":"hover:bg-white/10")}>{e}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-dash-muted block mb-1">Farbe</label>
                  <div className="flex gap-2 flex-wrap">
                    {COLORS.map(c=>(
                      <button key={c} type="button" onClick={()=>setForm(f=>f?{...f,color:c}:null)} className="w-6 h-6 rounded-full transition-all" style={{background:c,outline:form.color===c?"2px solid white":"2px solid transparent",outlineOffset:2}} />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-dash-muted block mb-1">Zieltyp</label>
                  <select value={form.goalType||"daily"} onChange={e=>setForm(f=>f?{...f,goalType:e.target.value as GoalType}:null)} className="w-full px-3 py-2 text-sm bg-dash-bg border border-dash-border rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors">
                    <option value="daily">Täglich</option>
                    <option value="min_per_week">Mindestens X mal pro Woche</option>
                    <option value="max_per_days">Höchstens alle X Tage</option>
                  </select>
                </div>
                {form.goalType!=="daily" && (
                  <div>
                    <label className="text-[11px] text-dash-muted block mb-1">{form.goalType==="min_per_week"?"Anzahl pro Woche":"Intervall in Tagen"}</label>
                    <input type="number" min="1" max={form.goalType==="min_per_week"?7:365} value={form.goalValue||1} onChange={e=>setForm(f=>f?{...f,goalValue:Math.max(1,parseInt(e.target.value)||1)}:null)} className="w-24 px-3 py-2 text-sm bg-dash-bg border border-dash-border rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                  </div>
                )}
                {form.error && <p className="text-xs text-red-400">{form.error}</p>}
                <div className="flex gap-2 pt-1">
                  <button onClick={saveForm} className="flex-1 py-2 text-sm font-medium rounded-xl text-white transition-colors" style={{backgroundColor:"var(--a-600)"}}>
                    {form.id?"Speichern":"Hinzufügen"}
                  </button>
                  <button onClick={()=>setForm(null)} className="px-4 py-2 text-sm text-dash-muted border border-dash-border rounded-xl hover:text-white transition-colors">Abbrechen</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ══ EINSTELLUNGEN ══ */}
        {tab === "settings" && (
          <>
            <div className="rounded-2xl border border-dash-border bg-dash-card p-4 space-y-3">
              <p className="text-sm font-semibold text-white">intervals.icu Wellness-Sync</p>
              <p className="text-xs text-dash-muted leading-relaxed">
                Habits werden als <strong className="text-white">Tags + Kommentar</strong> eingetragen — Readiness wird <em>nicht</em> überschrieben. Dein Garmin misst die physiologische Reaktion automatisch; Habits liefern den Kontext. Mood → <code className="text-indigo-300 text-[10px]">motivation</code>.
              </p>
              <div>
                <label className="text-[11px] text-dash-muted block mb-1">Athleten-ID</label>
                <input type="text" value={settings.ivAthleteId} onChange={e=>setSettings(s=>({...s,ivAthleteId:e.target.value}))} placeholder="i12345" className="w-40 px-3 py-2 text-sm bg-dash-bg border border-dash-border rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              <div>
                <label className="text-[11px] text-dash-muted block mb-1">API-Key <span className="text-dash-muted/50">(intervals.icu → Einstellungen → API)</span></label>
                <input type="password" value={settings.ivApiKey} onChange={e=>setSettings(s=>({...s,ivApiKey:e.target.value}))} placeholder="••••••••" className="w-full px-3 py-2 text-sm bg-dash-bg border border-dash-border rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <button onClick={async()=>{setSyncMsg("Synchronisiere…");const ok=await doSync(today);setSyncMsg(ok?`✓ Sync: ${new Date().toLocaleString("de-DE")}`:"✗ Fehlgeschlagen — API-Key / ID prüfen");}}
                  className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border border-dash-border text-dash-muted hover:text-white hover:border-indigo-500/50 transition-colors">
                  <RefreshCw size={12}/> Jetzt synchronisieren
                </button>
                <label className="flex items-center gap-2 text-xs text-dash-muted cursor-pointer">
                  <input type="checkbox" checked={settings.autoSync} onChange={e=>setSettings(s=>({...s,autoSync:e.target.checked}))} />
                  Täglich um <input type="time" value={settings.notifTime} onChange={e=>setSettings(s=>({...s,notifTime:e.target.value}))} className="w-24 px-2 py-1 text-xs bg-dash-bg border border-dash-border rounded-lg text-white focus:outline-none focus:border-indigo-500" /> Uhr
                </label>
              </div>
              {syncMsg && <p className="text-[11px] text-dash-muted">{syncMsg}</p>}
              {settings.lastSync && <p className="text-[11px] text-dash-muted/50">Letzter Sync: {new Date(settings.lastSync).toLocaleString("de-DE")}</p>}
            </div>

            <div className="rounded-2xl border border-dash-border bg-dash-card p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Benachrichtigungen</p>
              <p className="text-xs text-dash-muted">Erinnerung wenn Habits noch nicht erledigt sind. Seite muss dafür offen sein.</p>
              {typeof window!=="undefined" && "Notification" in window && (
                Notification.permission==="granted" ? (
                  <label className="flex items-center gap-2 text-xs text-dash-muted cursor-pointer flex-wrap">
                    <input type="checkbox" checked={settings.notifEnabled} onChange={e=>setSettings(s=>({...s,notifEnabled:e.target.checked}))} />
                    Aktiv um <input type="time" value={settings.notifTime} onChange={e=>setSettings(s=>({...s,notifTime:e.target.value}))} className="w-24 px-2 py-1 text-xs bg-dash-bg border border-dash-border rounded-lg text-white focus:outline-none focus:border-indigo-500" /> Uhr
                  </label>
                ) : Notification.permission==="denied" ? (
                  <p className="text-xs text-red-400">Im Browser blockiert — bitte manuell in den Browser-Einstellungen erlauben.</p>
                ) : (
                  <button onClick={async()=>{const p=await Notification.requestPermission();if(p==="granted")setSettings(s=>({...s,notifEnabled:true}));}}
                    className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border border-dash-border text-dash-muted hover:text-white hover:border-indigo-500/50 transition-colors">
                    <Bell size={12}/> Benachrichtigungen erlauben
                  </button>
                )
              )}
            </div>

            <div className="rounded-2xl border border-dash-border bg-dash-card p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Daten-Export (3-2-1 Backup)</p>
              <p className="text-xs text-dash-muted">Daten liegen im Browser-localStorage. Monatlich exportieren und in Paperless-ngx oder auf die Backup-HDD ablegen.</p>
              <div className="flex gap-2 flex-wrap">
                <button onClick={exportCSV} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border border-dash-border text-dash-muted hover:text-white hover:border-indigo-500/50 transition-colors"><Download size={12}/> CSV</button>
                <button onClick={exportJSON} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border border-dash-border text-dash-muted hover:text-white hover:border-indigo-500/50 transition-colors"><Download size={12}/> JSON</button>
              </div>
              <div>
                <label className="text-[11px] text-dash-muted block mb-1">JSON importieren <strong>(überschreibt alle Daten!)</strong></label>
                <input type="file" accept=".json" onChange={e=>{
                  const file=e.target.files?.[0];if(!file)return;
                  const r=new FileReader();
                  r.onload=ev=>{try{const d=JSON.parse(ev.target?.result as string);if(d.habits)setHabits(d.habits);if(d.history){const norm:History={};for(const[k,v]of Object.entries(d.history))norm[k]=normalizeDay(v);setHistory(norm);}e.target.value="";}catch{alert("Ungültige JSON-Datei.");}};
                  r.readAsText(file);
                }} className="text-xs text-dash-muted" />
              </div>
            </div>
          </>
        )}

      </div>
    </>
  );
}
