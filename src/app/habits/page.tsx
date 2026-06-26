"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ChevronLeft, ChevronRight, Plus, Trash2, Pencil,
  RefreshCw, Download, Bell, CheckSquare, ChevronUp, ChevronDown, MapPin,
} from "lucide-react";
import { clsx } from "clsx";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

type HabitType  = "checkbox" | "numeric";
type GoalType   = "daily" | "min_per_week" | "max_per_days";
type Tab        = "today" | "stats" | "manage" | "settings";
type Period     = "4w" | "3m" | "6m" | "1j";

interface Habit {
  id: string; name: string; emoji: string; color: string;
  habitType: HabitType; unit: string; numTarget: number;
  goalType: GoalType; goalValue: number;
  retroEvening?: boolean; // Abend-Habit: im "Heute"-Tab unter "Letzte Nacht", speichert auf den Vortag
}
interface DayData { checked: string[]; numeric: Record<string, number>; mood: number | null; drinks: Record<string, Record<string, number>>; dynamicTargets?: Record<string, number>; wellness?: Record<string, number>; nutrition?: { kcal?: number; carbs?: number; protein?: number }; }
type History = Record<string, DayData>;
interface HabitSettings {
  ivAthleteId: string; ivApiKey: string;
  notifEnabled: boolean; notifTime: string; autoSync: boolean; lastSync: string | null;
  latitude: number | null; longitude: number | null; locationName: string;
}
interface HydrationSettings {
  bodyWeightKg: number;
  useWeightBased: boolean;
  baseWaterL: number;
  sweatTests: {
    outdoor24: number | null;
    outdoor28: number | null;
    rolle: number | null;
  };
}
const DEFAULT_HYDRATION: HydrationSettings = {
  bodyWeightKg: 75,
  useWeightBased: true,
  baseWaterL: 2.6,
  sweatTests: { outdoor24: null, outdoor28: null, rolle: null },
};

const DEFAULTS: Habit[] = [
  { id:"h1", name:"4L Wasser",    emoji:"💧", color:"#3b82f6", habitType:"numeric",  unit:"L",  numTarget:4, goalType:"daily",       goalValue:1  },
  { id:"h2", name:"Alkohol",      emoji:"🍺", color:"#ef4444", habitType:"numeric",  unit:"SD", numTarget:0.1, goalType:"max_per_days", goalValue:14 },
  { id:"h3", name:"Sport 30 min", emoji:"🏃", color:"#10b981", habitType:"checkbox", unit:"",   numTarget:0, goalType:"min_per_week", goalValue:5  },
];
const COLORS = ["#3b82f6","#10b981","#ef4444","#8b5cf6","#f43f5e","#f59e0b","#84cc16","#06b6d4","#94a3b8"];
const EMOJIS = ["💧","🍺","🏃","🧠","❤️","🌙","🍎","💊","🔥","🚶","🛌","💪","☕","📚","🌿","🚫","✏️","😴"];
const MOOD_E = ["😴","😟","😐","😊","🔥"];
const MOOD_L = ["Sehr schlecht","Schlecht","Okay","Gut","Ausgezeichnet"];

/* ── intervals.icu Befinden-Felder ──
   Jede Option trägt ihren intervals-Wert v (1–4) explizit, damit die
   Anzeige-Reihenfolge unabhängig von der Kodierung ist.
   Farbe = Wert: grün(1)=bestes … rot(4)=schlechtestes.
   Bei Motivation steht "Extrem" rechts (=intensivste Stufe wie bei den
   anderen Zeilen), behält aber den korrekten intervals-Wert 1.
   Hydration wird NICHT manuell erfasst → automatisch aus Wasser/Ziel in doSync(). */
const IV_WELLNESS_FIELDS = [
  { key:"soreness",   label:"Muskelkater", opts:[{l:"Niedrig",v:1},{l:"Mittel",v:2},{l:"Hoch",v:3},{l:"Extrem",v:4}]   },
  { key:"fatigue",    label:"Müdigkeit",   opts:[{l:"Niedrig",v:1},{l:"Mittel",v:2},{l:"Hoch",v:3},{l:"Extrem",v:4}]   },
  { key:"stress",     label:"Stress",      opts:[{l:"Niedrig",v:1},{l:"Mittel",v:2},{l:"Hoch",v:3},{l:"Extrem",v:4}]   },
  { key:"motivation", label:"Motivation",  opts:[{l:"Niedrig",v:4},{l:"Mittel",v:3},{l:"Hoch",v:2},{l:"Extrem",v:1}]   },
  { key:"injury",     label:"Verletzung",  opts:[{l:"Keine",v:1},{l:"Zwicken",v:2},{l:"Schlecht",v:3},{l:"Verletzt",v:4}] },
] as const;
const IV_OPT_COLORS = ["#10b981","#3b82f6","#f59e0b","#ef4444"]; // v1→v4
/* Hydration (subjektiv, 1–4) aus erreichtem Anteil des Wasserziels */
function hydrationFromRatio(ratio: number): number {
  if (ratio >= 1.0) return 1; // Good
  if (ratio >= 0.8) return 2; // OK
  if (ratio >= 0.6) return 3; // Poor
  return 4;                   // Bad
}
/* Dashboard-Stimmung (1–5, 1=schlecht) → intervals mood (1=GREAT … 4=GRUMPY) */
function moodTo4(m: number): number {
  return ({ 5:1, 4:2, 3:3, 2:4, 1:4 } as Record<number, number>)[m] ?? 3;
}
const NUTRI_FIELDS = [
  { key:"kcal"    as const, label:"Kalorien", unit:"kcal", step:10 },
  { key:"carbs"   as const, label:"Carbs",    unit:"g",    step:5  },
  { key:"protein" as const, label:"Protein",  unit:"g",    step:5  },
];
const DOW    = ["Mo","Di","Mi","Do","Fr","Sa","So"];
const PERIODS: { id: Period; label: string }[] = [
  { id:"4w", label:"4 Wochen" }, { id:"3m", label:"3 Monate" },
  { id:"6m", label:"6 Monate" }, { id:"1j", label:"1 Jahr"   },
];

const TICK_STYLE    = { fill:"#94a3b8", fontSize:10 } as const;
const TOOLTIP_STYLE = { backgroundColor:"#131929", border:"1px solid #1e2d4a", borderRadius:8, fontSize:11 } as const;
const MOOD_COLORS   = ["transparent","#ef4444","#f59e0b","#94a3b8","#3b82f6","#10b981"];
const GRID_COL      = { display:"grid", gridTemplateColumns:"repeat(7, 16px)", gap:"3px" } as const;
const VESSEL_SIZES  = [0.2, 0.3, 0.7];
/* Standarddrinks nach Getränketyp (SD = 10g reiner Alkohol) */
const DRINK_BUTTONS = [
  { label:"0,2L Bier",  sd:0.6 },
  { label:"0,33L Bier", sd:1.0 },
  { label:"0,5L Bier",  sd:1.5 },
  { label:"Shot",       sd:1.3 },
  { label:"Mische",     sd:1.5 },
  { label:"Cocktail",   sd:1.3 },
];
/* Standarddrinks berechnen und formatieren */
function calcDrinkSD(drinks: Record<string,number>): number {
  return Math.round(DRINK_BUTTONS.reduce((s,d)=>s+(drinks[d.label]||0)*d.sd,0)*10)/10;
}
function formatDrinkLabel(drinks: Record<string,number>): string {
  const parts=DRINK_BUTTONS.filter(d=>(drinks[d.label]||0)>0).map(d=>`${drinks[d.label]}× ${d.label}`);
  if(!parts.length)return"";
  return`${parts.join(", ")} (${calcDrinkSD(drinks)} SD)`;
}

/* ── Rehydration nach Alkohol (Bänder: 1–3 / 4–6 / >6 SD) ──
   max = obere SD-Grenze des Bandes; das erste passende Band gewinnt. */
const REHYDRATION = [
  { max:3,        band:"1–3 SD", during:"300 ml", lastPortion:"200 ml + 0,5 g Salz", morning:"500 ml + 0,5 g Salz",     ride:"normal" },
  { max:6,        band:"4–6 SD", during:"500 ml", lastPortion:"300 ml + 0,5 g Salz", morning:"750 ml + 1 g Salz",       ride:"+250 ml/h erste Stunde" },
  { max:Infinity, band:">6 SD",  during:"750 ml", lastPortion:"500 ml + 1 g Salz",   morning:"1000–1500 ml + 1,5 g Salz", ride:"+500 ml + 1 g Salz erste Stunde" },
] as const;
function rehydrationFor(sd: number){ return REHYDRATION.find(r=>sd<=r.max)!; }

/* ══════════════════════════════════════
   HYDRATION — Wissenschaftlich korrigierte Formeln
   Quellen: ACSM, Journal of Applied Physiology (2024), Gatorade SSI
   Temperatur = Multiplikator auf Schweißrate (kein Flatbetrag)
   Zwift/Rolle > Outdoor wegen fehlendem Fahrtwind
══════════════════════════════════════ */
const SWEAT_RATES: Record<string, number> = {
  Run:1.0, VirtualRun:1.1, TrailRun:1.1,
  Ride:0.8, VirtualRide:1.1, MountainBikeRide:0.9, GravelRide:0.85,
  Swim:0.35, Walk:0.45, Hike:0.55,
  WeightTraining:0.6, Workout:0.65, Crossfit:0.8,
  Soccer:1.0, Basketball:0.9, Tennis:0.75, Rowing:0.85,
};

function tempMultiplier(tempC: number): number {
  if (tempC <= 10) return 0.50;
  if (tempC <= 20) return 0.50 + (tempC - 10) * 0.025;
  if (tempC <= 25) return 0.75 + (tempC - 20) * 0.05;
  if (tempC <= 30) return 1.00 + (tempC - 25) * 0.10;
  if (tempC <= 35) return 1.50 + (tempC - 30) * 0.30;
  return 3.00 + (tempC - 35) * 0.20;
}

function intensityFactor(loadPerHour: number): number {
  if (loadPerHour <= 30)  return 0.70;
  if (loadPerHour <= 70)  return 0.70 + (loadPerHour - 30)  / 40  * 0.30;
  if (loadPerHour <= 120) return 1.00 + (loadPerHour - 70)  / 50  * 0.25;
  if (loadPerHour <= 200) return 1.25 + (loadPerHour - 120) / 80  * 0.25;
  return Math.min(1.75 + (loadPerHour - 200) / 100 * 0.25, 2.0);
}

function getTempBaseBonus(tempC: number): number {
  if (tempC < 20) return 0.0;
  if (tempC < 25) return 0.1;
  if (tempC < 30) return 0.2;
  if (tempC < 35) return 0.3;
  return 0.5;
}

function getSweatRateL(
  type: string,
  loadPerHour: number,
  tempC: number,
  tests: HydrationSettings["sweatTests"],
): number {
  const isIndoor = type === "VirtualRide" || type === "VirtualRun";
  const lf = intensityFactor(loadPerHour);

  if (isIndoor && tests.rolle !== null) return (tests.rolle / 1000) * lf;

  if (tests.outdoor24 !== null && tests.outdoor28 !== null) {
    const slope = (tests.outdoor28 - tests.outdoor24) / (28 - 24);
    const rateMlH = tests.outdoor24 + slope * (tempC - 24);
    return (Math.max(300, rateMlH) / 1000) * lf;
  }

  if (tests.outdoor24 !== null) {
    const rateMlH = tests.outdoor24 * tempMultiplier(tempC) / tempMultiplier(24);
    return (Math.max(300, rateMlH) / 1000) * lf;
  }

  const base = SWEAT_RATES[type] ?? 0.7;
  return base * tempMultiplier(tempC) * lf;
}

