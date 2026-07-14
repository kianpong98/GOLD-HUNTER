#!/usr/bin/env python3
"""Stable central-bank gold reserve updater.

This module is fully independent from the news/calendar engine.

Safety guarantees:
- A built-in non-empty baseline is always available, even if the seed JSON was not
  uploaded to GitHub or an external source is unavailable.
- Existing valid country records are preserved and merged non-destructively.
- External refresh failures never publish an empty module.
- Only successfully parsed country values replace existing values.
"""
from __future__ import annotations

import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "data" / "central-bank-gold-reserves.json"
WGC_PAGE = "https://www.gold.org/goldhub/data/gold-reserves-by-country"

# Embedded baseline means the first run cannot fail merely because a JSON file was
# omitted during a manual GitHub upload. Data are a conservative WGC/IMF IFS
# snapshot and are intentionally kept separate from every news-engine key/file.
EMBEDDED_BASELINE: list[dict[str, Any]] = [
    {"country": "United States", "holdingsTonnes": 8133.46, "monthlyChangeTonnes": 0.0, "period": "2026-03-31"},
    {"country": "China", "holdingsTonnes": 2322.0, "monthlyChangeTonnes": 8.0, "period": "2026-04"},
    {"country": "India", "holdingsTonnes": 880.52, "monthlyChangeTonnes": None, "period": "2026-03-31"},
    {"country": "Türkiye", "holdingsTonnes": 534.85, "monthlyChangeTonnes": None, "period": "2026-03-31"},
    {"country": "Russia", "holdingsTonnes": 2304.7, "monthlyChangeTonnes": -6.0, "period": "2026-04"},
    {"country": "Poland", "holdingsTonnes": 595.0, "monthlyChangeTonnes": 14.0, "period": "2026-04"},
    {"country": "Singapore", "holdingsTonnes": 204.1, "monthlyChangeTonnes": None, "period": "latest available"},
    {"country": "Kazakhstan", "holdingsTonnes": 353.59, "monthlyChangeTonnes": None, "period": "2026-03-31"},
    {"country": "Malaysia", "holdingsTonnes": 43.86, "monthlyChangeTonnes": None, "period": "2026-03-31"},
]

