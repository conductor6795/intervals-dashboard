"use client";
import { useState, useEffect } from "react";
import { Settings, Moon } from "lucide-react";
import { clsx } from "clsx";
import { TOGGLEABLE_PAGES, getPageSettings, setPageEnabled } from "@/lib/settings";
import { DEFAULT_SLEEP_SETTINGS, SleepCoachSettings, getSleepSettings, setSleepSettings } from "@/lib/sleepSettings";

export default function EinstellungenPage() {
  const [settings, setSettings] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(TOGGLEABLE_PAGES.map((p) => [p.id, p.defaultEnabled]))
  );
  const [sleep, setSleep] = useState<SleepCoachSettings>(DEFAULT_SLEEP_SETTINGS);
  const [sleepSaved, setSleepSaved] = useState(false);

  useEffect(() => {
    setSettings(getPageSettings());
    setSleep(getSleepSettings());
  }, []);

  function toggle(id: string) {
    const next = !settings[id];
    setPageEnabled(id, next);
    setSettings((prev) => ({ ...prev, [id]: next }));
  }

  function saveSleep() {
    setSleepSettings(sleep);
    setSleepSaved(true);
    setTimeout(() => setSleepSaved(false), 1500);
  }

  return (
    <>
      <header className="sticky top-0 z-10 bg-dash-bg/95 backdrop-blur border-b border-dash-border px-3 sm:px-6 py-3 flex items-center gap-3">
        <Settings size={16} className="text-dash-muted" />
        <h1 className="text-sm font-semibold text-white">Einstellungen</h1>
      </header>

      <div className="p-3 sm:p-6 max-w-xl mx-auto space-y-6">
        <section>
          <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-4">
            Sichtbare Seiten
          </p>
          <div className="space-y-2">
            {TOGGLEABLE_PAGES.map((page) => {
              const enabled = settings[page.id] ?? page.defaultEnabled;
              return (
                <div
                  key={page.id}
                  className="flex items-center justify-between px-4 py-3 rounded-2xl bg-dash-card border border-dash-border"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{page.label}</p>
                    <p className="text-[11px] text-dash-muted mt-0.5">{page.desc}</p>
                  </div>
                  <button
                    onClick={() => toggle(page.id)}
                    className={clsx(
                      "flex items-center gap-2 text-[11px] px-3 py-1.5 rounded-xl border transition-colors",
                      enabled
                        ? "border-indigo-500/60 bg-indigo-500/10 text-indigo-400"
                        : "border-dash-border text-dash-muted hover:text-white",
                    )}
                  >
                    <span
                      className={clsx(
                        "w-7 h-4 rounded-full flex items-center transition-colors",
                        enabled ? "bg-indigo-600 justify-end pr-0.5" : "bg-dash-border justify-start pl-0.5",
                      )}
                    >
                      <span className="w-3 h-3 rounded-full bg-white shadow-sm" />
                    </span>
                    {enabled ? "Aktiv" : "Aus"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <p className="text-[10px] text-dash-muted/50">
          Deaktivierte Seiten werden in der Navigation und den Quick-Links ausgeblendet.
        </p>

        <section>
          <div className="flex items-center gap-1.5 mb-4">
            <Moon size={12} className="text-dash-muted" />
            <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium">Schlafcoach</p>
          </div>
          <div className="p-4 rounded-2xl bg-dash-card border border-dash-border space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-white">Basis-Schlafbedarf</p>
                <p className="text-[11px] text-dash-muted mt-0.5">Ausgangswert vor Zu-/Abschlägen durch Belastung, Stress und Schlafschuld.</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="number" min={5} max={11} step={0.25}
                  value={sleep.baseSleepNeedH}
                  onChange={(e) => setSleep((s) => ({ ...s, baseSleepNeedH: parseFloat(e.target.value) || s.baseSleepNeedH }))}
                  className="w-16 bg-dash-bg border border-dash-border rounded-lg px-2 py-1.5 text-sm text-white text-right tabular-nums"
                />
                <span className="text-xs text-dash-muted">h</span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-white">Aufstehzeit unter der Woche</p>
                <p className="text-[11px] text-dash-muted mt-0.5">Mo–Fr. Anker für die Rückrechnung von Einschlaf- und Bettzeit.</p>
              </div>
              <input
                type="time"
                value={sleep.targetWakeTimeWeekday}
                onChange={(e) => setSleep((s) => ({ ...s, targetWakeTimeWeekday: e.target.value }))}
                className="bg-dash-bg border border-dash-border rounded-lg px-2 py-1.5 text-sm text-white shrink-0"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-white">Aufstehzeit am Wochenende</p>
                <p className="text-[11px] text-dash-muted mt-0.5">Sa–So. Wird für Nächte vor freien Tagen genutzt.</p>
              </div>
              <input
                type="time"
                value={sleep.targetWakeTimeWeekend}
                onChange={(e) => setSleep((s) => ({ ...s, targetWakeTimeWeekend: e.target.value }))}
                className="bg-dash-bg border border-dash-border rounded-lg px-2 py-1.5 text-sm text-white shrink-0"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-white">Einschlaflatenz</p>
                <p className="text-[11px] text-dash-muted mt-0.5">Angenommene Zeit von &quot;Licht aus&quot; bis Einschlafen (Garmin misst nur den Schlafbeginn selbst).</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="number" min={0} max={60} step={5}
                  value={sleep.onsetLatencyMin}
                  onChange={(e) => setSleep((s) => ({ ...s, onsetLatencyMin: parseInt(e.target.value) || 0 }))}
                  className="w-16 bg-dash-bg border border-dash-border rounded-lg px-2 py-1.5 text-sm text-white text-right tabular-nums"
                />
                <span className="text-xs text-dash-muted">min</span>
              </div>
            </div>
            <button
              onClick={saveSleep}
              className={clsx(
                "text-xs px-4 py-1.5 rounded-xl font-medium transition-colors",
                sleepSaved ? "bg-emerald-600 text-white" : "bg-indigo-600 hover:bg-indigo-500 text-white",
              )}
            >
              {sleepSaved ? "Gespeichert" : "Speichern"}
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
