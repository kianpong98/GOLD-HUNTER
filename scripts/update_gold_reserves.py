#!/usr/bin/env python3
"""Update central-bank gold reserve holdings without touching the news engine.

Primary source: World Gold Council official holdings page/downloads (compiled from IMF IFS).
The updater is deliberately non-destructive: when the source is unavailable or its
format changes, the existing JSON is kept unchanged and the workflow exits cleanly.
"""
from __future__ import annotations

import io
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

import requests
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "data" / "central-bank-gold-reserves.json"
PAGE = "https://www.gold.org/goldhub/data/gold-reserves-by-country"
HEADERS = {"User-Agent": "Mozilla/5.0 GoldHunterDataBot/1.0", "Accept": "text/html,application/xhtml+xml"}
COUNTRY_ALIASES = {
    "united states": "United States", "usa": "United States", "u.s.": "United States",
    "china": "China", "people's republic of china": "China",
    "india": "India", "turkey": "Türkiye", "türkiye": "Türkiye",
    "russia": "Russia", "russian federation": "Russia", "poland": "Poland",
    "singapore": "Singapore", "kazakhstan": "Kazakhstan", "malaysia": "Malaysia",
    "germany": "Germany", "italy": "Italy", "france": "France", "switzerland": "Switzerland",
}
PRIORITY = ["United States", "China", "India", "Türkiye", "Russia", "Poland", "Singapore", "Kazakhstan", "Malaysia"]


def load_existing() -> dict[str, Any]:
    try:
        return json.loads(OUT.read_text(encoding="utf-8"))
    except Exception:
        return {"records": [], "history": [], "updatedAt": None}


def num(v: Any) -> float | None:
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v or "").strip().replace(",", "")
    m = re.search(r"-?\d+(?:\.\d+)?", s)
    return float(m.group()) if m else None


def normalize_country(v: Any) -> str | None:
    raw = re.sub(r"\s+", " ", str(v or "").strip())
    if not raw:
        return None
    return COUNTRY_ALIASES.get(raw.casefold(), raw)


def discover_download(session: requests.Session) -> str:
    html = session.get(PAGE, headers=HEADERS, timeout=35).text
    # Prefer official xlsx/csv download links embedded in HTML or JSON state.
    links = re.findall(r'''(?:href|url|downloadUrl)["'=:\s]+["']([^"']+\.(?:xlsx|xls|csv)(?:\?[^"']*)?)["']''', html, re.I)
    links += re.findall(r'''https?://[^"'<>\s]+\.(?:xlsx|xls|csv)(?:\?[^"'<>\s]*)?''', html, re.I)
    candidates = []
    for link in links:
        u = urljoin(PAGE, link.replace("\\/", "/"))
        score = sum(k in u.lower() for k in ("reserve", "holding", "official", "gold"))
        candidates.append((score, u))
    if not candidates:
        raise RuntimeError("No official WGC holdings download link found")
    candidates.sort(reverse=True)
    return candidates[0][1]


def parse_csv(data: bytes) -> list[dict[str, Any]]:
    import csv
    text = data.decode("utf-8-sig", errors="replace")
    rows = list(csv.reader(io.StringIO(text)))
    return parse_rows(rows)


def parse_xlsx(data: bytes) -> list[dict[str, Any]]:
    wb = load_workbook(io.BytesIO(data), data_only=True, read_only=True)
    best: list[dict[str, Any]] = []
    for ws in wb.worksheets:
        rows = [[c for c in row] for row in ws.iter_rows(values_only=True)]
        parsed = parse_rows(rows)
        if len(parsed) > len(best):
            best = parsed
    return best


def parse_rows(rows: list[list[Any]]) -> list[dict[str, Any]]:
    header_idx = -1
    cols: dict[str, int] = {}
    for i, row in enumerate(rows[:60]):
        labels = [str(x or "").strip().casefold() for x in row]
        for j, label in enumerate(labels):
            if any(k in label for k in ("country", "economy", "institution")):
                cols["country"] = j
            if "tonne" in label or "metric ton" in label or label in {"gold", "holdings"}:
                cols.setdefault("holdings", j)
            if any(k in label for k in ("monthly change", "change (t", "change tonnes", "net purchase")):
                cols["change"] = j
            if any(k in label for k in ("percent of reserves", "% of reserves", "share of reserves")):
                cols["share"] = j
            if any(k in label for k in ("date", "month", "period")):
                cols.setdefault("period", j)
        if "country" in cols and "holdings" in cols:
            header_idx = i
            break
        cols = {}
    if header_idx < 0:
        return []
    out: list[dict[str, Any]] = []
    for row in rows[header_idx + 1:]:
        if len(row) <= max(cols.values()):
            continue
        country = normalize_country(row[cols["country"]])
        holdings = num(row[cols["holdings"]])
        if not country or holdings is None or holdings <= 0 or holdings > 20000:
            continue
        item: dict[str, Any] = {"country": country, "holdingsTonnes": round(holdings, 2)}
        if "change" in cols:
            change = num(row[cols["change"]])
            if change is not None and abs(change) < 10000:
                item["monthlyChangeTonnes"] = round(change, 2)
        if "share" in cols:
            share = num(row[cols["share"]])
            if share is not None and 0 <= share <= 100:
                item["shareOfReservesPct"] = round(share, 2)
        if "period" in cols and row[cols["period"]] is not None:
            item["period"] = str(row[cols["period"]]).strip()
        out.append(item)
    dedup = {x["country"]: x for x in out}
    return list(dedup.values())


def main() -> int:
    existing = load_existing()
    session = requests.Session()
    try:
        url = discover_download(session)
        resp = session.get(url, headers=HEADERS, timeout=60)
        resp.raise_for_status()
        ctype = resp.headers.get("content-type", "").lower()
        records = parse_csv(resp.content) if "csv" in ctype or ".csv" in url.lower() else parse_xlsx(resp.content)
        selected = [x for name in PRIORITY for x in records if x["country"] == name]
        if len(selected) < 5:
            raise RuntimeError(f"Official file parsed but only {len(selected)} priority countries were found")
        updated = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        changes = [x.get("monthlyChangeTonnes") for x in selected if isinstance(x.get("monthlyChangeTonnes"), (int, float))]
        payload = {
            "source": "World Gold Council / IMF IFS",
            "sourceUrl": PAGE,
            "downloadUrl": url,
            "updatedAt": updated,
            "records": selected,
            "summary": {
                "countriesTracked": len(selected),
                "netMonthlyChangeTonnes": round(sum(changes), 2) if changes else None,
                "signal": "Net Buying" if changes and sum(changes) > 0 else "Net Selling" if changes and sum(changes) < 0 else "Unchanged / unavailable",
            },
        }
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Updated {len(selected)} central-bank reserve records from {url}")
        return 0
    except Exception as exc:
        # Non-destructive by design: retain the last successful official snapshot.
        print(f"WARNING: central-bank gold reserve sync skipped: {exc}", file=sys.stderr)
        if not OUT.exists():
            OUT.parent.mkdir(parents=True, exist_ok=True)
            OUT.write_text(json.dumps({
                "source": "World Gold Council / IMF IFS",
                "sourceUrl": PAGE,
                "updatedAt": None,
                "records": [],
                "summary": {"countriesTracked": 0, "netMonthlyChangeTonnes": None, "signal": "Awaiting first official sync"},
                "status": "awaiting_sync",
            }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
