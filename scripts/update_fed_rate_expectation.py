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
ENGINE_VERSION = "fed-futures-calculated-2.3-cme-method-no-kv"
MIN_CHECKPOINT_HOURS = 6

FRED_MULTI_CSV = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=EFFR,DFEDTARL,DFEDTARU"
NYFED_EFFR = "https://markets.newyorkfed.org/api/rates/unsecured/effr/last/1.json"
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


def _request_with_retry(url: str, *, timeout: int = 12, accept: str = "application/json") -> requests.Response:
    errors: list[str] = []
    for attempt in range(1, 4):
        try:
            response = requests.get(
                url,
                timeout=timeout,
                headers={"User-Agent": UA, "Accept": accept, "Cache-Control": "no-cache"},
            )
            if response.status_code == 200:
                return response
            errors.append(f"attempt {attempt}: HTTP {response.status_code}")
        except Exception as exc:
            errors.append(f"attempt {attempt}: {type(exc).__name__}: {exc}")
        time.sleep(attempt * 1.5)
    raise RuntimeError("; ".join(errors))


def _latest_from_rows(rows: list[dict[str, str]], series: str) -> tuple[str, float]:
    for row in reversed(rows):
        raw = (row.get(series) or "").strip()
        if raw and raw != ".":
            return (row.get("DATE") or row.get("observation_date") or ""), float(raw)
    raise RuntimeError(f"No usable observation for {series}")


def fetch_fred_reference_rates() -> tuple[dict[str, tuple[str, float]], list[str]]:
    response = _request_with_retry(FRED_MULTI_CSV, timeout=12, accept="text/csv")
    rows = list(csv.DictReader(io.StringIO(response.text)))
    if not rows:
        raise RuntimeError("FRED returned no CSV rows")
    values = {series: _latest_from_rows(rows, series) for series in ("EFFR", "DFEDTARL", "DFEDTARU")}
    return values, []


def fetch_nyfed_effr() -> tuple[str, float]:
    response = _request_with_retry(NYFED_EFFR, timeout=12, accept="application/json")
    payload = response.json()
    candidates = []
    if isinstance(payload, dict):
        candidates.extend(payload.get("refRates") or [])
        candidates.extend(payload.get("rates") or [])
        if isinstance(payload.get("data"), list):
            candidates.extend(payload["data"])
    for row in candidates:
        if not isinstance(row, dict):
            continue
        raw = row.get("percentRate") if row.get("percentRate") is not None else (row.get("rate") if row.get("rate") is not None else row.get("value"))
        date_value = row.get("effectiveDate") or row.get("date") or row.get("businessDate") or ""
        try:
            value = float(raw)
        except (TypeError, ValueError):
            continue
        if 0 <= value <= 20:
            return str(date_value), value
    raise RuntimeError("New York Fed EFFR response did not contain a usable rate")


def fetch_reference_rates(existing: dict[str, Any]) -> tuple[str, float, str, float, str, float, str, list[str]]:
    errors: list[str] = []
    try:
        values, _ = fetch_fred_reference_rates()
        effr_date, effr = values["EFFR"]
        low_date, target_low = values["DFEDTARL"]
        high_date, target_high = values["DFEDTARU"]
        return effr_date, effr, low_date, target_low, high_date, target_high, "FRED combined official series", errors
    except Exception as exc:
        errors.append(f"FRED combined: {type(exc).__name__}: {exc}")

    # Official fallback for EFFR from the New York Fed. The target range changes
    # only at FOMC decisions, so preserve the last validated range from the
    # current snapshot when FRED is temporarily unavailable.
    effr_date, effr = fetch_nyfed_effr()
    parsed = parse_range(existing.get("currentTargetRange"))
    if not parsed:
        raise RuntimeError("FRED unavailable and existing target range is invalid")
    target_low, target_high = parsed
    target_date = str(existing.get("officialDataChangedAt") or existing.get("updatedAt") or "verified snapshot")
    errors.append("Target range retained from last validated official snapshot")
    return effr_date, effr, target_date, target_low, target_date, target_high, "New York Fed EFFR + validated official target range", errors

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


def fetch_yahoo_contract_price(contract_month: date) -> tuple[float, str, str]:
    errors: list[str] = []
    for symbol in yahoo_symbols(contract_month):
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


