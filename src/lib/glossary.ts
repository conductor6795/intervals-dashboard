export const GLOSSARY: Record<string, string> = {
  CTL:   "Chronic Training Load – 42-Tage-Durchschnitt deiner Trainingsbelastung. Entspricht deiner langfristigen Fitness.",
  ATL:   "Acute Training Load – 7-Tage-Durchschnitt. Zeigt deine kurzfristige Ermüdung.",
  TSB:   "Training Stress Balance – CTL minus ATL. Positiv = frisch, negativ = ermüdet.",
  HRV:   "Heart Rate Variability – Herzratenvariabilität. Höhere Werte = bessere Erholung.",
  hrv_pct: "Rollender 28-Tage-Perzentil von hrv7 (Hauptsignal Langzeittrend). ≥60 % erholt · 40–59 % neutral · 20–39 % leicht gedrückt · 5–19 % strukturell niedrig · <5 % kritisch.",
  CV:    "Variationskoeffizient der HRV über 7 Messtage. <12 % = stabil · 12–15 % = Warnzone · >15 % = ANS-instabil (nur mit hrv_pct <20 % ein Hard-Trigger).",
  RHR:   "Resting Heart Rate – Ruhepuls. Niedrigere Werte sind in der Regel besser.",
  PMC:   "Performance Management Chart – zeigt CTL, ATL und TSB über Zeit.",
  VO2max:"Maximale Sauerstoffaufnahme – Maß für aerobe Kapazität.",
  NP:    "Normalized Power – gewichteter Leistungsdurchschnitt, berücksichtigt Intensitätsschwankungen.",
  IF:    "Intensity Factor – NP geteilt durch FTP. 1,0 = Schwellenintensität.",
  TSS:   "Training Stress Score – Belastungspunkte einer Einheit (Dauer × Intensität²).",
};
