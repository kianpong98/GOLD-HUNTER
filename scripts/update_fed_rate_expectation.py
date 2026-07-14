#!/usr/bin/env python3
"""Free FedWatch-like probability updater.

This updater avoids scraping the CME FedWatch webpage. It derives the next-meeting
binary target-rate probabilities from 30-Day Fed Funds futures prices and official
Federal Reserve/FRED reference rates.

Important: this is a transparent market-implied estimate, not CME's licensed
FedWatch API output. The JSON explicitly marks that distinction. The calculation
uses the same underlying instrument class (30-Day Fed Funds futures), validates
all inputs, and preserves the last valid snapshot whenever any source fails.

No Cloudflare Workers KV writes are used.
"""
from __future__ import annotations

import calendar
import csv
import io
import json
import math
import os
import re
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import requests

OUT = Path("assets/data/rate-expectation.json")
DEBUG_DIR = Path("artifacts/fed-rate-calculation-debug")
ENGINE_VERSION = "fed-futures-calculated-2.0-free-no-kv"
MIN_CHECKPOINT_HOURS = 6

FRED_CSV = "https://fred.stlouisfed.org/graph/fredgraph.csv?id={series}"
YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
STOOQ_CSV = "https://stooq.com/q/l/?s=zq.f&i=d"
CME_FEDWATCH_URL = "https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html"

MONTH_CODES = {1:"F",2:"G",3:"H",4:"J",5:"K",6:"M",7:"N",8:"Q",9:"U",10:"V",11:"X",12:"Z"}
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36"


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def load_existing() -> dict[str, Any]:
    try:
        return json.loads(OUT.read_text(encoding="utf-8"))
    except Exception:
        return {}


def parse_range(value: Any) -> tuple[float, float] | None:
    nums = re.findall(r"\d+(?:\.\d+)?", str(value or "").replace("–", "-"))
    if len(nums) < 2:
        return None
    lo, hi = float(nums[0]), float(nums[1])
    if hi > 20:
        lo, hi = lo / 100.0, hi / 100.0
    if not (0 <= lo < hi <= 20) or not math.isclose((hi-lo)*100, 25, abs_tol=0.6):
        return None
    return round(lo, 4), round(hi, 4)


def display_range(lo: float, hi: float) -> str:
    return f"{lo:.2f}%–{hi:.2f}%"


def get_csv_latest(series: str) -> tuple[str, float]:
    url = FRED_CSV.format(series=series)
    response = requests.get(url, timeout=45, headers={"User-Agent": UA, "Accept": "text/csv"})
    response.raise_for_status()
    rows = list(csv.DictReader(io.StringIO(response.text)))
    for row in reversed(rows):
        raw = (row.get(series) or "").strip()
        if raw and raw != ".":
            return row.get("DATE", ""), float(raw)
    raise RuntimeError(f"No usable observation in FRED series {series}")


def yahoo_symbols(meeting: date) -> list[str]:
    code = MONTH_CODES[meeting.month]
    yy = str(meeting.year)[-2:]
    yyyy = str(meeting.year)
    # Yahoo naming varies. Try dated contracts before the continuous symbol.
    return [
        f"ZQ{code}{yy}.CBT",
        f"ZQ{code}{yyyy}.CBT",
        f"ZQ{code}{yy}=F",
        "ZQ=F",
    ]


def fetch_yahoo_price(meeting: date) -> tuple[float, str, str]:
    errors: list[str] = []
    for symbol in yahoo_symbols(meeting):
        try:
            url = YAHOO_CHART.format(symbol=requests.utils.quote(symbol, safe=""))
            response = requests.get(
                url,
                params={"range":"10d", "interval":"1d", "events":"history"},
                timeout=40,
                headers={"User-Agent": UA, "Accept":"application/json"},
            )
            if response.status_code != 200:
                errors.append(f"{symbol}: HTTP {response.status_code}")
                continue
            result = response.json().get("chart", {}).get("result") or []
            if not result:
                errors.append(f"{symbol}: empty chart")
                continue
            node = result[0]
            quote = ((node.get("indicators") or {}).get("quote") or [{}])[0]
            closes = quote.get("close") or []
            timestamps = node.get("timestamp") or []
            usable = [(ts, val) for ts, val in zip(timestamps, closes) if val is not None]
            if not usable:
                errors.append(f"{symbol}: no closes")
                continue
            ts, price = usable[-1]
            price = float(price)
            if not 90 <= price <= 100:
                errors.append(f"{symbol}: implausible price {price}")
                continue
            market_time = datetime.fromtimestamp(int(ts), timezone.utc).isoformat().replace("+00:00", "Z")
            return price, f"Yahoo Finance delayed 30-Day Fed Funds futures ({symbol})", market_time
        except Exception as exc:
            errors.append(f"{symbol}: {type(exc).__name__}: {exc}")
    raise RuntimeError("; ".join(errors))


