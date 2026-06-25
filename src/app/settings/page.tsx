"use client";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { clsx } from "clsx";

type Theme = "navy" | "midnight" | "slate" | "forest" | "cosmos" | "charcoal";
type AccentHue = "indigo" | "blue" | "teal" | "violet" | "orange" | "emerald" | "rose" | "amber";

const THEMES: { id: Theme; label: string; desc: string; bg: string; card: string }[] = [
  { id: "navy",     label: "Navy",     desc: "Dunkles Marineblau",   bg: "#0b0f1a", card: "#131929" },
  { id: "midnight", label: "Midnight", desc: "AMOLED-Schwarz",       bg: "#050508", card: "#0a0a10" },
  { id: "slate",    label: "Slate",    desc: "Tiefes Schieferblau",  bg: "#0f172a", card: "#162133" },
  { id: "forest",   label: "Forest",   desc: "Dunkelgrüner Wald",    bg: "#040c07", card: "#07140c" },
  { id: "cosmos",   label: "Cosmos",   desc: "Tiefes Weltraumviolett", bg: "#06040e", card: "#0a0716" },
  { id: "charcoal", label: "Charcoal", desc: "Neutrales Anthrazit",  bg: "#0a0a0a", card: "#121212" },
];

const ACCENTS: { id: AccentHue; label: string; color: string }[] = [
  { id: "indigo",  label: "Indigo",   color: "#6366f1" },
  { id: "blue",    label: "Blau",     color: "#3b82f6" },
  { id: "teal",    label: "Türkis",   color: "#14b8a6" },
  { id: "violet",  label: "Violett",  color: "#8b5cf6" },
  { id: "emerald", label: "Smaragd",  color: "#10b981" },
  { id: "rose",    label: "Rose",     color: "#f43f5e" },
  { id: "amber",   label: "Amber",    color: "#f59e0b" },
  { id: "orange",  label: "Orange",   color: "#f97316" },
];

const ACCENT_VARS: Record<AccentHue, Record<string, string>> = {
  indigo:  { "--a-600": "#4f46e5", "--a-500": "#6366f1", "--a-400": "#818cf8", "--a-900": "#1e1b4b", "--a-900-hex": "30 27 75" },
  blue:    { "--a-600": "#2563eb", "--a-500": "#3b82f6", "--a-400": "#60a5fa", "--a-900": "#1e3a5f", "--a-900-hex": "30 58 95" },
  teal:    { "--a-600": "#0d9488", "--a-500": "#14b8a6", "--a-400": "#2dd4bf", "--a-900": "#042f2e", "--a-900-hex": "4 47 46" },
  violet:  { "--a-600": "#7c3aed", "--a-500": "#8b5cf6", "--a-400": "#a78bfa", "--a-900": "#2e1065", "--a-900-hex": "46 16 101" },
  emerald: { "--a-600": "#059669", "--a-500": "#10b981", "--a-400": "#34d399", "--a-900": "#022c22", "--a-900-hex": "2 44 34" },
  rose:    { "--a-600": "#e11d48", "--a-500": "#f43f5e", "--a-400": "#fb7185", "--a-900": "#4c0519", "--a-900-hex": "76 5 25" },
  amber:   { "--a-600": "#d97706", "--a-500": "#f59e0b", "--a-400": "#fcd34d", "--a-900": "#451a03", "--a-900-hex": "69 26 3" },
  orange:  { "--a-600": "#ea580c", "--a-500": "#f97316", "--a-400": "#fb923c", "--a-900": "#431407", "--a-900-hex": "67 20 7" },
};

function applyAccent(hue: AccentHue) {
  const vars = ACCENT_VARS[hue];
  Object.entries(vars).forEach(([k, v]) => {
    document.documentElement.style.setProperty(k, v);
  });
}