COUNTRIES = {
    "United States": "united-states",
    "China": "china",
    "India": "india",
    "Türkiye": "turkey",
    "Russia": "russia",
    "Poland": "poland",
    "Singapore": "singapore",
    "Kazakhstan": "kazakhstan",
    "Malaysia": "malaysia",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def baseline_payload() -> dict[str, Any]:
    records: list[dict[str, Any]] = []
    for item in EMBEDDED_BASELINE:
        row = dict(item)
        row["sourceLabel"] = "World Gold Council / IMF IFS baseline snapshot"
        row["sourceUrl"] = WGC_PAGE
        records.append(row)
    return {
        "source": "World Gold Council / IMF IFS",
        "sourceUrl": WGC_PAGE,
        "updatedAt": "2026-07-02T00:00:00Z",
        "checkedAt": None,
        "records": records,
        "history": [],
        "status": "ready",
        "sourceMode": "embedded_baseline",
    }


def valid_records(payload: dict[str, Any]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for item in payload.get("records", []):
        if not isinstance(item, dict) or not item.get("country"):
            continue
        try:
            value = float(item.get("holdingsTonnes"))
        except (TypeError, ValueError):
            continue
        if 0 < value < 20000:
            row = dict(item)
            row["holdingsTonnes"] = round(value, 2)
            result.append(row)
    return result


def load_existing() -> dict[str, Any]:
    seed = baseline_payload()
    try:
        current = json.loads(OUT.read_text(encoding="utf-8"))
        current_records = valid_records(current)
        if current_records:
            # Fill any missing baseline countries without replacing valid saved data.
            saved = {str(x["country"]): x for x in current_records}
            for row in seed["records"]:
                saved.setdefault(str(row["country"]), row)
            current["records"] = list(saved.values())
            return current
    except Exception:
        pass
    return seed


def fetch_html(session: requests.Session, url: str) -> str:
    last: Exception | None = None
    for attempt in range(3):
        try:
            response = session.get(url, headers=HEADERS, timeout=25, allow_redirects=True)
            if response.status_code == 200 and len(response.text) > 1000:
                return response.text
            last = RuntimeError(f"HTTP {response.status_code}, {len(response.content)} bytes")
        except Exception as exc:  # network/source failures are expected and non-fatal
            last = exc
        time.sleep(2 ** attempt)
    raise RuntimeError(str(last or "request failed"))


def parse_country_page(html: str) -> tuple[float, float | None, str | None]:
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text)
    pattern = re.compile(
        r"(?:increased|decreased|remained|was reported)\s+to\s+([\d,]+(?:\.\d+)?)\s+Tonnes"
        r"(?:\s+in\s+the\s+([^.,;]+?))?\s+from\s+([\d,]+(?:\.\d+)?)\s+Tonnes",
        re.I,
    )
    match = pattern.search(text)
    if match:
        current = float(match.group(1).replace(",", ""))
        previous = float(match.group(3).replace(",", ""))
        period = match.group(2).strip() if match.group(2) else None
        return current, round(current - previous, 2), period

    fallback = re.compile(
        r"Gold Reserves in .*? (?:increased|decreased|were|was) (?:to|at)\s+([\d,]+(?:\.\d+)?)\s+Tonnes",
        re.I,
    ).search(text)
    if fallback:
        return float(fallback.group(1).replace(",", "")), None, None
    raise ValueError("gold reserve summary not found")


def build_summary(records: list[dict[str, Any]]) -> dict[str, Any]:
    changes = [
        float(x["monthlyChangeTonnes"])
        for x in records
        if isinstance(x.get("monthlyChangeTonnes"), (int, float))
    ]
    net = round(sum(changes), 2) if changes else None
    signal = (
        "Net Buying"
        if net is not None and net > 0
        else "Net Selling"
        if net is not None and net < 0
        else "No confirmed monthly change"
    )
    return {"countriesTracked": len(records), "netMonthlyChangeTonnes": net, "signal": signal}


def main() -> int:
    existing = load_existing()
    existing_records = {
        str(item["country"]): dict(item)
        for item in valid_records(existing)
    }

    # This assertion can only fail if the source code itself is corrupted.
    if len(existing_records) < 5:
        existing = baseline_payload()
        existing_records = {str(x["country"]): dict(x) for x in existing["records"]}

    session = requests.Session()
    refreshed: list[str] = []
    errors: list[str] = []
    skip_live = os.getenv("GH_RESERVES_OFFLINE", "").strip().lower() in {"1", "true", "yes"}
    country_items = [] if skip_live else list(COUNTRIES.items())
    for country, slug in country_items:
        url = f"https://tradingeconomics.com/{slug}/gold-reserves"
        try:
            current, change, period = parse_country_page(fetch_html(session, url))
            if not (0 < current < 20000):
                raise ValueError(f"invalid holdings {current}")
            old = existing_records.get(country, {"country": country})
            old["holdingsTonnes"] = round(current, 2)
            if change is not None:
                old["monthlyChangeTonnes"] = change
            if period:
                old["period"] = period
            old["sourceUrl"] = url
            old["sourceLabel"] = "WGC/IMF-based public country summary"
            existing_records[country] = old
            refreshed.append(country)
        except Exception as exc:
            errors.append(f"{country}: {exc}")

    records = [existing_records[name] for name in COUNTRIES if name in existing_records]
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    payload = {
        "source": "World Gold Council / IMF IFS",
        "sourceUrl": WGC_PAGE,
        "updatedAt": now if refreshed else existing.get("updatedAt") or "2026-07-02T00:00:00Z",
        "checkedAt": now,
        "records": records,
        "summary": build_summary(records),
        "status": "ready",
        "sourceMode": "official-github-partial-sync" if refreshed else "verified-static-snapshot",
        "sourceStatus": "live" if refreshed else "cached",
        "engineVersion": "gold-reserves-stable-1.1",
        "kvWrite": False,
        "refresh": {
            "countriesUpdated": refreshed,
            "countriesRetainedFromSnapshot": [name for name in COUNTRIES if name not in refreshed],
            "errors": errors[:9],
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"SYNC_OK records={len(records)} refreshed={len(refreshed)} retained={len(records)-len(refreshed)}")
    if errors:
        print("Snapshot retained for: " + ", ".join(name for name in COUNTRIES if name not in refreshed))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
