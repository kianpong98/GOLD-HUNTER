#!/usr/bin/env python3
"""Build the Gold Hunter release schedule from the curated master schedule.

Reliability policy:
- data/market-events.json is the authoritative schedule.
- Never infer CPI/PPI/NFP/FOMC dates or release periods from loose page text.
- Weekly Initial Claims may be generated mechanically because its schedule is fixed.
- generated-events.json contains schedule only; user-entered Forecast/Previous/Actual
  stay outside this file and are merged at runtime.
- Invalid, duplicate or impossible rows fail the workflow instead of being published.
"""
from __future__ import annotations

import json
from datetime import datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

MASTER = Path("data/market-events.json")
OUT = Path("data/generated-events.json")
ET = ZoneInfo("America/New_York")
MYT = ZoneInfo("Asia/Kuala_Lumpur")
TODAY_ET = datetime.now(timezone.utc).astimezone(ET).date()
HORIZON_ET = TODAY_ET + timedelta(days=120)

ALLOWED = {
    "cpi_yoy", "core_cpi_yoy", "ppi_yoy", "core_ppi_yoy", "nfp",
    "unemployment", "avg_hourly_earnings", "retail_sales", "jobless_claims",
    "gdp", "pce", "core_pce", "fomc", "fomc_minutes",
}
MONTHLY_TYPES = {
    "cpi_yoy", "core_cpi_yoy", "ppi_yoy", "core_ppi_yoy", "nfp",
    "unemployment", "avg_hourly_earnings", "retail_sales", "pce", "core_pce",
}


def parse_dt(value: str) -> datetime:
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        raise ValueError(f"datetime must contain timezone: {value}")
    return dt


def month_before_release(dt: datetime) -> str:
    local = dt.astimezone(ET)
    first = local.replace(day=1)
    previous = first - timedelta(days=1)
    return previous.strftime("%Y-%m")


def clean_row(raw: dict[str, Any]) -> dict[str, Any]:
    row = dict(raw)
    event_type = str(row.get("type", "")).strip()
    if event_type not in ALLOWED:
        raise ValueError(f"unsupported event type: {event_type!r}")
    dt = parse_dt(str(row.get("datetime", "")))
    period = str(row.get("releasePeriod", "")).strip()
    if not period:
        raise ValueError(f"missing releasePeriod for {event_type} at {dt.isoformat()}")

    # Monthly releases normally report the prior reference month. This catches
    # the exact bug that previously produced 2026-07 for July CPI/PPI releases.
    if event_type in MONTHLY_TYPES:
        expected = month_before_release(dt)
        if period != expected:
            raise ValueError(
                f"releasePeriod mismatch for {event_type}: got {period}, expected {expected} "
                f"for release {dt.isoformat()}"
            )
    if event_type == "gdp" and not __import__("re").fullmatch(r"\d{4}-Q[1-4]", period):
        raise ValueError(f"invalid GDP period: {period}")
    if event_type in {"fomc", "jobless_claims"}:
        try:
            datetime.fromisoformat(period)
        except ValueError as exc:
            raise ValueError(f"invalid date period for {event_type}: {period}") from exc

    # Schedule file must never carry runtime/user state.
    for key in ("actual", "lastRelease", "releaseHistory", "releaseForecasts", "archivedPeriod", "archivedAt"):
        row.pop(key, None)
    row["forecast"] = ""
    row["previous"] = ""
    row["scheduleAuthority"] = "curated-master-v1"
    return row


def generate_weekly_claims(existing: list[dict[str, Any]]) -> list[dict[str, Any]]:
    template = next((x for x in existing if x.get("type") == "jobless_claims"), None)
    if not template:
        return []
    out: list[dict[str, Any]] = []
    d = TODAY_ET
    while d.weekday() != 3:
        d += timedelta(days=1)
    while d <= HORIZON_ET:
        ref = d - timedelta(days=5)  # week ending preceding Saturday
        dt_et = datetime.combine(d, time(8, 30), ET)
        row = dict(template)
        row.update({
            "id": f"jobless-claims-{d.isoformat()}",
            "releasePeriod": ref.isoformat(),
            "datetime": dt_et.astimezone(MYT).isoformat(timespec="seconds"),
            "forecast": "",
            "previous": "",
            "scheduleAuthority": "fixed-weekly-rule-v1",
        })
        out.append(row)
        d += timedelta(days=7)
    return out


def key(row: dict[str, Any]) -> tuple[str, str]:
    return str(row["type"]), str(row["releasePeriod"])


def validate_fomc(events: list[dict[str, Any]]) -> None:
    # A corrupted parser previously emitted several consecutive FOMC decisions.
    dates = sorted(parse_dt(x["datetime"]).astimezone(ET).date() for x in events if x["type"] == "fomc")
    for a, b in zip(dates, dates[1:]):
        if (b - a).days < 14:
            raise ValueError(f"impossible duplicate FOMC decisions: {a} and {b}")


def main() -> None:
    if not MASTER.exists():
        raise SystemExit(f"Missing authoritative schedule: {MASTER}")
    source = json.loads(MASTER.read_text(encoding="utf-8"))
    if not isinstance(source, list) or not source:
        raise SystemExit("market-events.json must be a non-empty array")

    curated = [clean_row(x) for x in source]
    non_claims = [x for x in curated if x["type"] != "jobless_claims"]
    events = non_claims + generate_weekly_claims(curated)

    dedup: dict[tuple[str, str], dict[str, Any]] = {}
    for event in events:
        k = key(event)
        if k in dedup:
            raise ValueError(f"duplicate schedule key: {k}")
        dedup[k] = event

    result = sorted(dedup.values(), key=lambda x: x["datetime"])
    validate_fomc(result)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "events": len(result),
        "authority": str(MASTER),
        "first": result[0]["datetime"],
        "last": result[-1]["datetime"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