def fetch_contract_pair(meeting: date) -> tuple[dict[str, Any], list[str]]:
    """Fetch the prior-month and meeting-month dated ZQ contracts.

    CME's published methodology uses the change in implied average EFFR between
    adjacent monthly Fed Funds contracts to infer the binary probability for the
    next meeting. Using only the meeting-month contract and today's EFFR can
    greatly exaggerate probabilities when the meeting occurs near month-end.
    """
    errors: list[str] = []
    if meeting.month == 1:
        prior_month = date(meeting.year - 1, 12, 1)
    else:
        prior_month = date(meeting.year, meeting.month - 1, 1)
    meeting_month = date(meeting.year, meeting.month, 1)

    try:
        prior_price, prior_source, prior_time = fetch_yahoo_contract_price(prior_month)
    except Exception as exc:
        raise RuntimeError(f"Prior-month dated ZQ contract unavailable: {exc}") from exc
    try:
        meeting_price, meeting_source, meeting_time = fetch_yahoo_contract_price(meeting_month)
    except Exception as exc:
        raise RuntimeError(f"Meeting-month dated ZQ contract unavailable: {exc}") from exc

    return {
        "priorPrice": prior_price,
        "priorSource": prior_source,
        "priorDataTime": prior_time,
        "priorContractMonth": prior_month.isoformat(),
        "meetingPrice": meeting_price,
        "meetingSource": meeting_source,
        "meetingDataTime": meeting_time,
        "meetingContractMonth": meeting_month.isoformat(),
    }, errors


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
    contract_pair: dict[str, Any],
    target_low: float,
    target_high: float,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Calculate the next-meeting binary probability using adjacent ZQ contracts.

    For the nearest meeting, CME's published methodology derives the probability
    from the difference between the meeting-month implied rate and the preceding
    month's implied rate, with policy moves constrained to 25bp increments. This
    avoids the severe month-end amplification produced by dividing the whole
    monthly average by only the few post-meeting days.
    """
    prior_price = float(contract_pair["priorPrice"])
    meeting_price = float(contract_pair["meetingPrice"])
    prior_implied = 100.0 - prior_price
    meeting_implied = 100.0 - meeting_price
    implied_change_bps = (meeting_implied - prior_implied) * 100.0

    current_mid = (target_low + target_high) / 2.0
    if abs(implied_change_bps) > 25.0:
        # The nearest-meeting binary display supports the two adjacent outcomes.
        # Larger moves generally indicate a wrong/stale contract symbol or that a
        # multi-meeting probability tree is required. Preserve the prior snapshot.
        raise RuntimeError(
            f"Adjacent-contract implied change {implied_change_bps:.2f}bp exceeds binary 25bp range"
        )

    change_prob = max(0.0, min(100.0, abs(implied_change_bps) / 25.0 * 100.0))
    hold_prob = 100.0 - change_prob
    direction_step = 1 if implied_change_bps > 0 else -1 if implied_change_bps < 0 else 0
    next_low = target_low + direction_step * 0.25
    next_high = target_high + direction_step * 0.25
    if next_low < 0:
        raise RuntimeError("Calculated target range would be below zero")

    hold = {
        "targetRange": display_range(target_low, target_high),
        "probability": round(hold_prob, 1),
        "move": "No change",
        "direction": "hold",
    }
    if direction_step == 0:
        # Keep the existing two-row UI compatible while being explicit that the
        # adjacent move is currently priced at zero.
        next_low, next_high = target_low + 0.25, target_high + 0.25
        move = {
            "targetRange": display_range(next_low, next_high),
            "probability": 0.0,
            "move": "25 bps hike",
            "direction": "hike",
        }
    else:
        direction = "hike" if direction_step > 0 else "cut"
        move = {
            "targetRange": display_range(next_low, next_high),
            "probability": round(change_prob, 1),
            "move": f"25 bps {direction}",
            "direction": direction,
        }
    outcomes = sorted([hold, move], key=lambda row: parse_range(row["targetRange"])[0])
    total = round(sum(float(row["probability"]) for row in outcomes), 1)
    if not 99.9 <= total <= 100.1:
        outcomes[-1]["probability"] = round(outcomes[-1]["probability"] + (100.0-total), 1)

    diagnostics = {
        "method": "CME adjacent-month binary methodology",
        "priorContractPrice": round(prior_price, 5),
        "meetingContractPrice": round(meeting_price, 5),
        "priorContractImpliedRate": round(prior_implied, 5),
        "meetingContractImpliedRate": round(meeting_implied, 5),
        "impliedChangeBps": round(implied_change_bps, 3),
        "changeProbability": round(change_prob, 1),
        "holdProbability": round(hold_prob, 1),
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
        effr_date, effr, low_date, target_low, high_date, target_high, reference_source, reference_errors = fetch_reference_rates(existing)
        errors.extend(reference_errors)
        if not (0 <= target_low < target_high <= 20) or not math.isclose((target_high-target_low)*100, 25, abs_tol=0.6):
            raise RuntimeError(f"Invalid official target range: {target_low}-{target_high}")
        contract_pair, source_errors = fetch_contract_pair(meeting)
        errors.extend(source_errors)
        outcomes, diagnostics = calculate_probabilities(meeting, contract_pair, target_low, target_high)
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
        changed = (
            core != {key: existing.get(key) for key in core}
            or existing.get("engineVersion") != ENGINE_VERSION
            or existing.get("sourceMode") != "free-futures-calculation"
            or existing.get("calculationSucceeded") is not True
        )
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
            "source": "30-Day Fed Funds futures implied estimate (CME methodology)",
            "sourceUrl": CME_FEDWATCH_URL,
            "futuresSource": f"{contract_pair['priorSource']} + {contract_pair['meetingSource']}",
            "futuresDataTime": max(contract_pair['priorDataTime'], contract_pair['meetingDataTime']),
            "futuresContracts": contract_pair,
            "referenceRateSource": reference_source,
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
            "note": "Free FedWatch-like estimate calculated with CME's published adjacent-month Fed Funds futures methodology. It is not licensed CME FedWatch API output and may differ slightly because delayed third-party settlement prices are used.",
            "engineVersion": ENGINE_VERSION,
            "kvWrite": False,
            "errors": errors,
            "lastOfficialFetchError": "",
        }
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
        write_debug({"result":"success", **payload})
        print(f"Wrote CME-method futures-implied probabilities: {outcomes}; changed={changed}; contracts={contract_pair}")
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
            migration_due = (
                existing.get("engineVersion") != ENGINE_VERSION
                or existing.get("sourceMode") != "calculation-fallback"
                or existing.get("githubChecked") is not True
                or existing.get("githubSynced") is not True
            )
            if due or migration_due:
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
