#!/usr/bin/env python3
"""Build a static official-data cache for Gold Hunter.

Sources:
- BLS Public Data API: CPI, Core CPI, PPI, Core PPI, NFP, unemployment.
- FRED CSV (official-source series): retail sales, initial claims, GDP,
  headline/core PCE and the federal funds target range.

The generated JSON is committed by GitHub Actions, so the website does not
rely on Cloudflare reaching every upstream source during a visitor request.
"""
from __future__ import annotations

import csv
import io
import json
import math
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

OUT = Path("data/official-data.json")
UA = "GoldHunterOfficialData/1.0 (+https://goldhunter.site)"
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": UA, "Accept": "application/json,text/csv,*/*"})

BLS_SERIES = {
    "cpi_yoy": {"id": "CUUR0000SA0", "mode": "yoy", "suffix": "%", "decimals": 1},
    "core_cpi_yoy": {"id": "CUUR0000SA0L1E", "mode": "yoy", "suffix": "%", "decimals": 1},
    "ppi_yoy": {"id": "WPUFD4", "mode": "yoy", "suffix": "%", "decimals": 1},
    "core_ppi_yoy": {"id": "WPUFD49116", "mode": "yoy", "suffix": "%", "decimals": 1},
    "nfp": {"id": "CES0000000001", "mode": "change", "suffix": "K", "decimals": 0},
    "unemployment": {"id": "LNS14000000", "mode": "level", "suffix": "%", "decimals": 1},
    "avg_hourly_earnings": {"id": "CES0500000003", "mode": "mom", "suffix": "%", "decimals": 1},
}

FRED_SERIES = {
    "retail_sales": {"id": "RSAFS", "mode": "mom", "suffix": "%", "decimals": 1},
    "jobless_claims": {"id": "ICSA", "mode": "level", "suffix": "K", "decimals": 0, "scale": 0.001},
    "gdp": {"id": "A191RL1Q225SBEA", "mode": "level", "suffix": "%", "decimals": 1, "period": "quarter"},
    "pce": {"id": "PCEPI", "mode": "yoy", "suffix": "%", "decimals": 1},
    "core_pce": {"id": "PCEPILFE", "mode": "yoy", "suffix": "%", "decimals": 1},
}


def request(method: str, url: str, **kwargs: Any) -> requests.Response:
    last: Exception | None = None
    for attempt in range(3):
        try:
            response = SESSION.request(method, url, timeout=20, **kwargs)
            response.raise_for_status()
            return response
        except Exception as exc:  # noqa: BLE001
            last = exc
            if attempt < 2:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"Request failed: {url}: {last}")


def clean_number(value: Any) -> float | None:
    try:
        number = float(str(value).replace(",", "").strip())
        return number if math.isfinite(number) else None
    except (TypeError, ValueError):
        return None


def fmt(value: float | None, suffix: str, decimals: int = 1, scale: float = 1.0) -> str:
    if value is None or not math.isfinite(value):
        return ""
    value *= scale
    text = f"{value:.{decimals}f}"
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return f"{text}{suffix}"


def month_key(row: dict[str, Any]) -> str:
    return f"{row['year']}-{int(str(row['period']).replace('M', '')):02d}"


def bls_rows(series: dict[str, Any]) -> list[dict[str, Any]]:
    rows = [row for row in series.get("data", []) if re.fullmatch(r"M\d\d", str(row.get("period", "")))]
    return sorted(rows, key=month_key, reverse=True)


def bls_metric(series: dict[str, Any], cfg: dict[str, Any]) -> dict[str, Any] | None:
    rows = bls_rows(series)
    if len(rows) < 2:
        return None
    values = {month_key(row): clean_number(row.get("value")) for row in rows}

    def calculate(index: int) -> float | None:
        if index >= len(rows):
            return None
        current = clean_number(rows[index].get("value"))
        if current is None:
            return None
        mode = cfg["mode"]
        if mode == "level":
            return current
        if mode == "change":
            if index + 1 >= len(rows):
                return None
            previous = clean_number(rows[index + 1].get("value"))
            return None if previous is None else current - previous
        if mode == "mom":
            if index + 1 >= len(rows):
                return None
            previous = clean_number(rows[index + 1].get("value"))
            return None if not previous else ((current / previous) - 1) * 100
        if mode == "yoy":
            current_key = month_key(rows[index])
            year, month = current_key.split("-")
            base = values.get(f"{int(year) - 1}-{month}")
            return None if not base else ((current / base) - 1) * 100
        return None

    history: list[dict[str, str]] = []
    for index, row in enumerate(rows):
        actual = calculate(index)
        if actual is None:
            continue
        previous = calculate(index + 1)
        history.append({
            "period": month_key(row),
            "actual": fmt(actual, cfg["suffix"], cfg["decimals"]),
            "previous": fmt(previous, cfg["suffix"], cfg["decimals"]),
        })
        if len(history) == 10:
            break
    if not history:
        return None
    return {
        "actual": history[0]["actual"],
        "previous": history[0]["previous"],
        "period": history[0]["period"],
        "history": history,
    }


def fetch_bls() -> tuple[dict[str, Any], dict[str, str]]:
    """Fetch BLS with a bulk request and isolate failures by retrying series individually.

    BLS occasionally returns a partial/empty bulk payload around major releases. A
    per-series retry prevents one problematic series from blocking CPI, payrolls,
    unemployment or earnings that are already available.
    """
    current_year = datetime.now(timezone.utc).year
    ids = [cfg["id"] for cfg in BLS_SERIES.values()]

    def call(series_ids: list[str]) -> dict[str, Any]:
        response = request(
            "POST",
            "https://api.bls.gov/publicAPI/v2/timeseries/data/",
            headers={"Content-Type": "application/json"},
            data=json.dumps({
                "seriesid": series_ids,
                "startyear": str(current_year - 3),
                "endyear": str(current_year),
            }),
        )
        payload = response.json()
        status = str(payload.get("status") or "").upper()
        if status and status != "REQUEST_SUCCEEDED":
            raise RuntimeError("BLS status: " + str(payload.get("message") or status))
        return {row.get("seriesID"): row for row in payload.get("Results", {}).get("series", [])}

    series_by_id: dict[str, Any] = {}
    bulk_error = ""
    try:
        series_by_id.update(call(ids))
    except Exception as exc:  # noqa: BLE001
        bulk_error = str(exc)

    missing_ids = [series_id for series_id in ids if not series_by_id.get(series_id, {}).get("data")]
    for series_id in missing_ids:
        try:
            series_by_id.update(call([series_id]))
        except Exception:
            pass

    metrics: dict[str, Any] = {}
    errors: dict[str, str] = {}
    for event_type, cfg in BLS_SERIES.items():
        metric = bls_metric(series_by_id.get(cfg["id"], {}), cfg)
        if metric:
            metric["source"] = "U.S. Bureau of Labor Statistics"
            metrics[event_type] = metric
        else:
            errors[event_type] = "BLS returned no usable observations" + (f"; bulk: {bulk_error}" if bulk_error else "")
    return metrics, errors


def fred_rows(series_id: str) -> list[dict[str, Any]]:
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}"
    response = request("GET", url)
    text = response.text.lstrip("\ufeff")
    reader = csv.DictReader(io.StringIO(text))
    rows: list[dict[str, Any]] = []
    value_column = next((name for name in (reader.fieldnames or []) if name and name.upper() != "DATE" and name.lower() != "observation_date"), None)
    date_column = next((name for name in (reader.fieldnames or []) if name and (name.upper() == "DATE" or name.lower() == "observation_date")), None)
    if not value_column or not date_column:
        raise RuntimeError(f"Unexpected FRED CSV columns for {series_id}: {reader.fieldnames}")
    for row in reader:
        value = clean_number(row.get(value_column))
        date = str(row.get(date_column) or "").strip()
        if date and value is not None:
            rows.append({"date": date, "value": value})
    rows.sort(key=lambda item: item["date"], reverse=True)
    if not rows:
        raise RuntimeError(f"FRED series {series_id} returned no usable values")
    return rows


def month_from_date(date: str) -> str:
    return date[:7]


def quarter_from_date(date: str) -> str:
    year = int(date[:4])
    month = int(date[5:7])
    return f"{year}-Q{((month - 1) // 3) + 1}"


def fred_metric(rows: list[dict[str, Any]], cfg: dict[str, Any]) -> dict[str, Any] | None:
    mode = cfg["mode"]

    def calc(index: int) -> float | None:
        if index >= len(rows):
            return None
        current = rows[index]["value"]
        if mode == "level":
            return current
        if mode == "mom":
            if index + 1 >= len(rows) or rows[index + 1]["value"] == 0:
                return None
            return ((current / rows[index + 1]["value"]) - 1) * 100
        if mode == "yoy":
            target_month = month_from_date(rows[index]["date"])
            target_year, target_m = target_month.split("-")
            comparison = f"{int(target_year) - 1}-{target_m}"
            base = next((row["value"] for row in rows if month_from_date(row["date"]) == comparison), None)
            return None if not base else ((current / base) - 1) * 100
        return None

    history: list[dict[str, str]] = []
    for index, row in enumerate(rows):
        actual = calc(index)
        if actual is None:
            continue
        previous = calc(index + 1)
        period = quarter_from_date(row["date"]) if cfg.get("period") == "quarter" else (row["date"] if mode == "level" else month_from_date(row["date"]))
        history.append({
            "period": period,
            "observationDate": row["date"],
            "actual": fmt(actual, cfg["suffix"], cfg["decimals"], cfg.get("scale", 1.0)),
            "previous": fmt(previous, cfg["suffix"], cfg["decimals"], cfg.get("scale", 1.0)),
        })
        if len(history) == 10:
            break
    if not history:
        return None
    return {
        "actual": history[0]["actual"],
        "previous": history[0]["previous"],
        "period": history[0]["period"],
        "observationDate": history[0].get("observationDate"),
        "history": history,
    }


def fetch_fred() -> tuple[dict[str, Any], dict[str, str]]:
    from concurrent.futures import ThreadPoolExecutor, as_completed
    metrics: dict[str, Any] = {}
    errors: dict[str, str] = {}

    def one(item):
        event_type, cfg = item
        metric = fred_metric(fred_rows(cfg["id"]), cfg)
        if not metric:
            raise RuntimeError("No usable metric")
        metric["source"] = "FRED (official-source series)"
        return event_type, metric

    with ThreadPoolExecutor(max_workers=len(FRED_SERIES)) as pool:
        futures = {pool.submit(one, item): item[0] for item in FRED_SERIES.items()}
        for future in as_completed(futures):
            event_type = futures[future]
            try:
                key, metric = future.result()
                metrics[key] = metric
            except Exception as exc:  # noqa: BLE001
                errors[event_type] = str(exc)
    return metrics, errors




VERIFIED_FOMC_HISTORY = [
    {"period": "2026-06-18", "observationDate": "2026-06-18", "actual": "3.5–3.75%", "previous": "3.5–3.75%"},
    {"period": "2026-04-30", "observationDate": "2026-04-30", "actual": "3.5–3.75%", "previous": "3.5–3.75%"},
    {"period": "2026-03-19", "observationDate": "2026-03-19", "actual": "3.5–3.75%", "previous": "3.5–3.75%"},
    {"period": "2026-01-29", "observationDate": "2026-01-29", "actual": "3.5–3.75%", "previous": "3.5–3.75%"},
    {"period": "2025-12-11", "observationDate": "2025-12-11", "actual": "3.5–3.75%", "previous": "3.75–4%"},
    {"period": "2025-10-30", "observationDate": "2025-10-30", "actual": "3.75–4%", "previous": "4–4.25%"},
    {"period": "2025-09-18", "observationDate": "2025-09-18", "actual": "4–4.25%", "previous": "4.25–4.5%"},
    {"period": "2025-07-31", "observationDate": "2025-07-31", "actual": "4.25–4.5%", "previous": "4.25–4.5%"},
    {"period": "2025-06-19", "observationDate": "2025-06-19", "actual": "4.25–4.5%", "previous": "4.25–4.5%"},
    {"period": "2025-05-08", "observationDate": "2025-05-08", "actual": "4.25–4.5%", "previous": "4.25–4.5%"},
]
VERIFIED_FOMC_PERIODS = {row["period"] for row in VERIFIED_FOMC_HISTORY}

def sanitize_fomc_history(rows: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for row in list(rows or []) + VERIFIED_FOMC_HISTORY:
        period = str(row.get("period") or "")[:10]
        if period not in VERIFIED_FOMC_PERIODS or not row.get("actual"):
            continue
        canonical = next((x for x in VERIFIED_FOMC_HISTORY if x["period"] == period), {})
        merged[period] = {**merged.get(period, {}), **row, **canonical, "period": period}
    return sorted(merged.values(), key=lambda row: row["period"], reverse=True)[:10]



def fetch_fomc_official_statements() -> tuple[dict[str, Any] | None, str | None]:
    """Read the latest FOMC target ranges directly from Federal Reserve statements.

    This is the primary release-day source. FRED remains a fallback because its
    daily target-range series can update later and cannot identify unchanged
    meeting decisions by itself.
    """
    try:
        calendar = request("GET", "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm").text
        links = []
        for href in re.findall(r'href=["\']([^"\']*?/newsevents/pressreleases/monetary\d{8}a\.htm)["\']', calendar, re.I):
            if href.startswith('/'):
                href = 'https://www.federalreserve.gov' + href
            elif not href.startswith('http'):
                href = 'https://www.federalreserve.gov/' + href.lstrip('/')
            if href not in links:
                links.append(href)
        links.sort(reverse=True)
        history: list[dict[str, str]] = []
        range_pattern = re.compile(
            r'target range for the federal funds rate (?:at|to)\s*'
            r'(\d+(?:\.\d+)?)\s*(?:to|–|-)\s*(\d+(?:\.\d+)?)\s*percent',
            re.I,
        )
        for url in links[:18]:
            match_date = re.search(r'monetary(\d{4})(\d{2})(\d{2})a\.htm', url, re.I)
            if not match_date:
                continue
            html = request("GET", url).text
            text = re.sub(r'<[^>]+>', ' ', html)
            text = re.sub(r'\s+', ' ', text)
            match = range_pattern.search(text)
            if not match:
                continue
            low, high = float(match.group(1)), float(match.group(2))
            period = f"{match_date.group(1)}-{match_date.group(2)}-{match_date.group(3)}"
            actual = f"{low:g}–{high:g}%"
            history.append({"period": period, "observationDate": period, "actual": actual, "previous": ""})
            if len(history) >= 11:
                break
        if not history:
            raise RuntimeError("No Federal Reserve FOMC statement target ranges found")
        history.sort(key=lambda row: row["period"], reverse=True)
        for index, row in enumerate(history):
            row["previous"] = history[index + 1]["actual"] if index + 1 < len(history) else ""
        history = sanitize_fomc_history(history)
        return {
            "actual": history[0]["actual"],
            "previous": history[0]["previous"],
            "period": history[0]["period"],
            "observationDate": history[0]["observationDate"],
            "history": history,
            "source": "Federal Reserve FOMC statement",
        }, None
    except Exception as exc:  # noqa: BLE001
        return None, str(exc)


def merge_metric(old: dict[str, Any] | None, fresh: dict[str, Any] | None) -> dict[str, Any]:
    if not fresh or not fresh.get("actual"):
        return dict(old or {})
    merged = {**(old or {}), **fresh}
    by_period: dict[str, dict[str, Any]] = {}
    for row in list(fresh.get("history") or []) + list((old or {}).get("history") or []):
        period = str(row.get("period") or "").strip()
        if period and row.get("actual") and period not in by_period:
            by_period[period] = dict(row)
    merged["history"] = sorted(by_period.values(), key=lambda row: str(row.get("period") or ""), reverse=True)[:10]
    return merged

def sanitize_fomc_metric(metric: dict[str, Any] | None) -> dict[str, Any]:
    value = dict(metric or {})
    history = sanitize_fomc_history(value.get("history"))
    if history:
        value.update({
            "actual": history[0]["actual"],
            "previous": history[0]["previous"],
            "period": history[0]["period"],
            "observationDate": history[0]["period"],
            "history": history,
            "source": value.get("source") or "Federal Reserve verified history",
        })
    return value

def fetch_fomc_range() -> tuple[dict[str, Any] | None, str | None]:
    try:
        upper = fred_rows("DFEDTARU")
        lower = fred_rows("DFEDTARL")
        lower_by_date = {row["date"]: row["value"] for row in lower}
        paired = [(row["date"], lower_by_date.get(row["date"]), row["value"]) for row in upper if row["date"] in lower_by_date]
        history: list[dict[str, str]] = []
        last_range: str | None = None
        for date, low, high in paired:
            if low is None:
                continue
            current = f"{low:g}–{high:g}%"
            if current == last_range:
                continue
            history.append({"period": date, "observationDate": date, "actual": current, "previous": last_range or ""})
            last_range = current
            if len(history) == 11:
                break
        if not history:
            raise RuntimeError("No target range observations")
        # The newest row's previous should be the next distinct historical range.
        for index, row in enumerate(history):
            row["previous"] = history[index + 1]["actual"] if index + 1 < len(history) else ""
        history = sanitize_fomc_history(history)
        return {
            "actual": history[0]["actual"],
            "previous": history[0]["previous"],
            "period": history[0]["period"],
            "observationDate": history[0]["observationDate"],
            "history": history,
            "source": "Federal Reserve target range via FRED",
        }, None
    except Exception as exc:  # noqa: BLE001
        return None, str(exc)


def main() -> None:
    existing: dict[str, Any] = {}
    if OUT.exists():
        try:
            existing = json.loads(OUT.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            existing = {}

    metrics: dict[str, Any] = dict(existing.get("metrics") or {})
    errors: dict[str, str] = {}

    for fetcher in (fetch_bls, fetch_fred):
        try:
            fresh, partial_errors = fetcher()
            for key, metric in fresh.items():
                metrics[key] = merge_metric(metrics.get(key), metric)
            errors.update(partial_errors)
        except Exception as exc:  # noqa: BLE001
            errors[fetcher.__name__] = str(exc)

    fomc_official, fomc_official_error = fetch_fomc_official_statements()
    fomc_fred, fomc_fred_error = fetch_fomc_range()
    if fomc_official:
        metrics["fomc"] = merge_metric(metrics.get("fomc"), fomc_official)
    elif fomc_fred:
        metrics["fomc"] = merge_metric(metrics.get("fomc"), fomc_fred)
    else:
        errors["fomc"] = " | ".join(x for x in (fomc_official_error, fomc_fred_error) if x)
    metrics["fomc"] = sanitize_fomc_metric(metrics.get("fomc"))

    required = [
        "cpi_yoy", "core_cpi_yoy", "ppi_yoy", "core_ppi_yoy",
        "nfp", "unemployment", "avg_hourly_earnings", "retail_sales", "jobless_claims",
        "gdp", "pce", "core_pce", "fomc",
    ]
    missing = [key for key in required if not metrics.get(key, {}).get("actual")]
    if missing:
        errors["missing"] = ", ".join(missing)

    previous_metrics = existing.get("metrics") or {}
    changed = metrics != previous_metrics
    if not changed and existing:
        print("No official values changed; preserving the existing snapshot byte-for-byte.")
        print(json.dumps(existing.get("coverage") or {key: bool(metrics.get(key, {}).get("actual")) for key in required}, indent=2))
        return
    payload = {
        "schemaVersion": 3,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "metrics": metrics,
        "errors": errors,
        "coverage": {key: bool(metrics.get(key, {}).get("actual")) for key in required},
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload["coverage"], indent=2))
    if missing:
        print(f"WARNING: official-data sync partial; preserved available/previous metrics. Missing: {', '.join(missing)}")


if __name__ == "__main__":
    main()
