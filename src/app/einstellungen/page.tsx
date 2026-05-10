"use client";
import { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import { clsx } from "clsx";
import { TOGGLEABLE_PAGES, getPageSettings, setPageEnabled } from "@/lib/settings";

export default function EinstellungenPage() {
  const [settings, setSettings] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(TOGGLEABLE_PAGES.map((p) => [p.id, p.defaultEnabled]))
  );

  useEffect(() => {
    setSettings(getPageSettings());
  }, []);

  function toggle(id: string) {
    const next = !settings[id];
    setPageEnabled(id, next);
    setSettings((prev) => ({ ...prev, [id]: next }));
  }

  return (
    <>
      <header className="sticky top-0 z-10 bg-dash-bg/95 backdrop-blur border-b border-dash-border px-6 py-3 flex items-center gap-3">
        <Settings size={16} className="text-dash-muted" />
        <h1 className="text-sm font-semibold text-white">Einstellungen</h1>
      </header>

      <div className="p-6 max-w-xl space-y-6">
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
      </div>
    </>
  );
}
