#!/usr/bin/env python3
"""
garmin-sync.py — Pull der Garmin-nativen Metriken → garmin.json (Dashboard-Volume)

Holt die Signale, die über intervals.icu NICHT zuverlässig ankommen:
  - Body Battery (hoch / niedrig / aktuell)
  - All-Day-Stress (Ø / max)
  - Schlafphasen (deep / light / rem / awake) + Score
  - Training Readiness (Garmins eigener Score)
  - Training Status (PRODUCTIVE / MAINTAINING / …)
  - Resting HR (Cross-Check gegen intervals.icu)

Schreibt nach DATA_DIR/garmin.json — dieselbe Datei-Konvention wie habits.json.
Die /api/garmin-Route liest sie. Läuft per Host-Cron neben habits-sync.py.

────────────────────────────────────────────────────────────────────────────
WICHTIG — Feldnamen verifizieren:
  Die Rückgabe-Strukturen von python-garminconnect variieren je nach Account,
  Region und Gerät. Beim ERSTEN Lauf mit DEBUG=1 werden die Rohantworten als
  garmin-raw-<datum>.json gespeichert. Dort die echten Feldpfade prüfen und die
  mit  # VERIFY  markierten Extraktoren unten ggf. anpassen. Lieber einmal live
  nachschauen als gegen geratene Felder coden.
────────────────────────────────────────────────────────────────────────────

Umgebungsvariablen:
  GARMIN_EMAIL        — Garmin-Connect-Login
  GARMIN_PASSWORD     — Garmin-Connect-Passwort   (env-Datei chmod 600!)
  GARMIN_TOKENSTORE   — Pfad für OAuth-Tokens (Standard: ~/.garminconnect)
  GARMIN_DATA_DIR     — Zielordner für garmin.json
                        (Standard: /opt/intervals-dashboard/habits-data)
  GARMIN_DAYS         — Anzahl Tage rückwärts (Standard: 7)
  DEBUG               — "1" → Rohantworten als garmin-raw-<datum>.json speichern

Einmaliger Login (interaktiv, einmal MFA-Code eingeben falls aktiv):
  python3 garmin-sync.py
  → schreibt Tokens nach GARMIN_TOKENSTORE; danach läuft Cron unbeaufsichtigt,
    bis das Refresh-Token (~1 Jahr) abläuft.
"""

import os, sys, json
from datetime import date as Date, timedelta, datetime

from garminconnect import Garmin

# ── Konfiguration ─────────────────────────────────────────────────────────────
EMAIL      = os.environ.get("GARMIN_EMAIL", "")
PASSWORD   = os.environ.get("GARMIN_PASSWORD", "")
TOKENSTORE = os.environ.get("GARMIN_TOKENSTORE", os.path.expanduser("~/.garminconnect"))
DATA_DIR   = os.environ.get("GARMIN_DATA_DIR", "/opt/intervals-dashboard/habits-data")
DAYS       = int(os.environ.get("GARMIN_DAYS", "7"))
DEBUG      = os.environ.get("DEBUG", "0") == "1"

OUT_FILE   = os.path.join(DATA_DIR, "garmin.json")


# ── Login ─────────────────────────────────────────────────────────────────────
def connect() -> Garmin:
    """
    Lädt gespeicherte Tokens; nur beim ersten Lauf (oder nach Ablauf) echter
    Login mit Passwort + ggf. MFA. prompt_mfa feuert nur bei aktivem 2FA.
    """
    client = Garmin(EMAIL, PASSWORD, prompt_mfa=lambda: input("MFA-Code: "))
    try:
        client.login(TOKENSTORE)          # lädt Tokens aus dem Store
    except Exception:
        # Kein/abgelaufener Token → frischer Login, dann Tokens sichern
        client.login()
        client.garth.dump(TOKENSTORE)
    return client


# ── Defensive Extraktoren ───────────────────────────────────────────────────
# Jeder gibt bei fehlendem Feld None zurück, statt zu crashen.
# Pfade mit # VERIFY beim ersten DEBUG-Lauf gegen garmin-raw prüfen.

def _save_raw(tag: str, d: str, obj) -> None:
    if not DEBUG:
        return
    p = os.path.join(DATA_DIR, f"garmin-raw-{d}-{tag}.json")
    with open(p, "w") as f:
        json.dump(obj, f, indent=2, default=str)


def extract_body_battery(raw) -> dict:
    # get_body_battery → Liste (ein Eintrag pro Tag)
    try:
        day = raw[0] if isinstance(raw, list) and raw else raw
        arr = day.get("bodyBatteryValuesArray") or []      # VERIFY
        # Einträge: [timestamp, status, value, ...]
        vals = [row[2] for row in arr if len(row) > 2 and isinstance(row[2], (int, float))]
        return {
            "bbHigh":   max(vals) if vals else None,
            "bbLow":    min(vals) if vals else None,
            "bbRecent": vals[-1] if vals else None,
        }
    except Exception:
        return {"bbHigh": None, "bbLow": None, "bbRecent": None}


