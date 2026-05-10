export const TOGGLEABLE_PAGES = [
  { id: "koerper", label: "Körper & Gewicht", href: "/koerper", defaultEnabled: false, desc: "Gewichtstracking, Trends und Projektion" },
  { id: "analyse", label: "HRV-Analyse",      href: "/analyse", defaultEnabled: true,  desc: "HRV-Analyse, Muster und Insights" },
  { id: "training", label: "Training",         href: "/training", defaultEnabled: true, desc: "Wöchentliche Aktivitäts-Charts und Statistiken" },
] as const;

const STORAGE_KEY = "dashboard-page-settings";

export function getPageSettings(): Record<string, boolean> {
  if (typeof window === "undefined") {
    return Object.fromEntries(TOGGLEABLE_PAGES.map((p) => [p.id, p.defaultEnabled]));
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    return Object.fromEntries(
      TOGGLEABLE_PAGES.map((p) => [p.id, parsed[p.id] ?? p.defaultEnabled])
    );
  } catch {
    return Object.fromEntries(TOGGLEABLE_PAGES.map((p) => [p.id, p.defaultEnabled]));
  }
}

export function setPageEnabled(id: string, enabled: boolean): void {
  const current = getPageSettings();
  current[id] = enabled;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  window.dispatchEvent(new Event("page-settings-changed"));
}