def fetch_stooq_price() -> tuple[float, str, str]:
    response = requests.get(STOOQ_CSV, timeout=40, headers={"User-Agent": UA, "Accept":"text/csv"})
    response.raise_for_status()
    rows = list(csv.reader(io.StringIO(response.text.strip())))
    # Typical one-line response: SYMBOL,DATE,TIME,OPEN,HIGH,LOW,CLOSE,VOLUME,...
    row = rows[-1] if rows else []
    if len(row) < 7:
        raise RuntimeError(f"Unexpected Stooq response: {response.text[:200]}")
    price = float(row[6])
    if not 90 <= price <= 100:
        raise RuntimeError(f"Implausible Stooq futures price: {price}")
    stamp = f"{row[1]}T{row[2] or '00:00:00'}Z" if len(row) > 2 else iso_now()
    return price, "Stooq delayed continuous 30-Day Fed Funds futures", stamp


def fetch_futures_price(meeting: date) -> tuple[float, str, str, list[str]]:
    errors: list[str] = []
    try:
        price, source, stamp = fetch_yahoo_price(meeting)
        return price, source, stamp, errors
    except Exception as exc:
        errors.append(f"Yahoo: {exc}")
    # Continuous fallback is only safe when the meeting is in the current/next contract month.
    today = datetime.now(timezone.utc).date()
    month_distance = (meeting.year-today.year)*12 + meeting.month-today.month
    if month_distance not in (0, 1):
        raise RuntimeError("Dated futures quote unavailable and continuous fallback is unsafe for this meeting; " + " | ".join(errors))
    try:
        price, source, stamp = fetch_stooq_price()
        return price, source, stamp, errors
    except Exception as exc:
        errors.append(f"Stooq: {exc}")
    raise RuntimeError(" | ".join(errors))


def next_meeting(existing: dict[str, Any]) -> date:
    raw = str(existing.get("meetingDate") or "")
    if raw:
        try:
            parsed = date.fromisoformat(raw)
            if parsed >= datetime.now(timezone.utc).date() - timedelta(days=1):
                return parsed
        except ValueError:
            pass
    raise RuntimeError("No valid upcoming meetingDate in rate-expectation.json")


def make_meeting_datetime(meeting: date) -> str:
    eastern = ZoneInfo("America/New_York")
    malaysia = ZoneInfo("Asia/Kuala_Lumpur")
    local = datetime.combine(meeting, datetime.min.time()).replace(hour=14, tzinfo=eastern)
    return local.astimezone(malaysia).isoformat()