def extract_stress(raw) -> dict:
    try:
        return {
            "stressAvg": raw.get("avgStressLevel"),         # VERIFY
            "stressMax": raw.get("maxStressLevel"),         # VERIFY
        }
    except Exception:
        return {"stressAvg": None, "stressMax": None}


def extract_sleep(raw) -> dict:
    try:
        dto = raw.get("dailySleepDTO", raw) or {}           # VERIFY
        score = None
        ss = dto.get("sleepScores") or {}
        if isinstance(ss, dict):
            score = (ss.get("overall") or {}).get("value")  # VERIFY
        return {
            "sleepSecs":  dto.get("sleepTimeSeconds"),      # VERIFY
            "deepSecs":   dto.get("deepSleepSeconds"),
            "lightSecs":  dto.get("lightSleepSeconds"),
            "remSecs":    dto.get("remSleepSeconds"),
            "awakeSecs":  dto.get("awakeSleepSeconds"),
            "sleepScore": score,
        }
    except Exception:
        return {"sleepSecs": None, "deepSecs": None, "lightSecs": None,
                "remSecs": None, "awakeSecs": None, "sleepScore": None}


def extract_readiness(raw) -> dict:
    try:
        item = raw[0] if isinstance(raw, list) and raw else raw
        return {
            "readinessScore": item.get("score"),            # VERIFY
            "readinessLevel": item.get("level"),            # VERIFY
        }
    except Exception:
        return {"readinessScore": None, "readinessLevel": None}


def extract_status(raw) -> dict:
    # get_training_status ist tief verschachtelt — best effort auf einen String.
    try:
        latest = (raw.get("mostRecentTrainingStatus") or {})         # VERIFY
        feed   = (latest.get("latestTrainingStatusData") or {})
        # erstes Geräte-Dict herausziehen
        for dev in feed.values():
            ts = dev.get("trainingStatus")
            if ts:
                return {"trainingStatus": ts}
        return {"trainingStatus": None}
    except Exception:
        return {"trainingStatus": None}


def extract_rhr(raw) -> dict:
    try:
        return {"restingHr": raw.get("restingHeartRate")}   # VERIFY (get_stats)
    except Exception:
        return {"restingHr": None}


# ── Ein-Tages-Pull ──────────────────────────────────────────────────────────
def pull_day(client: Garmin, d: str) -> dict:
    out: dict = {}

    def grab(tag, fn, extractor):
        try:
            raw = fn()
            _save_raw(tag, d, raw)
            out.update(extractor(raw))
        except Exception as e:
            print(f"    ⚠ {tag} ({d}): {e}")

    grab("bodybattery", lambda: client.get_body_battery(d, d), extract_body_battery)
    grab("stress",      lambda: client.get_stress_data(d),      extract_stress)
    grab("sleep",       lambda: client.get_sleep_data(d),       extract_sleep)
    grab("readiness",   lambda: client.get_training_readiness(d), extract_readiness)
    grab("status",      lambda: client.get_training_status(d),  extract_status)
    grab("stats",       lambda: client.get_stats(d),            extract_rhr)

    return out


# ── Hauptprogramm ─────────────────────────────────────────────────────────────
def main():
    if not EMAIL or not PASSWORD:
        print("❌ GARMIN_EMAIL / GARMIN_PASSWORD nicht gesetzt.")
        sys.exit(1)

    os.makedirs(DATA_DIR, exist_ok=True)
    print(f"🔄 Garmin-Sync — letzte {DAYS} Tage → {OUT_FILE}")

    client = connect()
    print("  ✅ Garmin verbunden")

    # Bestehende Daten laden (inkrementell ergänzen, nichts verwerfen)
    store = {"lastSync": None, "days": {}}
    if os.path.exists(OUT_FILE):
        try:
            with open(OUT_FILE) as f:
                store = json.load(f)
            store.setdefault("days", {})
        except Exception:
            pass

    today = Date.today()
    for i in range(DAYS):
        d = (today - timedelta(days=i)).isoformat()
        print(f"  📅 {d}")
        day_data = pull_day(client, d)
        if any(v is not None for v in day_data.values()):
            store["days"][d] = {**store["days"].get(d, {}), **day_data}

    store["lastSync"] = datetime.now().astimezone().isoformat(timespec="seconds")

    with open(OUT_FILE, "w") as f:
        json.dump(store, f, indent=2)

    print(f"  ✅ {len(store['days'])} Tage gespeichert")
    if DEBUG:
        print("  🐛 DEBUG: Rohantworten als garmin-raw-*.json — Feldpfade prüfen.")


if __name__ == "__main__":
    main()
