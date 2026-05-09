import { ProRace } from "./types";

// UCI WorldTour 2026 – Annäherungswerte basierend auf historischen Terminen.
// Vor jeder Saison auf offizielle UCI-Website prüfen: https://www.uci.org/calendar
export const PRO_RACES_2026: ProRace[] = [
  // Frühjahrs-Klassiker
  { name: "Omloop Het Nieuwsblad", startDate: "2026-02-28", endDate: "2026-02-28", category: "WT", country: "BEL" },
  { name: "Strade Bianche", startDate: "2026-03-07", endDate: "2026-03-07", category: "Monument", country: "ITA" },
  { name: "Tirreno-Adriatico", startDate: "2026-03-11", endDate: "2026-03-17", category: "WT-Stage", country: "ITA" },
  { name: "Milan-San Remo", startDate: "2026-03-21", endDate: "2026-03-21", category: "Monument", country: "ITA" },
  { name: "Volta a Catalunya", startDate: "2026-03-23", endDate: "2026-03-29", category: "WT-Stage", country: "ESP" },
  { name: "E3 Saxo Bank Classic", startDate: "2026-03-27", endDate: "2026-03-27", category: "WT", country: "BEL" },
  { name: "Gent-Wevelgem", startDate: "2026-03-29", endDate: "2026-03-29", category: "WT", country: "BEL" },
  { name: "Dwars door Vlaanderen", startDate: "2026-04-01", endDate: "2026-04-01", category: "WT", country: "BEL" },
  { name: "Tour of Flanders", startDate: "2026-04-05", endDate: "2026-04-05", category: "Monument", country: "BEL" },
  { name: "Paris-Roubaix", startDate: "2026-04-12", endDate: "2026-04-12", category: "Monument", country: "FRA" },
  { name: "Amstel Gold Race", startDate: "2026-04-19", endDate: "2026-04-19", category: "WT", country: "NED" },
  { name: "La Flèche Wallonne", startDate: "2026-04-22", endDate: "2026-04-22", category: "WT", country: "BEL" },
  { name: "Liège-Bastogne-Liège", startDate: "2026-04-26", endDate: "2026-04-26", category: "Monument", country: "BEL" },

  // Grand Tours
  { name: "Giro d'Italia", startDate: "2026-05-09", endDate: "2026-05-31", category: "GrandTour", country: "ITA" },
  { name: "Critérium du Dauphiné", startDate: "2026-06-07", endDate: "2026-06-14", category: "WT-Stage", country: "FRA" },
  { name: "Tour de Suisse", startDate: "2026-06-13", endDate: "2026-06-21", category: "WT-Stage", country: "CHE" },
  { name: "Tour de France", startDate: "2026-07-04", endDate: "2026-07-26", category: "GrandTour", country: "FRA" },
  { name: "Clásica San Sebastián", startDate: "2026-08-01", endDate: "2026-08-01", category: "WT", country: "ESP" },
  { name: "Vuelta a España", startDate: "2026-08-22", endDate: "2026-09-13", category: "GrandTour", country: "ESP" },
  { name: "Il Lombardia", startDate: "2026-10-10", endDate: "2026-10-10", category: "Monument", country: "ITA" },
];

export const RACE_CATEGORY_COLORS: Record<ProRace["category"], string> = {
  Monument: "#f59e0b",
  GrandTour: "#8b5cf6",
  "WT-Stage": "#3b82f6",
  WT: "#6b7280",
};