def calculate_probabilities(
    meeting: date,
    futures_price: float,
    effr: float,
    target_low: float,
    target_high: float,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    days = calendar.monthrange(meeting.year, meeting.month)[1]
    # Policy changes are normally effective the day after the announcement.
    pre_days = meeting.day
    post_days = days - pre_days
    if post_days < 1:
        raise RuntimeError("Meeting leaves no post-decision calendar days in contract month")

    implied_month_avg = 100.0 - futures_price
    expected_post_effr = (implied_month_avg * days - effr * pre_days) / post_days

    current_mid = (target_low + target_high) / 2.0
    effr_offset = effr - current_mid
    # Candidate target ranges at 25bp steps, with EFFR assumed to preserve its
    # current offset from the target midpoint.
    candidates: list[tuple[float, float, float]] = []
    for step in range(-6, 7):
        lo = target_low + step * 0.25
        hi = target_high + step * 0.25
        if lo < 0:
            continue
        candidate_effr = (lo + hi) / 2.0 + effr_offset
        candidates.append((lo, hi, candidate_effr))
    candidates.sort(key=lambda x: x[2])

    lower = None
    upper = None
    for item in candidates:
        if item[2] <= expected_post_effr:
            lower = item
        if item[2] >= expected_post_effr and upper is None:
            upper = item
    if lower is None or upper is None:
        raise RuntimeError(f"Expected post-meeting EFFR {expected_post_effr:.4f}% is outside validated candidate range")

    if lower == upper:
        # Exact grid point: show it with the nearest adjacent outcome at 0% so
        # the existing two-row UI remains compatible.
        idx = candidates.index(lower)
        neighbor = candidates[idx+1] if idx+1 < len(candidates) else candidates[idx-1]
        pairs = [(lower, 100.0), (neighbor, 0.0)]
    else:
        span = upper[2] - lower[2]
        if span <= 0 or span > 0.251:
            raise RuntimeError(f"Invalid adjacent EFFR span: {span}")
        upper_prob = max(0.0, min(100.0, (expected_post_effr - lower[2]) / span * 100.0))
        lower_prob = 100.0 - upper_prob
        pairs = [(lower, round(lower_prob, 1)), (upper, round(upper_prob, 1))]

    outcomes: list[dict[str, Any]] = []
    for (lo, hi, _candidate_effr), prob in pairs:
        bps = round(((lo + hi) / 2.0 - current_mid) * 100)
        direction = "cut" if bps < 0 else "hike" if bps > 0 else "hold"
        move = "No change" if bps == 0 else f"{abs(bps)} bps {direction}"
        outcomes.append({
            "targetRange": display_range(lo, hi),
            "probability": round(prob, 1),
            "move": move,
            "direction": direction,
        })
    outcomes.sort(key=lambda row: parse_range(row["targetRange"])[0])
    total = round(sum(float(row["probability"]) for row in outcomes), 1)
    if not 99.9 <= total <= 100.1:
        outcomes[-1]["probability"] = round(outcomes[-1]["probability"] + (100.0-total), 1)

    diagnostics = {
        "futuresPrice": round(futures_price, 5),
        "impliedMonthlyAverageEffr": round(implied_month_avg, 5),
        "currentEffr": round(effr, 5),
        "expectedPostMeetingEffr": round(expected_post_effr, 5),
        "daysInContractMonth": days,
        "preDecisionDays": pre_days,
        "postDecisionDays": post_days,
        "effrTargetMidpointOffset": round(effr_offset, 5),
    }
    return outcomes, diagnostics


def write_debug(payload: dict[str, Any]) -> None:
    DEBUG_DIR.mkdir(parents=True, exist_ok=True)
    (DEBUG_DIR / "result.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")


def main() -> int:
    existing = load_existing()
    checked_at = datetime.now(timezone.utc)
    errors: list[str] = []
    try:
        meeting = next_meeting(existing)
        effr_date, effr = get_csv_latest("EFFR")
        low_date, target_low = get_csv_latest("DFEDTARL")
        high_date, target_high = get_csv_latest("DFEDTARU")
        if not (0 <= target_low < target_high <= 20) or not math.isclose((target_high-target_low)*100, 25, abs_tol=0.6):
            raise RuntimeError(f"Invalid official target range: {target_low}-{target_high}")
        price, futures_source, futures_time, source_errors = fetch_futures_price(meeting)
        errors.extend(source_errors)
        outcomes, diagnostics = calculate_probabilities(meeting, price, effr, target_low, target_high)
        total = round(sum(float(x["probability"]) for x in outcomes), 1)
        if not 99.9 <= total <= 100.1:
            raise RuntimeError(f"Probability total failed validation: {total}")

        now_text = checked_at.isoformat().replace("+00:00", "Z")
        core = {
            "meetingDate": meeting.isoformat(),
            "meetingLabel": "Next FOMC decision",
            "currentTargetRange": display_range(target_low, target_high),
            "outcomes": outcomes,
        }
        changed = core != {key: existing.get(key) for key in core}
        prior_checked = existing.get("lastCheckedAt") or existing.get("updatedAt")
        checkpoint_due = True
        if prior_checked:
            try:
                prior = datetime.fromisoformat(str(prior_checked).replace("Z", "+00:00"))
                checkpoint_due = checked_at-prior >= timedelta(hours=MIN_CHECKPOINT_HOURS)
            except ValueError:
                pass
        if not changed and not checkpoint_due:
            print("Free futures estimate verified; probabilities unchanged and checkpoint not due.")
            return 0

        updated_at = now_text if changed else existing.get("updatedAt", now_text)
        payload = {
            **existing,
            **core,
            "updatedAt": updated_at,
            "lastCheckedAt": now_text,
            "officialDataChangedAt": updated_at,
            "source": "30-Day Fed Funds futures implied estimate",
            "sourceUrl": CME_FEDWATCH_URL,
            "futuresSource": futures_source,
            "futuresDataTime": futures_time,
            "referenceRateSource": "Federal Reserve Bank of New York / FRED",
            "referenceRateDates": {"EFFR":effr_date, "targetLower":low_date, "targetUpper":high_date},
            "sourceMode": "free-futures-calculation",
            "sourceStatus": "calculated-live",
            "live": True,
            "githubChecked": True,
            "githubSynced": True,
            "officialFetchSucceeded": True,
            "calculationSucceeded": True,
            "exactOfficialValues": False,
            "probabilityTotal": total,
            "calculation": diagnostics,
            "meetingDateTime": make_meeting_datetime(meeting),
            "meetingTimezone": "Asia/Kuala_Lumpur",
            "meetingTimezoneLabel": "Malaysia Time (MYT)",
            "note": "Free FedWatch-like estimate calculated from 30-Day Fed Funds futures and official EFFR/target-rate data. It is not CME licensed FedWatch API output.",
            "engineVersion": ENGINE_VERSION,
            "kvWrite": False,
            "errors": errors,
            "lastOfficialFetchError": "",
        }
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
        write_debug({"result":"success", **payload})
        print(f"Wrote free futures-implied rate probabilities: {outcomes}; changed={changed}; price={price}")
        return 0
    except Exception as exc:
        errors.append(f"{type(exc).__name__}: {exc}")
        write_debug({"result":"failed-existing-snapshot-preserved", "checkedAt":iso_now(), "engineVersion":ENGINE_VERSION, "errors":errors})
        # Preserve the prior valid snapshot but add a heartbeat no more than once
        # every six hours. Never label stale data live.
        rows = existing.get("outcomes") if isinstance(existing.get("outcomes"), list) else []
        total = round(sum(float(row.get("probability", 0)) for row in rows), 1) if rows else 0
        if existing.get("meetingDate") and existing.get("currentTargetRange") and len(rows)>=2 and 98.5<=total<=101.5:
            prior_checked = existing.get("lastCheckedAt") or existing.get("updatedAt")
            due = True
            if prior_checked:
                try:
                    due = checked_at-datetime.fromisoformat(str(prior_checked).replace("Z", "+00:00")) >= timedelta(hours=MIN_CHECKPOINT_HOURS)
                except ValueError:
                    pass
            if due:
                fallback = {
                    **existing,
                    "lastCheckedAt": checked_at.isoformat().replace("+00:00", "Z"),
                    "sourceMode": "calculation-fallback",
                    "sourceStatus": "cached",
                    "live": False,
                    "githubChecked": True,
                    "githubSynced": True,
                    "officialFetchSucceeded": False,
                    "calculationSucceeded": False,
                    "lastOfficialFetchError": " | ".join(errors),
                    "engineVersion": ENGINE_VERSION,
                    "kvWrite": False,
                    "note": "Automatic free futures calculation failed; last validated snapshot preserved. No Workers KV writes.",
                }
                OUT.parent.mkdir(parents=True, exist_ok=True)
                OUT.write_text(json.dumps(fallback, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
            print("Free futures calculation failed; existing validated snapshot preserved:", errors[-1])
            return 0
        print("Free futures calculation failed and no valid prior snapshot exists:", errors[-1], file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