function calibLabel(tests: HydrationSettings["sweatTests"]): string {
  const { outdoor24, outdoor28, rolle } = tests;
  if (outdoor24 && outdoor28 && rolle) return "vollständig kalibriert";
  if (outdoor24 && outdoor28)          return "kalibriert (2 Tests, interpoliert)";
  if (outdoor24)                       return "kalibriert (1 Test, extrapoliert)";
  return "Schätzwerte (kein Test)";
}

/* ─────────────── Proxy-Fetch für intervals.icu (umgeht CORS) ─────────────── */
async function ivFetch(path: string, apiKey: string): Promise<unknown> {
  const res = await fetch(`/api/iv-proxy?path=${encodeURIComponent(path)}`, {
    headers: { "x-iv-key": apiKey },
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err?.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

/* ─────────────── Utils ─────────────── */
function toDS(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function daysAgo(n: number): string { const d=new Date(); d.setDate(d.getDate()-n); return toDS(d); }
function fromDS(s: string): Date { const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); }
function todayStr(): string { return toDS(new Date()); }

function normalizeDay(raw: unknown): DayData {
  if (!raw) return { checked:[], numeric:{}, mood:null, drinks:{} };
  if (Array.isArray(raw)) return { checked:raw as string[], numeric:{}, mood:null, drinks:{} };
  const r = raw as Partial<DayData>;
  return { checked:r.checked||[], numeric:r.numeric||{}, mood:r.mood??null, drinks:r.drinks||{}, dynamicTargets:r.dynamicTargets, wellness:r.wellness, nutrition:r.nutrition };
}
function isCompleted(h: Habit, date: string, history: History): boolean {
  const day = normalizeDay(history[date]);
  if (h.habitType==="numeric") {
    // SD-Habits: auch alte Checkbox-Einträge als "hatte Alkohol" werten (Rückwärtskompatibilität)
    if (h.unit.toLowerCase()==="sd" && day.checked.includes(h.id)) return true;
    const v=day.numeric[h.id]; return v!==undefined && v>=h.numTarget;
  }
  return day.checked.includes(h.id);
}
function calcStreak(h: Habit, history: History): number {
  const start=isCompleted(h,todayStr(),history)?0:1; let s=0;
  for(let i=start;i<365;i++){if(!isCompleted(h,daysAgo(i),history))break;s++;} return s;
}
function calcWeekCount(h: Habit, history: History): number {
  const dow=(new Date().getDay()+6)%7; let c=0;
  for(let i=0;i<=dow;i++){if(isCompleted(h,daysAgo(i),history))c++;} return c;
}
function calcLastDone(h: Habit, history: History): number | null {
  for(let i=0;i<90;i++){if(isCompleted(h,daysAgo(i),history))return i;} return null;
}
function periodDays(p: Period): number {
  if(p==="4w")return 28; if(p==="3m")return 90; if(p==="6m")return 180; return 365;
}
function periodRate(h: Habit, history: History, p: Period): number {
  const days=periodDays(p); let c=0,total=0;
  for(let i=0;i<days;i++){const ds=daysAgo(i);if(ds<=todayStr()){total++;if(isCompleted(h,ds,history))c++;}}
  return total>0?Math.round(c/total*100):0;
}
function buildPeriodData(h: Habit, history: History, p: Period) {
  if(p==="4w")return null;
  const days=periodDays(p),gran=(p==="3m"||p==="6m")?"week":"month";
  if(gran==="week"){
    const weeks=Math.ceil(days/7);
    return Array.from({length:weeks},(_,w)=>{
      const wi=weeks-1-w; let c=0;
      for(let d=0;d<7;d++){if(isCompleted(h,daysAgo(wi*7+d),history))c++;}
      return{label:`-${(wi+1)*7}d`,value:Math.round(c/7*100)};
    });
  }
  const result=[];
  for(let m=11;m>=0;m--){
    const date=new Date();date.setDate(1);date.setMonth(date.getMonth()-m);
    const ms=new Date(date.getFullYear(),date.getMonth(),1);
    const dim=new Date(date.getFullYear(),date.getMonth()+1,0).getDate();
    let c=0,total=0;
    for(let d=0;d<dim;d++){const dd=new Date(ms);dd.setDate(d+1);if(toDS(dd)<=todayStr()){total++;if(isCompleted(h,toDS(dd),history))c++;}}
    result.push({label:date.toLocaleDateString("de-DE",{month:"short",year:"2-digit"}),value:total>0?Math.round(c/total*100):0});
  }
  return result;
}

function HabitGrid({ habit, history, today, onToggle }: {
  habit: Habit; history: History; today: string; onToggle?: (date: string)=>void;
}) {
  const now=new Date(),dow=(now.getDay()+6)%7;
  const start=new Date(now);start.setDate(now.getDate()-dow-21);
  const cells=Array.from({length:28},(_,i)=>{
    const d=new Date(start);d.setDate(start.getDate()+i);
    const ds=toDS(d),done=isCompleted(habit,ds,history);
    const isFut=ds>today,isTod=ds===today,clickable=!!onToggle&&!isFut;
    return(<div key={ds} title={`${ds}${done?" ✓":""}`} onClick={clickable?()=>onToggle!(ds):undefined}
      style={{width:16,height:16,borderRadius:3,background:done?habit.color:isFut?"transparent":"rgba(30,45,74,0.4)",
        border:isTod?"2px solid #94a3b8":"0.5px solid rgba(30,45,74,0.8)",
        boxSizing:"border-box",cursor:clickable?"pointer":"default",opacity:isFut?0.2:1,transition:"opacity 0.15s"}}/>);
  });
  return(
    <div className="mt-3">
      <div style={{...GRID_COL,marginBottom:3}}>{DOW.map(d=><div key={d} style={{width:16,textAlign:"center",fontSize:9,color:"#94a3b8",opacity:0.4}}>{d}</div>)}</div>
      <div style={GRID_COL}>{cells}</div>
      {onToggle&&<p className="text-[9px] text-dash-muted/40 mt-1">Kästchen anklicken zum Umschalten</p>}
    </div>
  );
}

/* ══════════════════════════════════════
   SERVER SYNC HELPERS
══════════════════════════════════════ */
async function loadFromServer(): Promise<{habits?:Habit[];history?:History;settings?:Partial<HabitSettings>;hydrationSettings?:Partial<HydrationSettings>}|null> {
  try {
    const r = await fetch("/api/habits", { cache:"no-store" });
    if (!r.ok) return null;
    const data = await r.json();
    if (Object.keys(data).length === 0) return null;
    return data;
  } catch { return null; }
}
async function saveToServer(habits: Habit[], history: History, settings: HabitSettings, hydrationSettings: HydrationSettings): Promise<boolean> {
  try {
    const r = await fetch("/api/habits", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ habits, history, settings, hydrationSettings }),
    });
    return r.ok;
  } catch { return false; }
}

