#!/usr/bin/env python3
"""
habits-sync.py — Dynamischer Sync: habits.json → Notion "🏃 Habits Tracker"

Spalten-Logik:
  - Checkbox-Habits    → Checkbox-Spalte  "{emoji} {name}"
  - Wasser (unit L)    → Text-Spalte      "{emoji} {name}" mit "getrunken/ziel" (z.B. "3,7/3,5")
  - SD-Habits (Alkohol)→ Zahl-Spalte      "{emoji} {name} (SD)"  — kein Checkbox, keine Aufschlüsselung
  - Andere Zahlen      → Zahl-Spalte      "{emoji} {name}"
  - Stimmung           → bestehende Spalte "Mood (1-5)" als Zahl
  - Neue Spalten werden automatisch erstellt
  - Bestehende Spalten werden NIE gelöscht (Datenverlust-Schutz)

Tippfehler oder Umbenennungen in Habit-Namen → COLUMN_ALIASES eintragen

Umgebungsvariablen (.env.local):
  HABITS_API_URL        — http://localhost:3003/api/habits
  HABITS_READ_TOKEN     — Token für /api/habits
  NOTION_HABITS_TOKEN   — Notion Integration Token (ntn_...)
  NOTION_DB_ID          — Notion Datenbank-ID
  SYNC_DATE             — optional YYYY-MM-DD (Standard: heute)
"""

import os, sys, requests
from datetime import date as Date

# ── Konfiguration ─────────────────────────────────────────────────────────────
HABITS_API_URL = os.environ.get("HABITS_API_URL",      "http://localhost:3003/api/habits")
HABITS_TOKEN   = os.environ.get("HABITS_READ_TOKEN",   "")
NOTION_TOKEN   = os.environ.get("NOTION_HABITS_TOKEN", "")
NOTION_DB_ID   = os.environ.get("NOTION_DB_ID",        "3ad27c8ff878491db7dd9b623a05d8e6")
SYNC_DATE      = os.environ.get("SYNC_DATE",            str(Date.today()))
BACKFILL       = os.environ.get("BACKFILL", "0") == "1"  # BACKFILL=1 → alle Daten nachladen

NOTION_HEADERS = {
    "Authorization":  f"Bearer {NOTION_TOKEN}",
    "Content-Type":   "application/json",
    "Notion-Version": "2022-06-28",
}

# Wenn ein Habit-Name einen Tippfehler hat oder umbenannt wurde,
# hier den auto-generierten Namen → bestehenden Notion-Spaltennamen mappen.
# Format: "emoji name (auto-generiert)" → "Notion-Spaltenname (existierend)"
COLUMN_ALIASES: dict[str, str] = {
    "💪 Trainigsplan": "💪 Trainingsplan",   # Tippfehler im Habit-Namen
}

# ── Hilfsfunktionen ───────────────────────────────────────────────────────────
def fmt(val: float) -> str:
    """Zahl mit deutschem Komma formatieren."""
    return f"{val:.1f}".replace(".", ",")


def col_name(h: dict, suffix: str = "") -> str:
    """Notion-Spaltenname aus Habit ableiten, Alias auflösen."""
    raw = f"{h.get('emoji', '')} {h.get('name', '')}".strip()
    if suffix:
        raw = f"{raw} {suffix}"
    return COLUMN_ALIASES.get(raw, raw)


# ── Habits-API ────────────────────────────────────────────────────────────────
def fetch_habits() -> dict:
    headers = {"x-token": HABITS_TOKEN} if HABITS_TOKEN else {}
    r = requests.get(HABITS_API_URL, headers=headers, timeout=10)
    r.raise_for_status()
    return r.json()


# ── Notion: DB-Schema ─────────────────────────────────────────────────────────
def get_db_schema() -> dict:
    r = requests.get(
        f"https://api.notion.com/v1/databases/{NOTION_DB_ID}",
        headers=NOTION_HEADERS, timeout=10,
    )
    r.raise_for_status()
    return {k: v["type"] for k, v in r.json()["properties"].items()}


def ensure_col(name: str, notion_type: str, schema: dict) -> dict:
    """Erstellt oder korrigiert Notion-Spalte."""
    if name in schema:
        if schema[name] == notion_type:
            return schema  # Typ stimmt — nichts zu tun
        # Falscher Typ → Notion-Spalte aktualisieren
        print(f"  🔄 Typ-Update: '{name}' ({schema[name]} → {notion_type})")
    type_cfg = {
        "checkbox":  {"checkbox": {}},
        "number":    {"number": {"format": "number"}},
        "rich_text": {"rich_text": {}},
    }.get(notion_type, {"rich_text": {}})
    r = requests.patch(
        f"https://api.notion.com/v1/databases/{NOTION_DB_ID}",
        headers=NOTION_HEADERS,
        json={"properties": {name: {**type_cfg, "name": name}}},
        timeout=10,
    )
    if r.ok:
        print(f"  ✅ Spalte OK: '{name}' ({notion_type})")
        schema[name] = notion_type
    else:
        print(f"  ⚠ Spalte '{name}' Fehler: {r.text[:200]}")
    return schema


