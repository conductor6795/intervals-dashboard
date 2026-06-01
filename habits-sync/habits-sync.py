#!/usr/bin/env python3
"""
habits-sync.py — Dynamischer Sync: habits.json → Notion "🏃 Habits Tracker"

Vollautomatisch:
  - Liest Habit-Definitionen aus habits.json (Name, Emoji, Typ)
  - Erstellt fehlende Notion-Spalten automatisch
  - Löscht KEINE bestehenden Spalten (Datenverlust-Schutz)
  - Für SD-Habits: Checkbox + Zahl + Aufschlüsselung

Umgebungsvariablen (.env.local oder systemd-Unit):
  HABITS_API_URL        — z.B. http://localhost:3003/api/habits
  HABITS_READ_TOKEN     — Token für /api/habits (falls gesetzt)
  NOTION_TOKEN = os.environ.get("91d63fe674fdac6cfe69595da51f94795f68a7cffaae6f5f", "")
  NOTION_DB_ID          — Notion Datenbank-ID
  SYNC_DATE             — optional: YYYY-MM-DD (Standard: heute)

Aufruf:
  python3 /opt/habits-sync/habits-sync.py
  SYNC_DATE=2026-05-28 python3 /opt/habits-sync/habits-sync.py
"""

import os, json, sys, requests
from datetime import date as Date, datetime

# ── Konfiguration ─────────────────────────────────────────────────────────────
HABITS_API_URL  = os.environ.get("HABITS_API_URL",        "http://localhost:3003/api/habits")
HABITS_TOKEN    = os.environ.get("HABITS_READ_TOKEN",     "")
NOTION_TOKEN    = os.environ.get("NOTION_HABITS_TOKEN",   "")
NOTION_DB_ID    = os.environ.get("NOTION_DB_ID",          "3ad27c8ff878491db7dd9b623a05d8e6")
SYNC_DATE       = os.environ.get("SYNC_DATE",             str(Date.today()))

NOTION_HEADERS  = {
    "Authorization":  f"Bearer {NOTION_TOKEN}",
    "Content-Type":   "application/json",
    "Notion-Version": "2022-06-28",
}

DRINK_SD = {
    "0,2L Bier":  0.6,
    "0,33L Bier": 1.0,
    "0,5L Bier":  1.5,
    "Shot":       1.3,
    "Mische":     1.5,
    "Cocktail":   1.3,
}

# ── Habits-API ────────────────────────────────────────────────────────────────
def fetch_habits_data() -> dict:
    headers = {}
    if HABITS_TOKEN:
        headers["x-token"] = HABITS_TOKEN
    r = requests.get(HABITS_API_URL, headers=headers, timeout=10)
    r.raise_for_status()
    return r.json()


# ── Notion: DB-Schema ─────────────────────────────────────────────────────────
def get_db_properties() -> dict:
    """Gibt die aktuellen Notion-Spalten zurück: {name: {id, type}}"""
    r = requests.get(
        f"https://api.notion.com/v1/databases/{NOTION_DB_ID}",
        headers=NOTION_HEADERS, timeout=10,
    )
    r.raise_for_status()
    return {k: {"id": v["id"], "type": v["type"]} for k, v in r.json()["properties"].items()}


def ensure_property(name: str, notion_type: str, existing: dict) -> dict:
    """Erstellt eine neue Notion-Spalte falls sie noch nicht existiert."""
    if name in existing:
        return existing

    type_config = {
        "checkbox":   {"checkbox": {}},
        "number":     {"number": {"format": "number"}},
        "rich_text":  {"rich_text": {}},
    }.get(notion_type, {"rich_text": {}})

    payload = {"properties": {name: {**type_config, "name": name}}}
    r = requests.patch(
        f"https://api.notion.com/v1/databases/{NOTION_DB_ID}",
        headers=NOTION_HEADERS, json=payload, timeout=10,
    )
    if r.ok:
        print(f"  ✅ Spalte erstellt: '{name}' ({notion_type})")
        existing[name] = {"type": notion_type}
    else:
        print(f"  ⚠ Spalte '{name}' konnte nicht erstellt werden: {r.text[:100]}")
    return existing


# ── Notion: Seite finden oder erstellen ──────────────────────────────────────
def find_notion_page(target_date: str) -> str | None:
    """Sucht eine bestehende Seite für das Datum."""
    payload = {
        "filter": {
            "property": "Datum",
            "date": {"equals": target_date},
        }
    }
    r = requests.post(
        f"https://api.notion.com/v1/databases/{NOTION_DB_ID}/query",
        headers=NOTION_HEADERS, json=payload, timeout=10,
    )
    if r.ok:
        results = r.json().get("results", [])
        if results:
            return results[0]["id"]
    return None


def create_notion_page(target_date: str, properties: dict) -> str:
    """Erstellt eine neue Seite für das Datum."""
    payload = {
        "parent": {"database_id": NOTION_DB_ID},
        "properties": {
            "Datum": {"date": {"start": target_date}},
            **properties,
        },
    }
    r = requests.post(
        "https://api.notion.com/v1/pages",
        headers=NOTION_HEADERS, json=payload, timeout=10,
    )
    r.raise_for_status()
    return r.json()["id"]


