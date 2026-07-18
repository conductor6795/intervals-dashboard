// src/instrumentation.ts
//
// Next.js Server-Instrumentation: registriert einen In-Prozess-Cronjob, der
// jede Nacht um 05:00 Uhr habits.json → intervals.icu + Notion synchronisiert
// (siehe src/lib/autoSync.ts). Läuft automatisch beim Start des Node-Servers
// (auch im Docker-Container über `node server.js`).
//
// 05:00 = Zeitzone des Containers (siehe ENV TZ im Dockerfile, Standard
// Europe/Berlin). Kein Notifications-/Browser-Zutun nötig — das ersetzt den
// bisherigen, unzuverlässigen Browser-Timer (settings.autoSync in page.tsx),
// der nur feuert wenn ein Tab offen ist.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const cron = await import("node-cron");
  const { runAutoSync } = await import("./lib/autoSync");

  cron.schedule("0 5 * * *", async () => {
    console.log("[auto-sync] Nacht-Sync (05:00) gestartet …");
    try {
      const results = await runAutoSync();
      console.log("[auto-sync] Ergebnis:", JSON.stringify(results));
    } catch (e) {
      console.error("[auto-sync] fehlgeschlagen:", e);
    }
  });

  console.log("[auto-sync] Scheduler registriert — täglich 05:00 (Container-Zeitzone)");
}