/* ══ MAIN PAGE ══ */
export default function HabitsPage() {
  const [habits,            setHabits]            = useState<Habit[]>([]);
  const [history,           setHistory]           = useState<History>({});
  const [settings,          setSettings]          = useState<HabitSettings>({
    ivAthleteId:"", ivApiKey:"", notifEnabled:false, notifTime:"22:00",
    autoSync:false, lastSync:null, latitude:null, longitude:null, locationName:"",
  });
  const [hydrationSettings, setHydrationSettings] = useState<HydrationSettings>(DEFAULT_HYDRATION);
  const [dynamicTargets,    setDynamicTargets]    = useState<Record<string,number>>({});
  const [dynamicInfo,       setDynamicInfo]       = useState<Record<string,string>>({});
  const [hydrationDebug,    setHydrationDebug]    = useState<string>("");
  const [tab,               setTab]               = useState<Tab>("today");
  const [statsSub,          setStatsSub]          = useState<"stats"|"corr">("stats");
  const [statsPeriod,       setStatsPeriod]       = useState<Period>("4w");
  const [selDate,           setSelDate]           = useState(todayStr());
  const [form,              setForm]              = useState<(Partial<Habit>&{error?:string})|null>(null);
  const [delId,             setDelId]             = useState<string|null>(null);
  const [syncMsg,           setSyncMsg]           = useState("");
  const [syncAllMsg,        setSyncAllMsg]        = useState("");
  const [syncAllRunning,    setSyncAllRunning]    = useState(false);
  const [loaded,            setLoaded]            = useState(false);
  const [syncState,         setSyncState]         = useState<"idle"|"saving"|"saved"|"offline">("idle");

  const saveTimer        = useRef<ReturnType<typeof setTimeout>>(undefined);
  const initialLoadDone  = useRef(false); // verhindert sofortiges Überschreiben nach Server-Load

  /* ── Laden: Server primär, localStorage als Notfall-Backup ── */
  useEffect(()=>{
    const load = async () => {
      setSyncState("saving");
      const serverData = await loadFromServer();
      if (serverData) {
        // Server liefert Daten → Server gewinnt immer
        if (serverData.habits) setHabits(serverData.habits);
        else                   setHabits(DEFAULTS);
        if (serverData.history) {
          const norm: History = {};
          for (const [k,v] of Object.entries(serverData.history)) norm[k] = normalizeDay(v);
          setHistory(norm);
        }
        if (serverData.settings) setSettings(p=>({...p,...serverData.settings}));
        if (serverData.hydrationSettings) {
          setHydrationSettings(prev => ({
            ...prev, ...serverData.hydrationSettings,
            sweatTests: { ...prev.sweatTests, ...serverData.hydrationSettings!.sweatTests },
          }));
        }
        // Serverdaten in localStorage spiegeln (für Notfall)
        localStorage.setItem("ht_habits",    JSON.stringify(serverData.habits ?? DEFAULTS));
        if (serverData.history)           localStorage.setItem("ht_history",   JSON.stringify(serverData.history));
        if (serverData.settings)          localStorage.setItem("ht_settings",  JSON.stringify(serverData.settings));
        if (serverData.hydrationSettings) localStorage.setItem("ht_hydration", JSON.stringify(serverData.hydrationSettings));
        setSyncState("saved");
      } else {
        // Server nicht erreichbar → localStorage-Backup laden (schreibgeschützt)
        try { const h=JSON.parse(localStorage.getItem("ht_habits")||"null"); if(h)setHabits(h); else setHabits(DEFAULTS); } catch { setHabits(DEFAULTS); }
        try {
          const raw=JSON.parse(localStorage.getItem("ht_history")||"{}") as Record<string,unknown>;
          const norm:History={};
          for(const[k,v]of Object.entries(raw)) norm[k]=normalizeDay(v);
          setHistory(norm);
        } catch { setHistory({}); }
        try { const s=JSON.parse(localStorage.getItem("ht_settings")||"{}") as Partial<HabitSettings>; setSettings(p=>({...p,...s})); } catch {}
        try {
          const h=JSON.parse(localStorage.getItem("ht_hydration")||"null");
          if(h) setHydrationSettings(prev=>({...prev,...h,sweatTests:{...prev.sweatTests,...h.sweatTests}}));
        } catch {}
        setSyncState("offline");
      }
      setLoaded(true);
    };
    load();
  },[]);

  /* ── Speichern: Server primär + localStorage als Spiegel ── */
  useEffect(()=>{
    if (!loaded) return;
    if (!initialLoadDone.current) { initialLoadDone.current = true; return; }
    // localStorage parallel aktualisieren (Notfall-Backup)
    localStorage.setItem("ht_habits",    JSON.stringify(habits));
    localStorage.setItem("ht_history",   JSON.stringify(history));
    localStorage.setItem("ht_settings",  JSON.stringify(settings));
    localStorage.setItem("ht_hydration", JSON.stringify(hydrationSettings));
    clearTimeout(saveTimer.current);
    setSyncState("saving");
    saveTimer.current = setTimeout(async () => {
      const ok = await saveToServer(habits, history, settings, hydrationSettings);
      setSyncState(ok ? "saved" : "offline");
    }, 800);
  },[habits, history, settings, hydrationSettings, loaded]);

  /* ── Notifications ── */
  useEffect(()=>{
    if(!loaded||!settings.notifEnabled||typeof Notification==="undefined"||Notification.permission!=="granted")return;
    const[hh,mm]=settings.notifTime.split(":").map(Number);
    const now=new Date(),target=new Date(now);target.setHours(hh,mm,0,0);
    if(target<=now)target.setDate(target.getDate()+1);
    const tid=window.setTimeout(async()=>{
      const td=todayStr(),done=habits.filter(h=>isCompleted(h,td,history)).length;
      if(done<habits.length)new Notification("Habit Tracker",{body:`${done}/${habits.length} Habits erledigt 📋`,tag:"ht"});
      if(settings.autoSync)await doSync(td);
    },target.getTime()-now.getTime());
    return()=>clearTimeout(tid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[settings.notifEnabled,settings.notifTime,settings.autoSync,loaded]);

  /* ── Dynamisches Hydrationsziel ── */
  useEffect(()=>{
    if(!loaded) return;
    // Wenn keine IV-Credentials: nur Basis + Temperatur berechnen
    const waterHabits = habits.filter(h =>
      h.habitType==="numeric" && ["l","liter"].includes(h.unit.toLowerCase())
    );
    if(!waterHabits.length) return;

    const run = async () => {
      const debugLines: string[] = [];

      // Basis-Wasserbedarf: immer mindestens der Habit-Zielwert (numTarget).
      // Die Gewichts-/Manualberechnung dient nur als Referenz im Tooltip,
      // kann den vom Nutzer gesetzten Wert aber nicht unterschreiten.
      const weightBase = hydrationSettings.useWeightBased
        ? Math.round(hydrationSettings.bodyWeightKg * 0.035 * 10) / 10
        : hydrationSettings.baseWaterL;

      // Temperatur (Open-Meteo) — immer Tageshöchstwert.
      // Heute: Vorhersage-Maximum (stabil ab Morgen, ändert sich kaum).
      // Vergangene Tage: tatsächliches Maximum (unveränderlich).
      // → Ziel ist damit für jeden Tag eindeutig und konsistent.
      let tempC = 18, tempSource = "Schätzwert (18°C)";
      if(settings.latitude!==null && settings.longitude!==null){
        try{
          const wr = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${settings.latitude}&longitude=${settings.longitude}&daily=temperature_2m_max&start_date=${selDate}&end_date=${selDate}&timezone=auto`,
            { cache:"no-store" }
          );
          if(wr.ok){
            const wd = await wr.json() as { daily?: { temperature_2m_max?: number[] } };
            if(wd.daily?.temperature_2m_max?.[0] !== undefined){
              tempC = wd.daily.temperature_2m_max[0];
              tempSource = `${tempC.toFixed(1)}°C Tageshöchst`;
            }
          }
        } catch(e) { debugLines.push(`⚠ Wetter-Fehler: ${e}`); }
      } else {
        debugLines.push("ℹ Kein Standort → Temperatur-Schätzwert 18°C");
      }
      debugLines.push(`Gewichts-Basis: ${weightBase} L · wird nur genutzt wenn > Habit-Zielwert`);
      debugLines.push(`Temperatur: ${tempSource} · Multiplikator: ×${tempMultiplier(tempC).toFixed(2)}`);

      // Aktivitäten (via Proxy um CORS zu vermeiden)
      // average_temp: vom Gerät aufgezeichnet (Garmin etc.) — präziseste Quelle
      // Fallback: tempC aus Open-Meteo Tageshöchstwert
      interface IvAct {
        type?: string; sport_type?: string; moving_time?: number;
        icu_training_load?: number; training_load_score?: number; name?: string;
        average_temp?: number; icu_average_temp?: number; temp?: number;
      }
      let acts: IvAct[] = [];

      if(settings.ivAthleteId && settings.ivApiKey){
        try{
          const path = `/athlete/${settings.ivAthleteId}/activities?oldest=${selDate}&newest=${selDate}`;
          const data = await ivFetch(path, settings.ivApiKey) as IvAct[];
          acts = Array.isArray(data) ? data : [];
          debugLines.push(`Aktivitäten gefunden: ${acts.length}`);
          acts.forEach(a => {
            const sport    = a.sport_type || a.type || "?";
            const minStr   = Math.round((a.moving_time||0)/60);
            const load     = a.icu_training_load || a.training_load_score || 0;
            const actTemp  = a.average_temp ?? a.icu_average_temp ?? a.temp;
            const tempStr  = actTemp != null ? `${actTemp.toFixed(1)}°C (Gerät)` : `${tempC.toFixed(1)}°C (Open-Meteo)`;
            debugLines.push(`  → ${sport} (${a.name||"–"}): ${minStr}min, Load=${load}, Temp=${tempStr}`);
          });
        } catch(e){
          debugLines.push(`⚠ IV-API Fehler: ${e}`);
        }
      } else {
        debugLines.push("ℹ Kein IV-API-Key → nur Basis + Temperatur");
      }

      // Ziel berechnen
      const newTargets: Record<string,number> = {};
      const newInfo:    Record<string,string>  = {};

      for(const h of waterHabits){
        let actExtra = 0;
        const actParts: string[] = [];

        for(const act of acts){
          const sport   = act.sport_type || act.type || "Workout";
          const movingH = (act.moving_time || 0) / 3600;
          const load    = act.icu_training_load || act.training_load_score || 0;
          const lph     = movingH > 0 ? load / movingH : 50;

          // Workout-Temperatur: Gerät hat Vorrang, sonst Open-Meteo Tageshöchst
          const actTemp  = act.average_temp ?? act.icu_average_temp ?? act.temp ?? null;
          const workoutT = actTemp ?? tempC;
          const tempLabel = actTemp != null
            ? `${actTemp.toFixed(1)}°C Gerät`
            : `${tempC.toFixed(1)}°C Open-Meteo`;

          const rateL   = getSweatRateL(sport, lph, workoutT, hydrationSettings.sweatTests);
          const extra   = Math.round(rateL * movingH * 10) / 10;
          actExtra += extra;
          if(extra > 0){
            actParts.push(
              `${sport} ${Math.round(movingH*60)}min @ ${tempLabel} (+${extra.toFixed(1)}L)`
            );
          }
        }

        const tempBonus = acts.length === 0 ? getTempBaseBonus(tempC) : 0;
        const baseWater = Math.max(h.numTarget, weightBase);
        const total     = Math.round((baseWater + actExtra + tempBonus) * 10) / 10;

        if (total > h.numTarget) newTargets[h.id] = total;

        const baseLabel = `Basis: ${baseWater} L (Habit: ${h.numTarget} L${weightBase > h.numTarget ? `, Gewicht: ${weightBase} L` : ""})`;
        const dayTempLabel = `🌡 Tag: ${tempSource}`;
        const parts = [baseLabel, dayTempLabel];
        actParts.forEach(p => parts.push(`Training: ${p}`));
        if(tempBonus > 0) parts.push(`Temp-Basiszuschlag: +${tempBonus.toFixed(1)}L`);
        parts.push(`📊 ${calibLabel(hydrationSettings.sweatTests)}`);
        parts.push(`→ Gesamt: ${total} L`);
        if (total > h.numTarget) newInfo[h.id] = parts.join(" · ");
      }

      setDynamicTargets(newTargets);
      setDynamicInfo(newInfo);
      setHydrationDebug(debugLines.join("\n"));
      // Dynamische Ziele in history speichern damit habits-sync sie für Notion verwenden kann
      if (Object.keys(newTargets).length > 0) {
        setHistory(prev => {
          const day = normalizeDay(prev[selDate]);
          const updated = { ...day, dynamicTargets: newTargets };
          return { ...prev, [selDate]: updated };
        });
      }
    };

    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[selDate, settings.ivAthleteId, settings.ivApiKey, settings.latitude, settings.longitude, habits, loaded, hydrationSettings]);

  const today=todayStr(),isToday=selDate===today;
  const day=useMemo(()=>normalizeDay(history[selDate]),[history,selDate]);
  const dayHabits=useMemo(()=>habits.filter(h=>!h.retroEvening),[habits]);
  const retroHabits=useMemo(()=>habits.filter(h=>!!h.retroEvening),[habits]);
  const prevDS=useMemo(()=>{const d=fromDS(selDate);d.setDate(d.getDate()-1);return toDS(d);},[selDate]);
  const prevLabel=useMemo(()=>fromDS(prevDS).toLocaleDateString("de-DE",{weekday:"short",day:"numeric",month:"long"}),[prevDS]);
  const doneCount=useMemo(()=>dayHabits.filter(h=>isCompleted(h,selDate,history)).length,[dayHabits,history,selDate]);
  const pct=dayHabits.length?doneCount/dayHabits.length:0;
  const selLabel=useMemo(()=>{const d=fromDS(selDate);return{dow:d.toLocaleDateString("de-DE",{weekday:"long"}),dat:d.toLocaleDateString("de-DE",{day:"numeric",month:"long",year:"numeric"})};},[selDate]);

  const prevDate=()=>{const d=fromDS(selDate);d.setDate(d.getDate()-1);setSelDate(toDS(d));};
  const nextDate=()=>{if(isToday)return;const d=fromDS(selDate);d.setDate(d.getDate()+1);setSelDate(toDS(d));};

  const toggle=useCallback((id:string)=>{
    setHistory(prev=>{const day=normalizeDay(prev[selDate]);const i=day.checked.indexOf(id);if(i>=0)day.checked.splice(i,1);else day.checked.push(id);return{...prev,[selDate]:day};});
  },[selDate]);
  const setNum=useCallback((id:string,raw:string|number)=>{
    const v=parseFloat(String(raw));
    setHistory(prev=>{const day=normalizeDay(prev[selDate]);if(isNaN(v))delete day.numeric[id];else day.numeric[id]=Math.max(0,Math.round(v*10)/10);return{...prev,[selDate]:day};});
  },[selDate]);
  const setMood=useCallback((val:number)=>{
    setHistory(prev=>{const day=normalizeDay(prev[selDate]);day.mood=day.mood===val?null:val;return{...prev,[selDate]:day};});
  },[selDate]);
  const setWellness=useCallback((key:string,val:number)=>{
    setHistory(prev=>{
      const day=normalizeDay(prev[selDate]);
      const w={...(day.wellness||{})};
      if(w[key]===val)delete w[key]; else w[key]=val;
      return{...prev,[selDate]:{...day,wellness:w}};
    });
  },[selDate]);
  const setNutrition=useCallback((key:"kcal"|"carbs"|"protein",raw:string)=>{
    const v=parseFloat(raw);
    setHistory(prev=>{
      const day=normalizeDay(prev[selDate]);
      const n={...(day.nutrition||{})};
      if(isNaN(v)||raw==="")delete n[key]; else n[key]=Math.max(0,Math.round(v));
      return{...prev,[selDate]:{...day,nutrition:n}};
    });
  },[selDate]);
  const setDrink=useCallback((habitId:string,drinkLabel:string,delta:number)=>{
    setHistory(prev=>{
      const day=normalizeDay(prev[selDate]);
      const hd={...(day.drinks[habitId]||{})};
      const next=Math.max(0,(hd[drinkLabel]||0)+delta);
      if(next===0)delete hd[drinkLabel]; else hd[drinkLabel]=next;
      day.drinks[habitId]=hd;
      // SD total auto-berechnen
      const sd=calcDrinkSD(hd);
      if(sd>0)day.numeric[habitId]=sd; else delete day.numeric[habitId];
      return{...prev,[selDate]:day};
    });
  },[selDate]);
  const toggleDate=useCallback((hb:Habit,date:string)=>{
    setHistory(prev=>{const day=normalizeDay(prev[date]);if(hb.habitType==="checkbox"){const i=day.checked.indexOf(hb.id);if(i>=0)day.checked.splice(i,1);else day.checked.push(hb.id);}else{if(day.numeric[hb.id]!==undefined)delete day.numeric[hb.id];else day.numeric[hb.id]=hb.numTarget;}return{...prev,[date]:day};});
  },[]);
  const setNumDate=useCallback((date:string,id:string,raw:string|number)=>{
    const v=parseFloat(String(raw));
    setHistory(prev=>{const day=normalizeDay(prev[date]);if(isNaN(v))delete day.numeric[id];else day.numeric[id]=Math.max(0,Math.round(v*10)/10);return{...prev,[date]:day};});
  },[]);
  const moveHabit=(id:string,dir:-1|1)=>{
    setHabits(prev=>{const i=prev.findIndex(h=>h.id===id),j=i+dir;if(j<0||j>=prev.length)return prev;const next=[...prev];[next[i],next[j]]=[next[j],next[i]];return next;});
  };

  function badge(h:Habit):string{
    if(h.goalType==="daily"){const s=calcStreak(h,history);return`🔥 ${s} ${s===1?"Tag":"Tage"} Streak`;}
    if(h.goalType==="min_per_week"){const c=calcWeekCount(h,history),ok=c>=h.goalValue;return`${c}/${h.goalValue} diese Woche${ok?" ✓":""}`;}
    const l=calcLastDone(h,history);if(l===null)return"Noch nie ✓";return`${l===0?"Heute":l+" Tage her"} ${l>=h.goalValue?"✓":"⚠"}`;
  }

  const openAdd=()=>setForm({id:"",name:"",emoji:"💧",color:"#3b82f6",habitType:"checkbox",unit:"",numTarget:0,goalType:"daily",goalValue:3,retroEvening:false});
  const openEdit=(h:Habit)=>{setForm({...h});setDelId(null);};
  const saveForm=()=>{
    if(!form)return;
    if(!form.name?.trim()){setForm(f=>f?{...f,error:"Name fehlt"}:null);return;}
    const entry:Habit={id:form.id||"h"+Date.now(),name:form.name.trim(),emoji:form.emoji||"💧",color:form.color||COLORS[0],habitType:form.habitType||"checkbox",unit:form.unit||"",numTarget:form.numTarget||0,goalType:form.goalType||"daily",goalValue:form.goalValue||1,retroEvening:!!form.retroEvening};

    // Migration: Checkbox → Numerisch
    // Alle Tage wo das Habit als "checked" eingetragen war → numeric-Wert setzen
    if(form.id && form.habitType==="numeric") {
      const oldHabit = habits.find(h=>h.id===form.id);
      if(oldHabit?.habitType==="checkbox") {
        setHistory(prev=>{
          const next={...prev};
          for(const [date,raw] of Object.entries(next)){
            const day=normalizeDay(raw);
            if(day.checked.includes(form.id!) && day.numeric[form.id!]===undefined){
              day.numeric[form.id!]=Math.max(entry.numTarget,0.1);
              next[date]=day;
            }
          }
          return next;
        });
      }
    }

    setHabits(prev=>form.id?prev.map(h=>h.id===form.id?entry:h):[...prev,entry]);
    setForm(null);
  };

  const doSync=async(date:string):Promise<{ok:boolean;error?:string}>=>{
    const d=normalizeDay(history[date]);
    const tags=habits.filter(h=>d.checked.includes(h.id)).map(h=>h.name.replace(/\s+/g,"_"));
    const nums=habits.filter(h=>h.habitType==="numeric"&&d.numeric[h.id]!==undefined).map(h=>{
      if(h.unit.toLowerCase()==="sd"){
        const label=formatDrinkLabel(d.drinks[h.id]||{});
        return label?`${h.name}: ${label}`:`${h.name}: ${d.numeric[h.id]} SD`;
      }
      return`${h.name}: ${d.numeric[h.id]} ${h.unit}`;
    }).join(", ");

    // Wasser-Habit (Einheit L) → hydrationVolume in Litern
    const waterHabit=habits.find(h=>h.habitType==="numeric"&&["l","liter"].includes(h.unit.toLowerCase()));
    const waterL=waterHabit?d.numeric[waterHabit.id]:undefined;

    const payload:Record<string,unknown>={ id:date };
    // intervals.icu unterstützt kein "tags"-Feld → gecheckte Habits in comments einbauen
    const commentParts=[
      tags.length>0?tags.join(", "):null,
      nums||null,
    ].filter(Boolean).join(" | ");
    if(commentParts) payload.comments=`Habit Tracker – ${commentParts}`;
    if(d.mood!==null) payload.mood=moodTo4(d.mood);                        // 5-Stufen → intervals 1–4

    // Subjektive Befinden-Felder (1–4, 1 = bestes)
    for(const f of IV_WELLNESS_FIELDS){
      const v=d.wellness?.[f.key];
      if(v!==undefined&&v>=1&&v<=4) payload[f.key]=v;
    }

    // Hydration: Volumen (Liter) + subjektiver Wert (1–4) automatisch aus erreichtem Zielanteil
    if(waterHabit&&waterL!==undefined&&waterL>0){
      payload.hydrationVolume=waterL;
      const target=d.dynamicTargets?.[waterHabit.id] ?? waterHabit.numTarget;
      if(target>0) payload.hydration=hydrationFromRatio(waterL/target);
    }
    if(d.nutrition?.kcal!==undefined)       payload.kcalConsumed   =d.nutrition.kcal;
    if(d.nutrition?.carbs!==undefined)      payload.carbohydrates  =d.nutrition.carbs;
    if(d.nutrition?.protein!==undefined)    payload.protein        =d.nutrition.protein;

    // Serverseitig syncen (umgeht Browser-CORS, nutzt INTERVALS_API_KEY aus .env.local)
    try{
      const res=await fetch("/api/wellness-sync",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ date, payload }),
        cache:"no-store",
      });
      if(!res.ok){
        const j=await res.json().catch(()=>({})) as {error?:string};
        return { ok:false, error:j.error ?? `HTTP ${res.status}` };
      }
      setSettings(s=>({...s,lastSync:new Date().toISOString()}));
      return { ok:true };
    }catch(e){ return { ok:false, error:String(e) }; }
  };

  const corrData=useMemo(()=>Array.from({length:12},(_,w)=>{
    const obj:Record<string,unknown>={label:`W-${(11-w)*7}d`};
    habits.forEach(h=>{let c=0;for(let d=0;d<7;d++){if(isCompleted(h,daysAgo((11-w)*7+d),history))c++;}obj[h.name]=Math.round(c/7*100);});
    return obj;
  }),[habits,history]);

  const exportCSV=()=>{
    const heads=["Datum","Stimmung",...habits.map(h=>h.name)];
    const rows=Object.keys(history).sort().map(date=>{const d=normalizeDay(history[date]);const vals=habits.map(h=>h.habitType==="numeric"?(d.numeric[h.id]??""):(d.checked.includes(h.id)?1:0));return[date,d.mood??"",...vals].join(",");});
    dl(`habits-${today}.csv`,[heads.join(","),...rows].join("\n"),"text/csv");
  };
  const exportJSON=()=>dl(`habits-${today}.json`,JSON.stringify({habits,history},null,2),"application/json");
  function dl(name:string,content:string,type:string){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();}
  const geocodeLocation = async () => {
    const name = settings.locationName.trim();
    if (!name) return;
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=de&format=json`
      );
      if (!res.ok) return;
      const data = await res.json() as { results?: { latitude: number; longitude: number; name: string; country: string }[] };
      const r = data.results?.[0];
      if (r) {
        setSettings(s => ({
          ...s,
          latitude:     Math.round(r.latitude  * 1000) / 1000,
          longitude:    Math.round(r.longitude * 1000) / 1000,
          locationName: `${r.name}, ${r.country}`,
        }));
      }
    } catch { /* silent */ }
  };

  const setSweatTest = (key: keyof HydrationSettings["sweatTests"], val: string) => {
    const n = parseFloat(val);
    setHydrationSettings(prev => ({
      ...prev,
      sweatTests: { ...prev.sweatTests, [key]: isNaN(n) || val === "" ? null : Math.round(n) },
    }));
  };

  const syncIndicator = {
    idle:    "",
    saving:  "Speichern…",
    saved:   "✓ Gespeichert",
    offline: "⚠ Server nicht erreichbar",
  }[syncState];

  if(!loaded)return(
    <div className="p-6 space-y-2">
      <div className="text-dash-muted text-sm animate-pulse">Lade Daten vom Server…</div>
      <div className="text-[11px] text-dash-muted/50">Lädt nicht? Server prüfen: docker ps | grep intervals</div>
    </div>
  );

  return(
    <>
      <header className="sticky top-0 z-10 bg-dash-bg/95 backdrop-blur border-b border-dash-border px-3 sm:px-6 py-3 flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-sm font-semibold text-white flex items-center gap-2">
          <CheckSquare size={14} style={{color:"var(--a-600)"}}/>Habit Tracker
          {syncIndicator && <span className={clsx("text-[10px] font-normal", syncState==="offline"?"text-yellow-400":"text-dash-muted")}>{syncIndicator}</span>}
        </h1>
        <div className="flex items-center gap-1 flex-wrap">
          {(["today","stats","manage","settings"]as const).map(t=>{
            const labels:Record<Tab,string>={today:"Heute",stats:"Verlauf",manage:"Verwalten",settings:"Einstellungen"};
            return(<button key={t} onClick={()=>{setTab(t);setForm(null);setDelId(null);if(t==="today")setSelDate(todayStr());}}
              className={clsx("text-xs px-3 py-1.5 rounded-xl border transition-colors",tab===t?"text-white border-transparent":"text-dash-muted border-dash-border hover:text-white hover:border-indigo-500/50")}
              style={tab===t?{backgroundColor:"var(--a-600)"}:{}}>{labels[t]}</button>);
          })}
        </div>
      </header>

      <div className="p-3 sm:p-6 max-w-2xl mx-auto space-y-4">

        {/* ══ HEUTE ══ */}
        {tab==="today"&&(<>
          <div className="flex items-center justify-between p-3 rounded-2xl border border-dash-border bg-dash-card">
            <button onClick={prevDate} className="p-2 rounded-xl border border-dash-border text-dash-muted hover:text-white hover:border-indigo-500/50 transition-colors"><ChevronLeft size={15}/></button>
            <div className="text-center cursor-pointer group relative" onClick={()=>(document.getElementById("ht-datepicker")as HTMLInputElement)?.showPicker()}>
              <p className="text-[11px] text-dash-muted">{selLabel.dow}{isToday&&<span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">Heute</span>}</p>
              <p className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors">{selLabel.dat} <span className="text-[10px] text-dash-muted/50">▾</span></p>
              <input id="ht-datepicker" type="date" value={selDate} max={today} onChange={e=>{if(e.target.value)setSelDate(e.target.value);}} className="sr-only"/>
            </div>
            <button onClick={nextDate} disabled={isToday} className="p-2 rounded-xl border border-dash-border text-dash-muted hover:text-white hover:border-indigo-500/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight size={15}/></button>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={async()=>{
                setSyncMsg("Synchronisiere…");
                const r=await doSync(selDate);
                setSyncMsg(r.ok?`✓ ${new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})} synchronisiert`:`✗ ${r.error||"Fehlgeschlagen"}`);
              }}
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border border-dash-border text-dash-muted hover:text-white hover:border-indigo-500/50 transition-colors">
              <RefreshCw size={12}/> {isToday?"Heute":"Diesen Tag"} → intervals.icu
            </button>
            <button
              disabled={syncAllRunning}
              onClick={async()=>{
                const dates=Object.keys(history).sort();
                if(dates.length===0){setSyncAllMsg("Keine Daten zum Synchronisieren.");return;}
                setSyncAllRunning(true);
                let ok=0,fail=0;
                for(let i=0;i<dates.length;i++){
                  setSyncAllMsg(`${i+1}/${dates.length} synchronisiert…`);
                  const r=await doSync(dates[i]);
                  if(r.ok) ok++; else fail++;
                  // kurze Pause damit die API nicht überlastet wird
                  await new Promise(res=>setTimeout(res,300));
                }
                setSyncAllMsg(`✓ ${ok} Tage synchronisiert${fail>0?` · ${fail} Fehler`:""}`);
                setSyncAllRunning(false);
              }}
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border border-dash-border text-dash-muted hover:text-white hover:border-indigo-500/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <RefreshCw size={12} className={syncAllRunning?"animate-spin":""}/> Alle Tage → intervals.icu
            </button>
            {syncMsg&&<span className="text-[11px] text-dash-muted">{syncMsg}</span>}
            {syncAllMsg&&<span className="text-[11px] text-dash-muted">{syncAllMsg}</span>}
          </div>

          <div className="flex items-center gap-2 p-3 rounded-2xl border border-dash-border bg-dash-card flex-wrap">
            <span className="text-[11px] text-dash-muted mr-1">Stimmung</span>
            {MOOD_E.map((e,i)=>(<button key={i} onClick={()=>setMood(i+1)} className={clsx("text-xl rounded-lg p-1 transition-all",day.mood===i+1?"scale-110 bg-white/10":"opacity-50 hover:opacity-100")} title={MOOD_L[i]}>{e}</button>))}
            {day.mood&&<span className="text-[11px] text-dash-muted ml-1">{MOOD_L[day.mood-1]}</span>}
          </div>

          {/* ── Befinden → intervals.icu (subjektive 1–4-Felder) ── */}
          <div className="rounded-2xl border border-dash-border bg-dash-card p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wider font-medium text-dash-muted">Befinden → intervals.icu</p>
              <span className="text-[10px] text-dash-muted/60">grün = bestes</span>
            </div>
            {IV_WELLNESS_FIELDS.map(f=>{
              const cur=day.wellness?.[f.key];
              return(
                <div key={f.key} className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-white w-[88px] flex-shrink-0">{f.label}</span>
                  <div className="flex gap-1 flex-wrap items-center">
                    {f.opts.map(o=>{
                      const active=cur===o.v;
                      return(
                        <button key={o.l} onClick={()=>setWellness(f.key,o.v)}
                          className={clsx("text-[11px] px-2.5 py-1 rounded-lg border transition-colors",
                            active?"text-white border-transparent":"text-dash-muted border-dash-border hover:text-white hover:border-indigo-500/40")}
                          style={active?{backgroundColor:IV_OPT_COLORS[o.v-1]}:{}}>
                          {o.l}
                        </button>
                      );
                    })}
                    {cur!==undefined&&<button onClick={()=>setWellness(f.key,cur)} title="Zurücksetzen" className="text-[11px] text-dash-muted/40 hover:text-red-400 px-1 transition-colors">✕</button>}
                  </div>
                </div>
              );
            })}
            <p className="text-[10px] text-dash-muted/50 pt-0.5">Hydration wird automatisch aus Wasser ÷ Tagesziel berechnet und mitgesynct.</p>
          </div>

          {/* ── Ernährung → intervals.icu ── */}
          <div className="rounded-2xl border border-dash-border bg-dash-card p-3.5 space-y-3">
            <p className="text-[11px] uppercase tracking-wider font-medium text-dash-muted">Ernährung → intervals.icu</p>
            <div className="grid grid-cols-3 gap-2">
              {NUTRI_FIELDS.map(n=>(
                <div key={n.key} className="space-y-1">
                  <label className="text-[11px] text-dash-muted block">{n.label} ({n.unit})</label>
                  <input type="number" min="0" step={n.step}
                    value={day.nutrition?.[n.key]??""} placeholder="0"
                    onChange={e=>setNutrition(n.key,e.target.value)}
                    onClick={e=>(e.target as HTMLInputElement).select()}
                    className="w-full px-2 py-1.5 text-sm bg-dash-bg border border-dash-border rounded-lg text-white text-center tabular-nums focus:outline-none focus:border-indigo-500 transition-colors"/>
                </div>
              ))}
            </div>
          </div>

          {dayHabits.length>0&&(<div className="flex items-center gap-3"><div className="flex-1 h-1.5 rounded-full bg-dash-card overflow-hidden border border-dash-border"><div className="h-full rounded-full bg-indigo-500 transition-all duration-300" style={{width:`${Math.round(pct*100)}%`}}/></div><span className="text-xs text-dash-muted tabular-nums">{doneCount}/{dayHabits.length}</span></div>)}
          {syncState==="offline"&&<div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">⚠ Server nicht erreichbar — Änderungen werden nicht gespeichert.<br/><span className="text-[11px] text-red-300/70">Container läuft? → docker ps | grep intervals</span></div>}
          {habits.length===0&&syncState!=="offline"&&<div className="rounded-2xl border border-dashed border-dash-border p-10 text-center text-dash-muted text-sm">Noch keine Habits.<br/>Im Tab <strong className="text-white">Verwalten</strong> anfangen.</div>}

          {dayHabits.map(hb=>{
            const done=isCompleted(hb,selDate,history),numVal=hb.habitType==="numeric"?(day.numeric[hb.id]??null):null;
            const isLUnit=["l","liter"].includes(hb.unit.toLowerCase());
            const isSDUnit=hb.unit.toLowerCase()==="sd";
            const effectiveTarget=dynamicTargets[hb.id]??hb.numTarget,isDynamic=!!dynamicTargets[hb.id];
            const isCheckbox=hb.habitType==="checkbox";
            return(
              <div key={hb.id}
                className={clsx(
                  "flex items-start gap-3 p-3.5 rounded-2xl border transition-all",
                  isCheckbox&&"cursor-pointer select-none items-center",
                  done
                    ? "shadow-sm"
                    : isCheckbox ? "opacity-55 hover:opacity-80" : ""
                )}
                style={{
                  borderColor: done ? hb.color+"90" : "#1e2d4a",
                  backgroundColor: done ? hb.color+"18" : "#0d1520",
                }}
                onClick={isCheckbox?()=>toggle(hb.id):undefined}
                role={isCheckbox?"checkbox":undefined} aria-checked={isCheckbox?done:undefined}
                tabIndex={isCheckbox?0:undefined}
                onKeyDown={isCheckbox?e=>{if(e.key==="Enter"||e.key===" ")toggle(hb.id);}:undefined}>
                <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-lg transition-all",!isCheckbox&&"mt-0.5")}
                  style={{
                    border:`2px solid ${hb.color}`,
                    background: done ? hb.color : "transparent",
                    color: done ? "#fff" : hb.color,
                    boxShadow: done ? `0 0 10px ${hb.color}50` : "none",
                  }}>
                  {done ? "✓" : hb.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={clsx("text-sm font-medium transition-colors", done?"text-white":"text-white/70")}>{hb.name}</p>
                  <p className="text-[11px] text-dash-muted">{badge(hb)}</p>
                </div>
                {hb.habitType==="numeric"&&!isSDUnit&&(
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0" onClick={e=>e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      <button onClick={()=>setNum(hb.id,Math.max(0,Math.round(((numVal??0)*10-5))/10))} className="w-7 h-7 rounded-lg border border-dash-border text-dash-muted hover:text-white text-base flex items-center justify-center transition-colors">−</button>
                      <input type="number" step="0.5" min="0" value={numVal??""} placeholder="0" onChange={e=>setNum(hb.id,e.target.value)} onClick={e=>(e.target as HTMLInputElement).select()} className="w-12 text-center text-sm bg-dash-bg border border-dash-border rounded-lg py-1 text-white tabular-nums focus:outline-none focus:border-indigo-500 transition-colors"/>
                      <button onClick={()=>setNum(hb.id,Math.round(((numVal??0)*10+5))/10)} className="w-7 h-7 rounded-lg border border-dash-border text-dash-muted hover:text-white text-base flex items-center justify-center transition-colors">+</button>
                      <span className="text-[11px] text-dash-muted whitespace-nowrap">
                        /{effectiveTarget} {hb.unit}
                        {isDynamic&&<span className="ml-1 text-indigo-300 cursor-help relative group/tip"> ⚡<span className="absolute right-0 bottom-5 z-10 hidden group-hover/tip:block w-72 bg-[#131929] border border-dash-border rounded-xl p-2 text-[10px] text-dash-muted leading-relaxed shadow-xl">{(dynamicInfo[hb.id]??"").split(" · ").map((p,i)=><span key={i} className="block">{p}</span>)}</span></span>}
                      </span>
                    </div>
                    {isLUnit&&(<div className="flex gap-1">{VESSEL_SIZES.map(amt=>(<button key={amt} onClick={()=>setNum(hb.id,Math.round(((numVal??0)+amt)*10)/10)} className="text-[10px] px-2 py-0.5 rounded-lg border border-dash-border text-dash-muted hover:text-white hover:border-indigo-500/40 transition-colors">+{amt*1000}ml</button>))}</div>)}
                  </div>
                )}
                {isSDUnit&&(()=>{
                  const hd=day.drinks[hb.id]||{};
                  const totalSD=calcDrinkSD(hd);
                  return(
                    <div className="flex flex-col items-end gap-2 flex-shrink-0" onClick={e=>e.stopPropagation()}>
                      {totalSD>0&&(
                        <span className="text-xs font-medium text-red-400">{totalSD.toFixed(1)} SD gesamt</span>
                      )}
                      <div className="flex flex-wrap gap-1 justify-end max-w-[230px]">
                        {DRINK_BUTTONS.map(d=>{
                          const cnt=hd[d.label]||0;
                          return(
                            <div key={d.label} className="flex items-center gap-0.5">
                              {cnt>0&&<button onClick={()=>setDrink(hb.id,d.label,-1)} className="w-4 h-4 text-[9px] rounded border border-red-500/30 text-red-400/60 hover:text-red-400 flex items-center justify-center transition-colors">−</button>}
                              <button onClick={()=>setDrink(hb.id,d.label,1)}
                                className={clsx("text-[10px] px-2 py-0.5 rounded-lg border transition-colors",
                                  cnt>0?"border-red-500/40 text-red-300 bg-red-500/10":"border-dash-border text-dash-muted hover:text-white hover:border-red-500/40"
                                )}>
                                {cnt>0?`${cnt}× ${d.label}`:`+ ${d.label}`}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      {totalSD>0&&(
                        <button onClick={()=>setHistory(prev=>{const day=normalizeDay(prev[selDate]);day.drinks[hb.id]={};delete day.numeric[hb.id];return{...prev,[selDate]:day};})}
                          className="text-[10px] text-red-400/40 hover:text-red-400 transition-colors">✕ Reset</button>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}

          {/* ── Rehydration nach Alkohol — aktualisiert sich automatisch beim SD-Bandwechsel ── */}
          {(()=>{
            const sdHabit=dayHabits.find(h=>h.habitType==="numeric"&&h.unit.toLowerCase()==="sd");
            if(!sdHabit) return null;
            const sd=calcDrinkSD(day.drinks[sdHabit.id]||{});
            if(sd<=0) return null;
            const r=rehydrationFor(sd);
            return(
              <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <p className="text-[11px] uppercase tracking-wider font-medium text-blue-300">💧 Rehydration nach Alkohol</p>
                  <span className="text-[11px] text-blue-300/80 tabular-nums">{sd.toFixed(1)} SD · {r.band}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
                  <div><p className="text-dash-muted">Während/nach dem Trinken</p><p className="text-white">{r.during}</p></div>
                  <div><p className="text-dash-muted">Letzte Portion (&gt;60 min vor Schlaf)</p><p className="text-white">{r.lastPortion}</p></div>
                  <div><p className="text-dash-muted">Morgen danach</p><p className="text-white">{r.morning}</p></div>
                  <div><p className="text-dash-muted">Vor Ride extra</p><p className="text-white">{r.ride}</p></div>
                </div>
              </div>
            );
          })()}
          {retroHabits.length>0&&(
            <div className="rounded-2xl border border-dash-border bg-dash-card p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wider font-medium text-dash-muted">🌙 Letzte Nacht</p>
                <span className="text-[10px] text-dash-muted">speichert auf {prevLabel}</span>
              </div>
              {retroHabits.map(hb=>{
                const rdone=isCompleted(hb,prevDS,history);
                const rNum=hb.habitType==="numeric"?(normalizeDay(history[prevDS]).numeric[hb.id]??null):null;
                return(
                  <div key={hb.id}
                    className={clsx("flex items-center gap-3 p-2.5 rounded-xl border bg-dash-bg/40 transition-colors",hb.habitType==="checkbox"&&"cursor-pointer select-none")}
                    style={{borderColor:rdone?hb.color+"60":undefined}}
                    onClick={hb.habitType==="checkbox"?()=>toggleDate(hb,prevDS):undefined}
                    role={hb.habitType==="checkbox"?"checkbox":undefined} aria-checked={hb.habitType==="checkbox"?rdone:undefined}
                    tabIndex={hb.habitType==="checkbox"?0:undefined}
                    onKeyDown={hb.habitType==="checkbox"?e=>{if(e.key==="Enter"||e.key===" ")toggleDate(hb,prevDS);}:undefined}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm" style={{border:`2px solid ${hb.color}`,background:rdone?hb.color:"transparent",color:rdone?"#fff":hb.color}}>{rdone?"✓":hb.emoji}</div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white">{hb.name}</p></div>
                    {hb.habitType==="numeric"&&(
                      <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e=>e.stopPropagation()}>
                        <button onClick={()=>setNumDate(prevDS,hb.id,Math.max(0,Math.round(((rNum??0)*10-5))/10))} className="w-7 h-7 rounded-lg border border-dash-border text-dash-muted hover:text-white text-base flex items-center justify-center transition-colors">−</button>
                        <input type="number" step="0.5" min="0" value={rNum??""} placeholder="0" onChange={e=>setNumDate(prevDS,hb.id,e.target.value)} onClick={e=>(e.target as HTMLInputElement).select()} className="w-12 text-center text-sm bg-dash-bg border border-dash-border rounded-lg py-1 text-white tabular-nums focus:outline-none focus:border-indigo-500 transition-colors"/>
                        <button onClick={()=>setNumDate(prevDS,hb.id,Math.round(((rNum??0)*10+5))/10)} className="w-7 h-7 rounded-lg border border-dash-border text-dash-muted hover:text-white text-base flex items-center justify-center transition-colors">+</button>
                        <span className="text-[11px] text-dash-muted whitespace-nowrap">/{hb.numTarget} {hb.unit}</span>
                      </div>
                    )}
                  </div>
                );
              })}
              <p className="text-[10px] text-dash-muted/60">Bezieht sich auf den Abend/die Nacht von {prevLabel} – wird auf diesen Verhaltens-Tag gespeichert, nicht auf {isToday?"heute":"den angezeigten Tag"}.</p>
            </div>
          )}
        </>)}

        {/* ══ VERLAUF ══ */}
        {tab==="stats"&&(<>
          <div className="flex gap-2 flex-wrap">
            {(["stats","corr"]as const).map(s=>(<button key={s} onClick={()=>setStatsSub(s)} className={clsx("text-xs px-3 py-1.5 rounded-xl border transition-colors",statsSub===s?"text-white border-transparent":"text-dash-muted border-dash-border hover:text-white")} style={statsSub===s?{backgroundColor:"var(--a-600)"}:{}}>{s==="stats"?"Statistiken":"Korrelation"}</button>))}
          </div>
          {statsSub==="stats"&&(<>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-dash-muted">Zeitraum:</span>
              {PERIODS.map(p=>(<button key={p.id} onClick={()=>setStatsPeriod(p.id)} className={clsx("text-xs px-3 py-1.5 rounded-xl border transition-colors",statsPeriod===p.id?"text-white border-transparent":"text-dash-muted border-dash-border hover:text-white")} style={statsPeriod===p.id?{backgroundColor:"var(--a-600)"}:{}}>{p.label}</button>))}
            </div>
            {habits.length===0&&<div className="rounded-2xl border border-dashed border-dash-border p-10 text-center text-dash-muted text-sm">Noch keine Habits vorhanden.</div>}
            {habits.map(hb=>{
              const rate=periodRate(hb,history,statsPeriod),streak=calcStreak(hb,history),wc=calcWeekCount(hb,history),ld=calcLastDone(hb,history);
              const chartData=buildPeriodData(hb,history,statsPeriod);
              let avgNum:number|null=null;
              if(hb.habitType==="numeric"){const days=periodDays(statsPeriod);let sum=0,cnt=0;for(let i=0;i<days;i++){const v=normalizeDay(history[daysAgo(i)]).numeric[hb.id];if(v!==undefined){sum+=v;cnt++;}}avgNum=cnt>0?Math.round(sum/cnt*10)/10:null;}
              return(
                <div key={hb.id} className="rounded-2xl border border-dash-border bg-dash-card p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0" style={{background:hb.color+"22"}}>{hb.emoji}</div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white">{hb.name}</p><p className="text-[11px] text-dash-muted">{hb.goalType==="daily"?"Täglich":hb.goalType==="min_per_week"?`Min. ${hb.goalValue}×/Woche`:`Max. alle ${hb.goalValue} Tage`}</p></div>
                    <div className="text-right flex-shrink-0"><p className="text-2xl font-bold tabular-nums" style={{color:hb.color}}>{rate}%</p><p className="text-[10px] text-dash-muted">{PERIODS.find(p=>p.id===statsPeriod)?.label}</p></div>
                  </div>
                  {statsPeriod==="4w"?(<HabitGrid habit={hb} history={history} today={today} onToggle={date=>toggleDate(hb,date)}/>):(
                    <div className="mt-3" style={{height:100}}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData||[]} margin={{top:0,right:0,left:-32,bottom:0}}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a"/><XAxis dataKey="label" tick={TICK_STYLE} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                          <YAxis tick={TICK_STYLE} tickLine={false} axisLine={false} domain={[0,100]} tickFormatter={v=>`${v}%`}/>
                          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{color:"#e2e8f0"}} formatter={(v:unknown)=>[`${v}%`,"Erfüllt"]}/>
                          <Bar dataKey="value" fill={hb.color} radius={[2,2,0,0]} opacity={0.85}/>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="flex gap-5 mt-3 pt-3 border-t border-dash-border flex-wrap">
                    {hb.goalType==="daily"&&<div><p className="text-lg font-bold tabular-nums text-white">{streak}</p><p className="text-[10px] text-dash-muted">Streak</p></div>}
                    {hb.goalType==="min_per_week"&&<div><p className="text-lg font-bold tabular-nums" style={{color:wc>=hb.goalValue?"#10b981":"#94a3b8"}}>{wc}/{hb.goalValue}</p><p className="text-[10px] text-dash-muted">diese Woche</p></div>}
                    {hb.goalType==="max_per_days"&&ld!==null&&<div><p className="text-lg font-bold tabular-nums" style={{color:ld>=hb.goalValue?"#10b981":"#ef4444"}}>{ld}</p><p className="text-[10px] text-dash-muted">Tage seit letztem</p></div>}
                    <div><p className="text-lg font-bold tabular-nums text-white">{Math.round(periodDays(statsPeriod)*rate/100)}</p><p className="text-[10px] text-dash-muted">von {periodDays(statsPeriod)} Tagen</p></div>
                    {avgNum!==null&&<div><p className="text-lg font-bold tabular-nums text-white">{avgNum}</p><p className="text-[10px] text-dash-muted">⌀ {hb.unit}/Tag</p></div>}
                  </div>
                </div>
              );
            })}
            {(()=>{const days28=Array.from({length:28},(_,i)=>({ds:daysAgo(27-i),m:normalizeDay(history[daysAgo(27-i)]).mood}));if(!days28.some(x=>x.m!==null))return null;return(<div className="rounded-2xl border border-dash-border bg-dash-card p-4"><p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-3">Stimmung – letzte 28 Tage</p><div style={{...GRID_COL,marginBottom:3}}>{DOW.map(d=><div key={d} style={{width:16,textAlign:"center",fontSize:9,color:"#94a3b8",opacity:0.4}}>{d}</div>)}</div><div style={GRID_COL}>{days28.map(({ds,m})=><div key={ds} title={`${ds}: ${m?MOOD_L[m-1]:"–"}`} style={{width:16,height:16,borderRadius:4,background:m?MOOD_COLORS[m]:"rgba(30,45,74,0.4)",opacity:m?1:0.4,border:"0.5px solid rgba(30,45,74,0.8)"}}/>)}</div><div className="flex flex-wrap gap-3 mt-3">{MOOD_E.map((e,i)=><span key={i} className="text-[10px] text-dash-muted">{e} {MOOD_L[i]}</span>)}</div></div>);})()}
            <p className="text-[10px] text-dash-muted text-center">Heute mit Rahmen markiert · Kästchen im 4-Wochen-Raster anklickbar</p>
          </>)}
          {statsSub==="corr"&&(<>
            <div className="rounded-2xl border border-dash-border bg-dash-card p-4">
              <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-4">Wochentag-Muster (12 Wochen)</p>
              <div className="flex gap-2 mb-2 ml-24">{DOW.map(d=><div key={d} className="w-5 text-[9px] text-dash-muted/40 text-center">{d}</div>)}</div>
              {habits.map(hb=>{const currDow=(new Date().getDay()+6)%7;return(<div key={hb.id} className="flex items-center gap-2 mb-2"><span className="text-[11px] text-dash-muted w-24 truncate" title={hb.name}>{hb.name}</span><div className="flex gap-1">{DOW.map((_,di)=>{let done=0,total=0;for(let w=0;w<12;w++){const back=(currDow-di+7)%7+w*7;const ds=daysAgo(back);if(ds<=today){total++;if(isCompleted(hb,ds,history))done++;}}const p=total>0?done/total:0;return<div key={di} className="w-5 h-5 rounded-sm" style={{background:hb.color,opacity:0.08+p*0.92,border:"0.5px solid rgba(30,45,74,0.8)"}} title={`${DOW[di]}: ${Math.round(p*100)}%`}/>;})}</div></div>);})}
            </div>
            <div className="rounded-2xl border border-dash-border bg-dash-card p-4">
              <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-4">12-Wochen-Verlauf (Erfüllungsrate)</p>
              <ResponsiveContainer width="100%" height={220}><LineChart data={corrData} margin={{top:4,right:8,left:0,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a"/><XAxis dataKey="label" tick={TICK_STYLE} tickLine={false} axisLine={false}/><YAxis tick={TICK_STYLE} tickLine={false} axisLine={false} domain={[0,100]} tickFormatter={v=>`${v}%`} width={42}/><Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{color:"#e2e8f0"}} formatter={(v:unknown)=>[`${v}%`]}/>{habits.map(h=><Line key={h.id} type="monotone" dataKey={h.name} stroke={h.color} strokeWidth={2} dot={false} connectNulls/>)}</LineChart></ResponsiveContainer>
            </div>
            <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-yellow-200/70 leading-relaxed">💡 <strong className="text-yellow-200/90">intervals.icu-Korrelation:</strong> Mit API-Key wird hier zukünftig die Lag-1-Korrelation von Habits zu HRV und Readiness angezeigt.</div>
          </>)}
        </>)}

        {/* ══ VERWALTEN ══ */}
        {tab==="manage"&&(<>
          {habits.length===0&&!form&&<div className="rounded-2xl border border-dashed border-dash-border p-10 text-center text-dash-muted text-sm">Noch keine Habits.</div>}
          {habits.map((hb,idx)=>{
            if(delId===hb.id)return(<div key={hb.id} className="flex items-center gap-3 p-3 rounded-2xl border border-red-500/30 bg-dash-card text-sm flex-wrap"><span className="flex-1 text-dash-muted min-w-0">„{hb.name}" löschen? (Verlauf bleibt erhalten)</span><button onClick={()=>{setHabits(p=>p.filter(x=>x.id!==hb.id));setDelId(null);}} className="text-xs px-3 py-1.5 rounded-xl text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors">Löschen</button><button onClick={()=>setDelId(null)} className="text-xs px-3 py-1.5 rounded-xl text-dash-muted border border-dash-border hover:text-white transition-colors">Abbrechen</button></div>);
            return(<div key={hb.id} className="flex items-center gap-3 p-3 rounded-2xl border border-dash-border bg-dash-card"><div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-base" style={{background:hb.color+"22"}}>{hb.emoji}</div><div className="flex-1 min-w-0"><p className="text-sm font-medium text-white">{hb.name}</p><p className="text-[11px] text-dash-muted">{hb.habitType==="numeric"?`Numerisch · ${hb.numTarget} ${hb.unit} · `:""}Ziel: {hb.goalType==="daily"?"täglich":hb.goalType==="min_per_week"?`${hb.goalValue}×/Woche`:`alle ${hb.goalValue} Tage`}{hb.retroEvening?" · 🌙 Folgetag":""}</p></div><button onClick={()=>moveHabit(hb.id,-1)} disabled={idx===0} className="p-2 rounded-xl border border-dash-border text-dash-muted hover:text-white transition-colors disabled:opacity-20"><ChevronUp size={14}/></button><button onClick={()=>moveHabit(hb.id,1)} disabled={idx===habits.length-1} className="p-2 rounded-xl border border-dash-border text-dash-muted hover:text-white transition-colors disabled:opacity-20"><ChevronDown size={14}/></button><button onClick={()=>openEdit(hb)} className="p-2 rounded-xl border border-dash-border text-dash-muted hover:text-white transition-colors"><Pencil size={14}/></button><button onClick={()=>{setDelId(hb.id);setForm(null);}} className="p-2 rounded-xl border border-dash-border text-dash-muted hover:text-red-400 transition-colors"><Trash2 size={14}/></button></div>);
          })}
          {!form&&<button onClick={openAdd} className="w-full py-3 rounded-2xl border border-dashed border-dash-border text-dash-muted hover:text-white hover:border-indigo-500/40 transition-colors flex items-center justify-center gap-2 text-sm"><Plus size={15}/> Habit hinzufügen</button>}
          {form&&(
            <div className="rounded-2xl border border-dash-border bg-dash-card p-4 space-y-3">
              <p className="text-sm font-medium text-white">{form.id?"Habit bearbeiten":"Neuer Habit"}</p>
              <div><label className="text-[11px] text-dash-muted block mb-1">Name</label><input type="text" value={form.name||""} onChange={e=>setForm(f=>f?{...f,name:e.target.value,error:""}:null)} placeholder="z. B. Morgensport" className="w-full px-3 py-2 text-sm bg-dash-bg border border-dash-border rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors"/></div>
              <div><label className="text-[11px] text-dash-muted block mb-1">Typ</label><div className="flex gap-4">{(["checkbox","numeric"]as const).map(t=><label key={t} className="flex items-center gap-2 text-sm text-dash-muted cursor-pointer"><input type="radio" name="htype" checked={form.habitType===t} onChange={()=>setForm(f=>f?{...f,habitType:t}:null)}/> {t==="checkbox"?"Checkbox":"Numerisch"}</label>)}</div></div>
              {form.habitType==="numeric"&&<div className="grid grid-cols-2 gap-3"><div><label className="text-[11px] text-dash-muted block mb-1">Einheit</label><input type="text" value={form.unit||""} onChange={e=>setForm(f=>f?{...f,unit:e.target.value}:null)} placeholder="L, km, h …" className="w-full px-3 py-2 text-sm bg-dash-bg border border-dash-border rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors"/></div><div><label className="text-[11px] text-dash-muted block mb-1">Zielwert</label><input type="number" min="0" step="0.5" value={form.numTarget||0} onChange={e=>setForm(f=>f?{...f,numTarget:parseFloat(e.target.value)||0}:null)} className="w-full px-3 py-2 text-sm bg-dash-bg border border-dash-border rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors"/></div></div>}
              <div><label className="text-[11px] text-dash-muted block mb-1">Icon</label><div className="flex flex-wrap gap-1">{EMOJIS.map(e=><button key={e} type="button" onClick={()=>setForm(f=>f?{...f,emoji:e}:null)} className={clsx("w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all",form.emoji===e?"bg-white/15 ring-1 ring-indigo-400":"hover:bg-white/10")}>{e}</button>)}</div></div>
              <div><label className="text-[11px] text-dash-muted block mb-1">Farbe</label><div className="flex gap-2 flex-wrap">{COLORS.map(c=><button key={c} type="button" onClick={()=>setForm(f=>f?{...f,color:c}:null)} className="w-6 h-6 rounded-full transition-all" style={{background:c,outline:form.color===c?"2px solid white":"2px solid transparent",outlineOffset:2}}/>)}</div></div>
              <div><label className="text-[11px] text-dash-muted block mb-1">Zieltyp</label><select value={form.goalType||"daily"} onChange={e=>setForm(f=>f?{...f,goalType:e.target.value as GoalType}:null)} className="w-full px-3 py-2 text-sm bg-dash-bg border border-dash-border rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors"><option value="daily">Täglich</option><option value="min_per_week">Mindestens X mal pro Woche</option><option value="max_per_days">Höchstens alle X Tage</option></select></div>
              {form.goalType!=="daily"&&<div><label className="text-[11px] text-dash-muted block mb-1">{form.goalType==="min_per_week"?"Anzahl pro Woche":"Intervall in Tagen"}</label><input type="number" min="1" max={form.goalType==="min_per_week"?7:365} value={form.goalValue||1} onChange={e=>setForm(f=>f?{...f,goalValue:Math.max(1,parseInt(e.target.value)||1)}:null)} className="w-24 px-3 py-2 text-sm bg-dash-bg border border-dash-border rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors"/></div>}
              <div className="pt-1 border-t border-dash-border/60"><label className="flex items-center gap-2 text-sm text-dash-muted cursor-pointer"><input type="checkbox" checked={!!form.retroEvening} onChange={e=>setForm(f=>f?{...f,retroEvening:e.target.checked}:null)}/> Abend-Habit · am Folgetag nachtragen</label><p className="text-[10px] text-dash-muted/60 mt-1 leading-relaxed">Erscheint im „Heute"-Tab unter „🌙 Letzte Nacht". Beim Abhaken wird auf den <strong className="text-white">Vortag</strong> (Verhaltens-Tag) gespeichert – passt zur Recovery-Analyse.</p></div>
              {form.error&&<p className="text-xs text-red-400">{form.error}</p>}
              <div className="flex gap-2 pt-1"><button onClick={saveForm} className="flex-1 py-2 text-sm font-medium rounded-xl text-white transition-colors" style={{backgroundColor:"var(--a-600)"}}>{form.id?"Speichern":"Hinzufügen"}</button><button onClick={()=>setForm(null)} className="px-4 py-2 text-sm text-dash-muted border border-dash-border rounded-xl hover:text-white transition-colors">Abbrechen</button></div>
            </div>
          )}
        </>)}

        {/* ══ EINSTELLUNGEN ══ */}
        {tab==="settings"&&(<>
          <div className="rounded-2xl border border-dash-border bg-dash-card p-4 space-y-3">
            <p className="text-sm font-semibold text-white">Datenspeicherung</p>
            <p className="text-xs text-dash-muted leading-relaxed">Daten werden <strong className="text-white">server-seitig</strong> als JSON gespeichert. localStorage dient als Offline-Cache.</p>
            <div className="flex items-center gap-3">
              <span className={clsx("text-xs px-3 py-1.5 rounded-xl border",syncState==="saved"?"border-emerald-500/30 text-emerald-400 bg-emerald-500/5":syncState==="offline"?"border-yellow-500/30 text-yellow-400 bg-yellow-500/5":"border-dash-border text-dash-muted")}>
                {syncState==="saved"?"✓ Synchronisiert":syncState==="offline"?"⚠ Offline":syncState==="saving"?"Speichern…":"–"}
              </span>
              <button onClick={async()=>{
  const d=await loadFromServer();
  if(d){
    if(d.habits)setHabits(d.habits);
    if(d.history){const norm:History={};for(const[k,v]of Object.entries(d.history))norm[k]=normalizeDay(v);setHistory(norm);}
    if(d.settings)setSettings(p=>({...p,...d.settings}));
    if(d.hydrationSettings)setHydrationSettings(p=>({...p,...d.hydrationSettings,sweatTests:{...p.sweatTests,...d.hydrationSettings!.sweatTests}}));
    setSyncState("saved");
  }
}} className="text-xs px-3 py-1.5 rounded-xl border border-dash-border text-dash-muted hover:text-white transition-colors flex items-center gap-1"><RefreshCw size={11}/> Neu laden</button>
            </div>
          </div>

          <div className="rounded-2xl border border-dash-border bg-dash-card p-4 space-y-3">
            <p className="text-sm font-semibold text-white">intervals.icu Wellness-Sync</p>
            <p className="text-xs text-dash-muted leading-relaxed">Befinden, Mood, Hydration &amp; Ernährung → serverseitig via <code className="text-indigo-300 text-[10px]">/api/wellness-sync</code> (nutzt INTERVALS_API_KEY aus .env.local, kein Browser-CORS).</p>
            <div><label className="text-[11px] text-dash-muted block mb-1">Athleten-ID</label><input type="text" value={settings.ivAthleteId} onChange={e=>setSettings(s=>({...s,ivAthleteId:e.target.value}))} placeholder="i12345" className="w-40 px-3 py-2 text-sm bg-dash-bg border border-dash-border rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors"/></div>
            <div><label className="text-[11px] text-dash-muted block mb-1">API-Key</label><input type="password" value={settings.ivApiKey} onChange={e=>setSettings(s=>({...s,ivApiKey:e.target.value}))} placeholder="••••••••" className="w-full px-3 py-2 text-sm bg-dash-bg border border-dash-border rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors"/></div>
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={async()=>{setSyncMsg("Synchronisiere…");const r=await doSync(today);setSyncMsg(r.ok?`✓ ${new Date().toLocaleString("de-DE")}`:`✗ ${r.error||"Fehlgeschlagen"}`);}} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border border-dash-border text-dash-muted hover:text-white hover:border-indigo-500/50 transition-colors"><RefreshCw size={12}/> Jetzt sync</button>
              <label className="flex items-center gap-2 text-xs text-dash-muted cursor-pointer"><input type="checkbox" checked={settings.autoSync} onChange={e=>setSettings(s=>({...s,autoSync:e.target.checked}))}/>Auto um <input type="time" value={settings.notifTime} onChange={e=>setSettings(s=>({...s,notifTime:e.target.value}))} className="w-20 px-2 py-1 text-xs bg-dash-bg border border-dash-border rounded-lg text-white focus:outline-none focus:border-indigo-500"/> Uhr</label>
            </div>
            {syncMsg&&<p className="text-[11px] text-dash-muted">{syncMsg}</p>}
            {settings.lastSync&&<p className="text-[11px] text-dash-muted/50">Letzter Sync: {new Date(settings.lastSync).toLocaleString("de-DE")}</p>}
          </div>

          {/* ── Hydration & Schweißraten-Tests ── */}
          <div className="rounded-2xl border border-dash-border bg-dash-card p-4 space-y-4">
            <div>
              <p className="text-sm font-semibold text-white">Hydration & Schweißraten-Tests</p>
              <p className="text-xs text-dash-muted mt-1">Personalisierte Berechnung · lokal gespeichert</p>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] text-dash-muted uppercase tracking-wider font-medium">Basis-Wasserbedarf</p>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-2 text-xs text-dash-muted cursor-pointer">
                  <input type="radio" name="waterbase" checked={hydrationSettings.useWeightBased} onChange={()=>setHydrationSettings(p=>({...p,useWeightBased:true}))}/>Gewichtsbasiert
                </label>
                <label className="flex items-center gap-2 text-xs text-dash-muted cursor-pointer">
                  <input type="radio" name="waterbase" checked={!hydrationSettings.useWeightBased} onChange={()=>setHydrationSettings(p=>({...p,useWeightBased:false}))}/>Manuell
                </label>
              </div>
              {hydrationSettings.useWeightBased ? (
                <div className="flex items-center gap-2">
                  <input type="number" min="40" max="200" step="0.5" value={hydrationSettings.bodyWeightKg}
                    onChange={e=>setHydrationSettings(p=>({...p,bodyWeightKg:parseFloat(e.target.value)||75}))}
                    className="w-20 px-3 py-2 text-sm bg-dash-bg border border-dash-border rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors"/>
                  <span className="text-xs text-dash-muted">kg</span>
                  <span className="text-xs text-indigo-300 ml-1">= {Math.round(hydrationSettings.bodyWeightKg*0.035*10)/10} L Basis</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input type="number" min="1" max="6" step="0.1" value={hydrationSettings.baseWaterL}
                    onChange={e=>setHydrationSettings(p=>({...p,baseWaterL:parseFloat(e.target.value)||2.6}))}
                    className="w-20 px-3 py-2 text-sm bg-dash-bg border border-dash-border rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors"/>
                  <span className="text-xs text-dash-muted">L/Tag</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-[11px] text-dash-muted uppercase tracking-wider font-medium">Schweißraten-Tests</p>
              <p className="text-[10px] text-dash-muted/70">Formel: (kg vorher − nachher) × 1000 + ml getrunken ÷ Stunden = ml/h</p>
              {([
                { key:"outdoor24" as const, label:"Outdoor ~24°C",  sub:"Straße / Gravel normal" },
                { key:"outdoor28" as const, label:"Outdoor >28°C",  sub:"Straße / Gravel Hitze — ausstehend" },
                { key:"rolle"     as const, label:"Rolle / Zwift",  sub:"Indoor — temperaturunabhängig" },
              ]).map(({key,label,sub})=>(
                <div key={key} className="flex items-center gap-3">
                  <div className="flex-1"><p className="text-xs text-white">{label}</p><p className="text-[10px] text-dash-muted">{sub}</p></div>
                  <div className="flex items-center gap-2">
                    <input type="number" min="200" max="3000" step="10"
                      value={hydrationSettings.sweatTests[key] ?? ""}
                      placeholder="—"
                      onChange={e=>setSweatTest(key, e.target.value)}
                      className="w-20 px-3 py-2 text-sm bg-dash-bg border border-dash-border rounded-xl text-white text-right focus:outline-none focus:border-indigo-500 transition-colors tabular-nums"/>
                    <span className="text-[11px] text-dash-muted w-8">ml/h</span>
                    <span className="text-base">{hydrationSettings.sweatTests[key] ? "✅" : "⏳"}</span>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1">
                <span className={clsx("text-[10px] px-2 py-1 rounded-lg border",
                  hydrationSettings.sweatTests.outdoor24&&hydrationSettings.sweatTests.outdoor28&&hydrationSettings.sweatTests.rolle
                    ?"border-emerald-500/30 text-emerald-400 bg-emerald-500/5"
                    :hydrationSettings.sweatTests.outdoor24
                    ?"border-indigo-500/30 text-indigo-300 bg-indigo-500/5"
                    :"border-dash-border text-dash-muted"
                )}>📊 {calibLabel(hydrationSettings.sweatTests)}</span>
                <button onClick={()=>setHydrationSettings(p=>({...p,sweatTests:{outdoor24:null,outdoor28:null,rolle:null}}))}
                  className="text-[10px] px-2 py-1 rounded-lg border border-dash-border text-dash-muted hover:text-red-400 hover:border-red-500/30 transition-colors">Zurücksetzen</button>
              </div>
            </div>

            {/* Debug-Panel */}
            {hydrationDebug && (
              <div className="space-y-1">
                <p className="text-[11px] text-dash-muted uppercase tracking-wider font-medium">Letzter Berechnungs-Log</p>
                <pre className="text-[10px] text-dash-muted/70 bg-dash-bg rounded-xl p-3 border border-dash-border overflow-x-auto leading-relaxed whitespace-pre-wrap">{hydrationDebug}</pre>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-dash-border bg-dash-card p-4 space-y-3">
            <p className="text-sm font-semibold text-white">Standort (Temperatur)</p>
            <p className="text-xs text-dash-muted">Ortsname eingeben → suchen. Kein GPS nötig.</p>
            <div className="flex items-center gap-2 flex-wrap">
              <input type="text" value={settings.locationName}
                onChange={e=>setSettings(s=>({...s,locationName:e.target.value}))}
                onKeyDown={async e=>{if(e.key==="Enter")await geocodeLocation();}}
                placeholder="z. B. Coesfeld"
                className="w-48 px-3 py-2 text-sm bg-dash-bg border border-dash-border rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors"/>
              <button onClick={geocodeLocation}
                className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border border-dash-border text-dash-muted hover:text-white hover:border-indigo-500/50 transition-colors">
                <MapPin size={12}/> Suchen
              </button>
            </div>
            {settings.latitude!==null
              ? <span className="text-[11px] text-emerald-400">✓ {settings.locationName} ({settings.latitude?.toFixed(3)}, {settings.longitude?.toFixed(3)})</span>
              : <span className="text-[11px] text-dash-muted/50">Noch kein Standort gesetzt</span>
            }
          </div>

          <div className="rounded-2xl border border-dash-border bg-dash-card p-4 space-y-3">
            <p className="text-sm font-semibold text-white">Benachrichtigungen</p>
            {typeof window!=="undefined"&&"Notification" in window&&(Notification.permission==="granted"?(<label className="flex items-center gap-2 text-xs text-dash-muted cursor-pointer flex-wrap"><input type="checkbox" checked={settings.notifEnabled} onChange={e=>setSettings(s=>({...s,notifEnabled:e.target.checked}))}/>Aktiv um <input type="time" value={settings.notifTime} onChange={e=>setSettings(s=>({...s,notifTime:e.target.value}))} className="w-24 px-2 py-1 text-xs bg-dash-bg border border-dash-border rounded-lg text-white focus:outline-none focus:border-indigo-500"/></label>):Notification.permission==="denied"?(<p className="text-xs text-red-400">Im Browser blockiert.</p>):(<button onClick={async()=>{const p=await Notification.requestPermission();if(p==="granted")setSettings(s=>({...s,notifEnabled:true}));}} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border border-dash-border text-dash-muted hover:text-white hover:border-indigo-500/50 transition-colors"><Bell size={12}/> Benachrichtigungen erlauben</button>))}
          </div>

          <div className="rounded-2xl border border-dash-border bg-dash-card p-4 space-y-3">
            <p className="text-sm font-semibold text-white">Daten-Export</p>
            <div className="flex gap-2 flex-wrap"><button onClick={exportCSV} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border border-dash-border text-dash-muted hover:text-white hover:border-indigo-500/50 transition-colors"><Download size={12}/> CSV</button><button onClick={exportJSON} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border border-dash-border text-dash-muted hover:text-white hover:border-indigo-500/50 transition-colors"><Download size={12}/> JSON</button></div>
            <div><label className="text-[11px] text-dash-muted block mb-1">JSON importieren <strong>(überschreibt alle Daten!)</strong></label><input type="file" accept=".json" onChange={e=>{const file=e.target.files?.[0];if(!file)return;const r=new FileReader();r.onload=ev=>{try{const d=JSON.parse(ev.target?.result as string);if(d.habits)setHabits(d.habits);if(d.history){const norm:History={};for(const[k,v]of Object.entries(d.history))norm[k]=normalizeDay(v);setHistory(norm);}e.target.value="";}catch{alert("Ungültige JSON-Datei.");}};r.readAsText(file);}} className="text-xs text-dash-muted"/></div>
          </div>
        </>)}
      </div>
    </>
  );
}