def update_notion_page(page_id: str, properties: dict):
    """Aktualisiert eine bestehende Seite."""
    r = requests.patch(
        f"https://api.notion.com/v1/pages/{page_id}",
        headers=NOTION_HEADERS,
        json={"properties": properties},
        timeout=10,
    )
    r.raise_for_status()


# ── Eigenschaften aufbauen ────────────────────────────────────────────────────
def build_notion_properties(habits: list, day: dict, drinks_day: dict) -> dict:
    """
    Baut den Notion-Properties-Dict für einen Tag.
    Automatisch aus den Habit-Definitionen abgeleitet.
    """
    checked   = set(day.get("checked", []))
    numeric   = day.get("numeric", {})
    props     = {}

    for h in habits:
        hid   = h["id"]
        emoji = h.get("emoji", "")
        name  = h.get("name", "")
        unit  = h.get("unit", "").lower()
        htype = h.get("habitType", "checkbox")
        col   = f"{emoji} {name}".strip()   # Notion-Spaltenname

        if unit == "sd":
            # SD-Habit: Checkbox (hat Alkohol?) + Zahl (Menge) + Aufschlüsselung
            has_drinks  = hid in checked or (hid in numeric and numeric[hid] > 0)
            sd_value    = numeric.get(hid, 0)
            drink_counts = drinks_day.get(hid, {})

            props[col] = {"checkbox": has_drinks}
            props[f"{col} (SD)"] = {"number": round(sd_value, 2) if sd_value else None}

            if drink_counts:
                parts = [
                    f"{cnt}× {drink}"
                    for drink, cnt in drink_counts.items()
                    if cnt > 0
                ]
                breakdown = f"{', '.join(parts)} = {sd_value} SD"
                props[f"{col} Aufschlüsselung"] = {
                    "rich_text": [{"text": {"content": breakdown[:2000]}}]
                }

        elif htype == "numeric":
            # Andere numerische Habits (z.B. Wasser in L)
            val = numeric.get(hid)
            props[col] = {"number": round(val, 2) if val is not None else None}

        else:
            # Checkbox-Habits
            props[col] = {"checkbox": hid in checked}

    # Stimmung
    mood = day.get("mood")
    if mood is not None:
        mood_labels = {1: "😴 Sehr schlecht", 2: "😟 Schlecht", 3: "😐 Okay",
                       4: "😊 Gut", 5: "🔥 Ausgezeichnet"}
        props["Stimmung"] = {
            "rich_text": [{"text": {"content": mood_labels.get(mood, str(mood))}}]
        }

    return props


# ── Sicherstellen dass alle Spalten in Notion existieren ─────────────────────
def ensure_all_columns(habits: list, existing: dict) -> dict:
    """Erstellt fehlende Notion-Spalten für alle aktuellen Habits."""
    for h in habits:
        emoji = h.get("emoji", "")
        name  = h.get("name", "")
        unit  = h.get("unit", "").lower()
        htype = h.get("habitType", "checkbox")
        col   = f"{emoji} {name}".strip()

        if unit == "sd":
            existing = ensure_property(col,                    "checkbox",  existing)
            existing = ensure_property(f"{col} (SD)",          "number",    existing)
            existing = ensure_property(f"{col} Aufschlüsselung", "rich_text", existing)
        elif htype == "numeric":
            existing = ensure_property(col, "number", existing)
        else:
            existing = ensure_property(col, "checkbox", existing)

    ensure_property("Stimmung", "rich_text", existing)
    return existing


# ── Hauptprogramm ─────────────────────────────────────────────────────────────
def main():
    print(f"🔄 Sync für {SYNC_DATE}")

    # 1. Habits-Daten laden
    data       = fetch_habits_data()
    habits     = data.get("habits", [])
    history    = data.get("history", {})
    day        = history.get(SYNC_DATE, {})
    drinks_day = day.get("drinks", {})

    if not habits:
        print("⚠ Keine Habits gefunden.")
        sys.exit(0)

    print(f"  Habits: {len(habits)} · Datum: {SYNC_DATE}")

    # 2. Notion-Schema laden und fehlende Spalten anlegen
    print("📐 Prüfe Notion-Spalten …")
    existing = get_db_properties()
    existing = ensure_all_columns(habits, existing)

    # 3. Properties aufbauen
    props = build_notion_properties(habits, day, drinks_day)

    # None-Werte herausfiltern (Notion mag keine None-Zahlen)
    props = {
        k: v for k, v in props.items()
        if not (isinstance(v, dict) and v.get("number") is None)
    }

    if not props:
        print("ℹ Keine Daten für diesen Tag.")
        return

    # 4. Seite finden oder erstellen
    page_id = find_notion_page(SYNC_DATE)

    if page_id:
        update_notion_page(page_id, props)
        print(f"✅ Seite aktualisiert ({SYNC_DATE}): {list(props.keys())}")
    else:
        page_id = create_notion_page(SYNC_DATE, props)
        print(f"✅ Neue Seite erstellt ({SYNC_DATE}): {list(props.keys())}")


if __name__ == "__main__":
    main()
