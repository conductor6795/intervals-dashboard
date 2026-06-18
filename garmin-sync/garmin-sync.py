#!/usr/bin/env python3
"""
garmin-sync.py — Pull der Garmin-nativen Metriken → garmin.json (Dashboard-Volume)

Holt die Signale, die über intervals.icu NICHT zuverlässig ankommen:
  - Body Battery (hoch / niedrig / aktuell)
  - All-Day-Stress (Ø / max)
  - Schlafphasen (deep / light / rem / awake) + Score
  - Training Readiness (Garmins eigener Score)
  - Training Status (MAINTAINING / PRODUCTIVE / …) als Textlabel
  - ACWR (Acute:Chronic Workload Ratio) + Status — Garmins Verletzungs-Last-Lens
  - VO2max (Rad + Laufen)
  - Resting HR (Cross-Check gegen intervals.icu)

Schreibt nach DATA_DIR/garmin.json — dieselbe Datei-Konvention wie habits.json.
Die /api/garmin-Route liest sie. Läuft per Host-Cron neben habits-sync.py.

Umgebungsvariablen:
  GARMIN_EMAIL        — Garmin-Connect-Login
  GARMIN_PASSWORD     — Garmin-Connect-Passwort   (env-Datei chmod 600!)
  GARMIN_TOKENSTORE   — Pfad für OAuth-Tokens (Standard: ~/.garminconnect)
  GARMIN_DATA_DIR     — Zielordner für garmin.json
                        (Standard: /opt/intervals-dashboard/habits-data)
  GARMIN_DAYS         — Anzahl Tage rückwärts (Standard: 7)
  DEBUG               — "1" → Rohantworten als garmin-raw-<datum>.json speichern
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
    """Lädt gespeicherte Tokens; nur beim ersten Lauf echter Login + ggf. MFA."""
    client = Garmin(EMAIL, PASSWORD, prompt_mfa=lambda: input("MFA-Code: "))
    try:
        client.login(TOKENSTORE)          # lädt Tokens aus dem Store
    except Exception:
        client.login()                    # frischer Login, dann Tokens sichern
        client.garth.dump(TOKENSTORE)
    return client


# ── Defensive Extraktoren ───────────────────────────────────────────────────
def _save_raw(tag: str, d: str, obj) -> None:
    if not DEBUG:
        return
    p = os.path.join(DATA_DIR, f"garmin-raw-{d}-{tag}.json")
    with open(p, "w") as f:
        json.dump(obj, f, indent=2, default=str)


def extract_body_battery(raw) -> dict:
    # get_body_battery → Liste; Einträge sind [timestamp, wert] → Wert an Index 1.
    try:
        day = raw[0] if isinstance(raw, list) and raw else raw
        arr = day.get("bodyBatteryValuesArray") or []
        vals = [row[1] for row in arr if len(row) > 1 and isinstance(row[1], (int, float))]
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
            "stressAvg": raw.get("avgStressLevel"),
            "stressMax": raw.get("maxStressLevel"),
        }
    except Exception:
        return {"stressAvg": None, "stressMax": None}


def extract_sleep(raw) -> dict:
    try:
        dto = raw.get("dailySleepDTO", raw) or {}
        score = None
        ss = dto.get("sleepScores") or {}
        if isinstance(ss, dict):
            score = (ss.get("overall") or {}).get("value")
        return {
            "sleepSecs":  dto.get("sleepTimeSeconds"),
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
            "readinessScore": item.get("score"),
            "readinessLevel": item.get("level"),
        }
    except Exception:
        return {"readinessScore": None, "readinessLevel": None}


def extract_status(raw) -> dict:
    # raw = get_training_status-Antwort.
    # Pfad: mostRecentTrainingStatus → latestTrainingStatusData → {deviceId}
    try:
        feed = ((raw.get("mostRecentTrainingStatus") or {})
                   .get("latestTrainingStatusData") or {})
        dev = None
        for d in feed.values():
            if d.get("primaryTrainingDevice"):
                dev = d
                break
        if dev is None and feed:
            dev = next(iter(feed.values()))
        if not dev:
            return {"trainingStatus": None, "acwr": None, "acwrStatus": None}
        # "MAINTAINING_4" → "MAINTAINING"
        phrase = dev.get("trainingStatusFeedbackPhrase") or ""
        label  = phrase.rsplit("_", 1)[0] if phrase else None
        acute  = dev.get("acuteTrainingLoadDTO") or {}
        return {
            "trainingStatus": label,
            "acwr":           acute.get("dailyAcuteChronicWorkloadRatio"),
            "acwrStatus":     acute.get("acwrStatus"),
        }
    except Exception:
        return {"trainingStatus": None, "acwr": None, "acwrStatus": None}


def extract_vo2max(raw) -> dict:
    # Garmin: "generic" = Laufen, "cycling" = Radfahren (leistungsbasiert).
    try:
        vo2 = raw.get("mostRecentVO2Max") or {}
        cyc = vo2.get("cycling") or {}
        gen = vo2.get("generic") or {}
        return {
            "vo2maxCycling": cyc.get("vo2MaxPreciseValue"),
            "vo2maxRunning": gen.get("vo2MaxPreciseValue"),
        }
    except Exception:
        return {"vo2maxCycling": None, "vo2maxRunning": None}


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

    grab("bodybattery", lambda: client.get_body_battery(d, d),  extract_body_battery)
    grab("stress",      lambda: client.get_stress_data(d),       extract_stress)
    grab("sleep",       lambda: client.get_sleep_data(d),        extract_sleep)
    grab("readiness",   lambda: client.get_training_readiness(d), extract_readiness)
    grab("stats",       lambda: client.get_stats(d),             extract_rhr)

    # Training Status + ACWR + VO2max stammen aus derselben Antwort → einmal abrufen
    try:
        raw = client.get_training_status(d)
        _save_raw("status", d, raw)
        out.update(extract_status(raw))
        out.update(extract_vo2max(raw))
    except Exception as e:
        print(f"    ⚠ status ({d}): {e}")

    return out


def extract_rhr(raw) -> dict:
    try:
        return {"restingHr": raw.get("restingHeartRate")}
    except Exception:
        return {"restingHr": None}


# ── Hauptprogramm ─────────────────────────────────────────────────────────────
def main():
    if not EMAIL or not PASSWORD:
        print("❌ GARMIN_EMAIL / GARMIN_PASSWORD nicht gesetzt.")
        sys.exit(1)

    os.makedirs(DATA_DIR, exist_ok=True)
    print(f"🔄 Garmin-Sync — letzte {DAYS} Tage → {OUT_FILE}")

    client = connect()
    print("  ✅ Garmin verbunden")

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
        print("  🐛 DEBUG: Rohantworten als garmin-raw-*.json")


if __name__ == "__main__":
    main()
