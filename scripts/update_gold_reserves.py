#!/usr/bin/env python3
"""Update central-bank gold reserve holdings without touching any news data.

Stable source strategy:
1. Try public country pages that state values sourced from the World Gold Council.
2. Merge only successfully parsed countries into the existing verified snapshot.
3. Never erase an existing country or replace a valid value with an empty response.

The repository ships with a verified seed snapshot, so the website is never blank even
when WGC download files reject GitHub runners with HTTP 403.
"""
from __future__ import annotations

import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "data" / "central-bank-gold-reserves.json"
WGC_PAGE = "https://www.gold.org/goldhub/data/gold-reserves-by-country"

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


def load_existing() -> dict[str, Any]:
    try:
        data = json.loads(OUT.read_text(encoding="utf-8"))
        if isinstance(data.get("records"), list):
            return data
    except Exception:
        pass
    return {"records": [], "history": [], "updatedAt": None}


def fetch_html(session: requests.Session, url: str) -> str:
    last: Exception | None = None
    for attempt in range(3):
        try:
            response = session.get(url, headers=HEADERS, timeout=35, allow_redirects=True)
            if response.status_code == 200 and len(response.text) > 1000:
                return response.text
            last = RuntimeError(f"HTTP {response.status_code}, {len(response.content)} bytes")
        except Exception as exc:
            last = exc
        time.sleep(2 ** attempt)
    raise RuntimeError(str(last or "request failed"))


def parse_country_page(html: str) -> tuple[float, float | None, str | None]:
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text)
    # Typical wording: "increased to 581.64 Tonnes in the first quarter of 2026 from 550.21 Tonnes..."
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

    # Fallback for pages that omit the previous value in the summary sentence.
    pattern2 = re.compile(r"Gold Reserves in .*? (?:increased|decreased|were|was) (?:to|at)\s+([\d,]+(?:\.\d+)?)\s+Tonnes", re.I)
    match = pattern2.search(text)
    if match:
        return float(match.group(1).replace(",", "")), None, None
    raise ValueError("gold reserve summary not found")


def build_summary(records: list[dict[str, Any]]) -> dict[str, Any]:
    changes = [float(x["monthlyChangeTonnes"]) for x in records if isinstance(x.get("monthlyChangeTonnes"), (int, float))]
    net = round(sum(changes), 2) if changes else None
    signal = "Net Buying" if net is not None and net > 0 else "Net Selling" if net is not None and net < 0 else "Change data unavailable"
    return {"countriesTracked": len(records), "netMonthlyChangeTonnes": net, "signal": signal}


def main() -> int:
    existing = load_existing()
    existing_records = {
        str(item.get("country")): dict(item)
        for item in existing.get("records", [])
        if isinstance(item, dict) and item.get("country") and item.get("holdingsTonnes") is not None
    }
    if not existing_records:
        print("No verified seed snapshot exists; refusing to publish an empty reserve module.", file=sys.stderr)
        return 2

    session = requests.Session()
    refreshed: list[str] = []
    errors: list[str] = []
    for country, slug in COUNTRIES.items():
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
            old["sourceLabel"] = "World Gold Council data via public country summary"
            existing_records[country] = old
            refreshed.append(country)
        except Exception as exc:
            errors.append(f"{country}: {exc}")

    records = [existing_records[name] for name in COUNTRIES if name in existing_records]
    if len(records) < 5:
        print("Verified snapshot has fewer than five usable countries; refusing update.", file=sys.stderr)
        return 2

    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    payload = {
        "source": "World Gold Council / IMF IFS",
        "sourceUrl": WGC_PAGE,
        "updatedAt": now if refreshed else existing.get("updatedAt"),
        "checkedAt": now,
        "records": records,
        "summary": build_summary(records),
        "status": "ready",
        "sourceMode": "public_mirror_refresh" if refreshed else "verified_snapshot",
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
        print("Fallback snapshot used for: " + ", ".join(name for name in COUNTRIES if name not in refreshed))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