export default function SettingsPage() {
  const [theme, setTheme] = useState<Theme>("navy");
  const [accent, setAccent] = useState<AccentHue>("indigo");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const t = (localStorage.getItem("dash-theme") ?? "navy") as Theme;
    const a = (localStorage.getItem("dash-accent") ?? "indigo") as AccentHue;
    setTheme(t);
    setAccent(a);
    document.documentElement.setAttribute("data-theme", t);
    applyAccent(a);
  }, []);

  function save() {
    localStorage.setItem("dash-theme", theme);
    localStorage.setItem("dash-accent", accent);
    document.documentElement.setAttribute("data-theme", theme);
    applyAccent(accent);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function previewTheme(t: Theme) {
    document.documentElement.setAttribute("data-theme", t);
    setTheme(t);
  }

  function previewAccent(a: AccentHue) {
    applyAccent(a);
    setAccent(a);
  }

  const currentAccent = ACCENTS.find((a) => a.id === accent);

  return (
    <>
      <header className="sticky top-0 z-10 bg-dash-bg/95 backdrop-blur border-b border-dash-border px-3 sm:px-6 py-3 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-white">Einstellungen</h1>
        <button
          onClick={save}
          className={clsx(
            "flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-xl font-medium transition-all",
            saved
              ? "bg-emerald-600 text-white border border-emerald-500"
              : "text-white border border-white/20 hover:border-white/40"
          )}
          style={!saved ? { backgroundColor: "var(--a-600)", borderColor: "var(--a-500)" } : {}}
        >
          {saved && <Check size={12} />}
          {saved ? "Gespeichert" : "Speichern"}
        </button>
      </header>

      <div className="p-3 sm:p-6 space-y-6 max-w-[900px] mx-auto">

        {/* Hintergrundthema */}
        <section className="p-5 rounded-2xl border border-dash-border bg-dash-card">
          <h2 className="text-sm font-semibold text-white mb-1">Hintergrund-Theme</h2>
          <p className="text-xs text-dash-muted mb-5">Ändert den Hintergrund aller Seiten. Direkte Vorschau.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => previewTheme(t.id)}
                className={clsx(
                  "p-4 rounded-xl border text-left transition-all hover:scale-[1.02]",
                  theme === t.id
                    ? "border-2 scale-[1.02]"
                    : "border-dash-border hover:border-dash-muted"
                )}
                style={theme === t.id ? { borderColor: "var(--a-500)", backgroundColor: "rgb(var(--a-900-hex,30 27 75)/0.15)" } : {}}
              >
                {/* Mini-Preview */}
                <div className="w-full h-10 rounded-lg mb-3 overflow-hidden flex gap-1 p-1.5 border border-white/5"
                  style={{ backgroundColor: t.bg }}>
                  <div className="h-full w-1/4 rounded" style={{ backgroundColor: t.card }} />
                  <div className="flex-1 flex flex-col gap-1 justify-center">
                    <div className="h-1.5 rounded-full bg-white/10 w-3/4" />
                    <div className="h-1 rounded-full bg-white/5 w-1/2" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-white">{t.label}</p>
                    <p className="text-[10px] text-dash-muted mt-0.5">{t.desc}</p>
                  </div>
                  {theme === t.id && <Check size={12} className="text-accent shrink-0" />}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Akzentfarbe */}
        <section className="p-5 rounded-2xl border border-dash-border bg-dash-card">
          <h2 className="text-sm font-semibold text-white mb-1">Akzentfarbe</h2>
          <p className="text-xs text-dash-muted mb-5">
            Betrifft Buttons, aktive Navigation, Highlights und Charts. Aktuell: <span className="text-white font-medium">{currentAccent?.label}</span>
          </p>
          <div className="flex gap-3 flex-wrap">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                onClick={() => previewAccent(a.id)}
                title={a.label}
                className={clsx(
                  "relative w-11 h-11 rounded-xl border-2 transition-all flex items-center justify-center group",
                  accent === a.id
                    ? "border-white scale-110 shadow-lg"
                    : "border-transparent hover:border-white/40 hover:scale-105"
                )}
                style={{ backgroundColor: a.color }}
              >
                {accent === a.id && <Check size={14} className="text-white drop-shadow" />}
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-dash-muted opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {a.label}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Berechnungshinweise */}
        <section className="p-5 rounded-2xl border border-dash-border bg-dash-card">
          <h2 className="text-sm font-semibold text-white mb-4">Berechnungsgrundlagen</h2>
          <div className="space-y-3 text-xs text-dash-muted">
            <div className="pb-3 border-b border-dash-border">
              <p className="text-white font-medium mb-1">Trainingsbereitschaft</p>
              <p>HRV-Trend 40 % · Schlaf 25 % · RHR 15 % · Subjektiv 15 % · CV 5 %</p>
              <p className="mt-0.5 opacity-70">Buchheit (2014), Plews et al. (2013)</p>
            </div>
            <div className="pb-3 border-b border-dash-border">
              <p className="text-white font-medium mb-1">Schlaf-Scoring</p>
              <p>Bell-Curve: Optimum 7,5–9 h. Über 9 h leicht abgewertet.</p>
              <p className="mt-0.5 opacity-70">Hirshkowitz et al. (2015), Walker (2017)</p>
            </div>
            <div className="pb-3 border-b border-dash-border">
              <p className="text-white font-medium mb-1">CV-Ampel</p>
              <p>4-Felder-Matrix: HRV-Trend × CV (Schwelle 6,5 %). Plews et al. (2012, 2013).</p>
            </div>
            <div className="pb-3 border-b border-dash-border">
              <p className="text-white font-medium mb-1">PMC (CTL / ATL / TSB)</p>
              <p>CTL = 42-Tage-EMA · ATL = 7-Tage-EMA · TSB = CTL − ATL. Coggan & Hunter (2003).</p>
            </div>
            <div>
              <p className="text-white font-medium mb-1">VO2max-Schätzung</p>
              <p>VO2max ≈ (FTP/kg × 10,8) + 7 nach Coggan. Gerät-Messung hat Vorrang.</p>
            </div>
          </div>
        </section>

        {/* Datenquelle */}
        <section className="p-5 rounded-2xl border border-dash-border bg-dash-card">
          <h2 className="text-sm font-semibold text-white mb-3">Datenquelle</h2>
          <div className="bg-dash-bg border border-dash-border rounded-xl p-4 font-mono text-xs space-y-1">
            <p className="text-dash-muted"># .env.local</p>
            <p><span className="text-accent">INTERVALS_ATHLETE_ID</span>=i12345</p>
            <p><span className="text-accent">INTERVALS_API_KEY</span>=dein_api_key</p>
            <p><span className="text-accent">NEXT_PUBLIC_ATHLETE_NAME</span>=Dein Name</p>
            <p><span className="text-accent">NEXT_PUBLIC_ATHLETE_ID</span>=i12345</p>
          </div>
        </section>
      </div>
    </>
  );
}