# ── Notion: Seite finden / erstellen / aktualisieren ─────────────────────────
def find_page(date_str: str) -> str | None:
    r = requests.post(
        f"https://api.notion.com/v1/databases/{NOTION_DB_ID}/query",
        headers=NOTION_HEADERS,
        json={"filter": {"property": "Datum", "date": {"equals": date_str}}},
        timeout=10,
    )
    if r.ok:
        res = r.json().get("results", [])
        return res[0]["id"] if res else None
    return None


def upsert_page(date_str: str, props: dict):
    page_id = find_page(date_str)
    if page_id:
        r = requests.patch(
            f"https://api.notion.com/v1/pages/{page_id}",
            headers=NOTION_HEADERS,
            json={"properties": props},
            timeout=10,
        )
        if not r.ok:
            print(f"  ❌ Update Fehler {r.status_code}: {r.text[:300]}")
            r.raise_for_status()
        print(f"  ✅ Seite aktualisiert ({date_str})")
    else:
        r = requests.post(
            "https://api.notion.com/v1/pages",
            headers=NOTION_HEADERS,
            json={"parent": {"database_id": NOTION_DB_ID},
                  "properties": {"Datum": {"date": {"start": date_str}}, **props}},
            timeout=10,
        )
        if not r.ok:
            print(f"  ❌ Create Fehler {r.status_code}: {r.text[:300]}")
            r.raise_for_status()
        print(f"  ✅ Seite erstellt ({date_str})")


# ── Properties aufbauen ───────────────────────────────────────────────────────
def build_props(habits: list, day: dict) -> tuple[dict, dict]:
    """
    Gibt (properties, benötigte_spalten) zurück.
    benötigte_spalten: {name: notion_type}
    """
    checked  = set(day.get("checked", []))
    numeric  = day.get("numeric", {})
    props    = {}
    needed   = {}

    for h in habits:
        hid   = h["id"]
        unit  = h.get("unit", "").lower()
        htype = h.get("habitType", "checkbox")
        tgt   = h.get("numTarget", 0)

        if unit == "sd":
            # Nur SD-Zahl — kein Checkbox, keine Aufschlüsselung
            c    = col_name(h, "(SD)")
            val  = numeric.get(hid, 0)
            needed[c] = "number"
            if val:
                props[c] = {"number": round(val, 2)}

        elif unit in ("l", "liter"):
            # Wasser: eine Textspalte "getrunken/ziel"
            # Dynamisches Ziel aus history (falls Dashboard es gespeichert hat), sonst numTarget
            c      = col_name(h)
            actual = numeric.get(hid)
            dyn_targets = day.get("dynamicTargets", {})
            effective_tgt = dyn_targets.get(hid, tgt)
            needed[c] = "rich_text"
            if actual is not None:
                text = f"{fmt(actual)}/{fmt(effective_tgt)}"
                props[c] = {"rich_text": [{"text": {"content": text}}]}

        elif htype == "numeric":
            c   = col_name(h)
            val = numeric.get(hid)
            needed[c] = "number"
            if val is not None:
                props[c] = {"number": round(val, 2)}

        else:
            # Checkbox
            c = col_name(h)
            needed[c] = "checkbox"
            props[c]  = {"checkbox": hid in checked}

    # Stimmung → bestehende "Mood (1-5)" Spalte als Zahl
    mood = day.get("mood")
    if mood is not None:
        needed["Mood (1-5)"] = "number"
        props["Mood (1-5)"]  = {"number": mood}

    return props, needed


# ── Hauptprogramm ─────────────────────────────────────────────────────────────
def main():
    print(f"🔄 Sync für {SYNC_DATE}")

    if not NOTION_TOKEN:
        print("❌ NOTION_HABITS_TOKEN nicht gesetzt.")
        sys.exit(1)

    data    = fetch_habits()
    habits  = data.get("habits", [])
    history = data.get("history", {})
    day     = history.get(SYNC_DATE, {})

    print(f"  Habits: {len(habits)}")

    # Alle benötigten Spalten einmalig prüfen/erstellen (aus heutigem Tag ableiten)
    print("📐 Prüfe Notion-Spalten …")
    schema = get_db_schema()
    _, needed_cols = build_props(habits, day)
    for name, ntype in needed_cols.items():
        schema = ensure_col(name, ntype, schema)

    # Backfill oder nur heute
    dates = sorted(history.keys()) if BACKFILL else [SYNC_DATE]
    print(f"  {'Backfill' if BACKFILL else 'Sync'}: {len(dates)} Tag(e)")

    for d in dates:
        day_d = history.get(d, {})
        props, _ = build_props(habits, day_d)
        if not props:
            continue
        try:
            upsert_page(d, props)
        except Exception as e:
            print(f"  ⚠ {d} übersprungen: {e}")


if __name__ == "__main__":
    main()
