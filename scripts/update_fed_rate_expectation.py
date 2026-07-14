#!/usr/bin/env python3
"""Update the next-meeting CME FedWatch target-rate probabilities.

Source priority:
1. CME FedWatch authenticated REST API when CME_FEDWATCH_ACCESS_TOKEN is set.
2. CME's public FedWatch page rendered in Chromium.

The existing verified JSON is never replaced when the source cannot be verified.
No Workers KV is used. A successful unchanged check is committed at most once
per six hours so the website can distinguish a recently checked snapshot from
an abandoned one without causing constant deployments.
"""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import requests

OUT = Path("assets/data/rate-expectation.json")
DEBUG_DIR = Path("artifacts/fedwatch-debug")
CME_PAGE = "https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html"
DEFAULT_API = "https://markets.api.cmegroup.com/fedwatch/v1/forecasts"
ENGINE_VERSION = "fedwatch-github-sync-1"
MIN_CHECKPOINT_HOURS = 6


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("–", "-").replace("—", "-")).strip()


def parse_range(value: Any) -> tuple[int, int] | None:
    nums = re.findall(r"\d+(?:\.\d+)?", clean(value))
    if len(nums) < 2:
        return None
    lo, hi = float(nums[0]), float(nums[1])
    if hi > 20:
        lo, hi = lo / 100, hi / 100
    lo_bps, hi_bps = round(lo * 100), round(hi * 100)
    if lo_bps < 0 or hi_bps <= lo_bps or hi_bps - lo_bps not in (25, 50):
        return None
    return lo_bps, hi_bps


def display_range(pair: tuple[int, int]) -> str:
    return f"{pair[0] / 100:.2f}%–{pair[1] / 100:.2f}%"


def probability(value: Any) -> float | None:
    try:
        number = float(str(value).replace("%", "").strip())
    except (TypeError, ValueError):
        return None
    return round(number, 1) if 0 <= number <= 100 else None


def rows_from_object(root: Any) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    seen: set[int] = set()

    def visit(value: Any, depth: int = 0) -> None:
        if depth > 18 or not isinstance(value, (dict, list)):
            return
        ident = id(value)
        if ident in seen:
            return
        seen.add(ident)
        if isinstance(value, dict):
            range_value = None
            prob_value = None
            for key, child in value.items():
                key_norm = re.sub(r"[^a-z]", "", str(key).lower())
                if range_value is None and ("targetrange" in key_norm or "raterange" in key_norm or key_norm == "range"):
                    range_value = child
                if prob_value is None and any(word in key_norm for word in ("probability", "percentage", "percent")):
                    prob_value = child
            if range_value is not None and prob_value is not None:
                rows.append({"range": range_value, "probability": prob_value})
            for child in value.values():
                visit(child, depth + 1)
        else:
            for child in value:
                visit(child, depth + 1)

    visit(root)
    return rows


def coherent_outcomes(rows: list[dict[str, Any]], current: tuple[int, int] | None) -> list[dict[str, Any]]:
    by_range: dict[tuple[int, int], float] = {}
    for row in rows:
        rate_range = parse_range(row.get("range") or row.get("targetRange"))
        prob = probability(row.get("probability"))
        if rate_range and prob is not None:
            by_range[rate_range] = prob
    ordered = sorted(by_range.items())
    best: tuple[float, list[tuple[tuple[int, int], float]]] | None = None
    for start in range(len(ordered)):
        total = 0.0
        group: list[tuple[tuple[int, int], float]] = []
        for index in range(start, min(len(ordered), start + 8)):
            pair, prob = ordered[index]
            if group and pair[0] != group[-1][0][1]:
                break
            group.append((pair, prob))
            total += prob
            if 98.5 <= total <= 101.5 and len(group) >= 2:
                includes_current = current is None or any(pair == current for pair, _ in group)
                score = abs(100 - total) + (0 if includes_current else 10)
                if best is None or score < best[0]:
                    best = (score, list(group))
    if best is None:
        raise RuntimeError("CME probability rows did not form a verified contiguous ~100% table")
    return [{"targetRange": display_range(pair), "probability": prob} for pair, prob in best[1]]


def parse_date(text: str) -> str:
    direct = re.search(r"(20\d{2})[-/](\d{1,2})[-/](\d{1,2})", text)
    if direct:
        return f"{direct.group(1)}-{int(direct.group(2)):02d}-{int(direct.group(3)):02d}"
    for fmt in ("%b %d, %Y", "%B %d, %Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(text.strip(), fmt).date().isoformat()
        except ValueError:
            pass
    return ""


def parse_rendered_text(text: str) -> dict[str, Any]:
    normalized = clean(text)
    current_match = re.search(
        r"current(?: federal funds)? target rate(?: is|:)\s*(\d+(?:\.\d+)?\s*%?\s*-\s*\d+(?:\.\d+)?\s*%?)",
        normalized,
        re.I,
    )
    current = parse_range(current_match.group(1)) if current_match else None

    meeting_date = ""
    meeting_match = re.search(r"Target Rate Probabilities for\s+(.{3,40}?)\s+Fed Meeting", normalized, re.I)
    if meeting_match:
        meeting_date = parse_date(meeting_match.group(1))

    rows: list[dict[str, Any]] = []
    pair_pattern = re.compile(
        r"(?<!\d)(\d{2,4}(?:\.\d+)?\s*-\s*\d{2,4}(?:\.\d+)?)(?:[^\d%]{0,140})(\d{1,3}(?:\.\d+)?)\s*%",
        re.I,
    )
    for match in pair_pattern.finditer(normalized):
        rows.append({"range": match.group(1), "probability": match.group(2)})

    if current is None:
        # The nearest-meeting table normally includes the current range. Infer it
        # only when the page does not expose a label, preserving the existing
        # current range later if available.
        pass
    outcomes = coherent_outcomes(rows, current)
    return {"meetingDate": meeting_date, "current": current, "outcomes": outcomes}


def fetch_api() -> dict[str, Any] | None:
    token = os.getenv("CME_FEDWATCH_ACCESS_TOKEN", "").strip()
    if not token:
        return None
    url = os.getenv("CME_FEDWATCH_API_URL", DEFAULT_API).strip()
    response = requests.get(
        url,
        timeout=60,
        headers={"Accept": "application/json", "Authorization": f"Bearer {token}"},
    )
    response.raise_for_status()
    payload = response.json()
    rows = rows_from_object(payload)
    text = json.dumps(payload)
    current_match = re.search(r'current(?:Target)?(?:Rate|Range)[^:]*:\s*"([^"]+)"', text, re.I)
    current = parse_range(current_match.group(1)) if current_match else None
    date_match = re.search(r'(?:meetingDate|meetingDt|fomcMeetingDate)[^:]*:\s*"([^"]+)"', text, re.I)
    meeting_date = parse_date(date_match.group(1)) if date_match else ""
    outcomes = coherent_outcomes(rows, current)
    return {"meetingDate": meeting_date, "current": current, "outcomes": outcomes, "mode": "official-api"}


def fetch_public_page() -> dict[str, Any]:
    from playwright.sync_api import sync_playwright

    DEBUG_DIR.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, args=["--disable-dev-shm-usage", "--no-sandbox"])
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
            locale="en-US",
            viewport={"width": 1440, "height": 1200},
        )
        page = context.new_page()
        try:
            page.goto(CME_PAGE, wait_until="domcontentloaded", timeout=90000)
            page.wait_for_timeout(12000)
            text = page.locator("body").inner_text(timeout=30000)
            html = page.content()
            (DEBUG_DIR / "page.txt").write_text(text, encoding="utf-8")
            (DEBUG_DIR / "page.html").write_text(html, encoding="utf-8")
            page.screenshot(path=str(DEBUG_DIR / "page.png"), full_page=True)
            parsed = parse_rendered_text(text)
            parsed["mode"] = "official-public-page"
            return parsed
        finally:
            context.close()
            browser.close()


def midpoint(rate_range: str) -> float:
    pair = parse_range(rate_range)
    if not pair:
        raise ValueError(rate_range)
    return (pair[0] + pair[1]) / 2


def make_datetime(meeting_date: str) -> str:
    eastern = ZoneInfo("America/New_York")
    malaysia = ZoneInfo("Asia/Kuala_Lumpur")
    local = datetime.fromisoformat(meeting_date).replace(hour=14, minute=0, second=0, tzinfo=eastern)
    return local.astimezone(malaysia).isoformat()


def load_existing() -> dict[str, Any]:
    try:
        return json.loads(OUT.read_text(encoding="utf-8"))
    except Exception:
        return {}


def main() -> None:
    existing = load_existing()
    checked_at = datetime.now(timezone.utc)
    errors: list[str] = []
    result = None
    try:
        result = fetch_api()
    except Exception as exc:
        errors.append(f"official API: {exc}")
    if result is None:
        try:
            result = fetch_public_page()
        except Exception as exc:
            errors.append(f"official public page: {exc}")
    if result is None:
        raise RuntimeError(" | ".join(errors) or "CME FedWatch could not be verified")

    meeting_date = result.get("meetingDate") or existing.get("meetingDate")
    current_pair = result.get("current") or parse_range(existing.get("currentTargetRange"))
    if not meeting_date or not current_pair:
        raise RuntimeError("CME meeting date/current target range could not be verified and no safe existing value exists")

    current_range = display_range(current_pair)
    outcomes = []
    for row in result["outcomes"]:
        rate_range = row["targetRange"]
        target_mid = midpoint(rate_range)
        current_mid = midpoint(current_range)
        bps = round(target_mid - current_mid)
        # midpoints are in basis points because midpoint() returns bps here
        direction = "cut" if bps < 0 else "hike" if bps > 0 else "hold"
        move = "No change" if bps == 0 else f"{abs(bps)} bps {direction}"
        outcomes.append({**row, "move": move, "direction": direction})

    probability_total = round(sum(float(row["probability"]) for row in outcomes), 1)
    if not 98.5 <= probability_total <= 101.5:
        raise RuntimeError(f"Probability total failed validation: {probability_total}")

    core = {
        "meetingDate": meeting_date,
        "meetingLabel": "Next FOMC decision",
        "currentTargetRange": current_range,
        "outcomes": outcomes,
    }
    old_core = {key: existing.get(key) for key in core}
    changed = core != old_core

    prior_checked = existing.get("lastCheckedAt") or existing.get("updatedAt")
    checkpoint_due = True
    if prior_checked:
        try:
            prior = datetime.fromisoformat(str(prior_checked).replace("Z", "+00:00"))
            checkpoint_due = checked_at - prior >= timedelta(hours=MIN_CHECKPOINT_HOURS)
        except ValueError:
            checkpoint_due = True

    if not changed and not checkpoint_due:
        print("CME FedWatch verified; values unchanged and six-hour checkpoint not due.")
        return

    updated_at = checked_at.isoformat().replace("+00:00", "Z") if changed else existing.get("updatedAt", checked_at.isoformat().replace("+00:00", "Z"))
    payload = {
        **existing,
        **core,
        "updatedAt": updated_at,
        "lastCheckedAt": checked_at.isoformat().replace("+00:00", "Z"),
        "officialDataChangedAt": updated_at,
        "source": "CME FedWatch",
        "sourceUrl": CME_PAGE,
        "sourceMode": result.get("mode"),
        "sourceStatus": "live",
        "live": True,
        "exactOfficialValues": True,
        "probabilityTotal": probability_total,
        "meetingDateTime": make_datetime(meeting_date),
        "meetingTimezone": "Asia/Kuala_Lumpur",
        "meetingTimezoneLabel": "Malaysia Time (MYT)",
        "note": "Target-rate probabilities verified directly from CME FedWatch. No Workers KV writes.",
        "engineVersion": ENGINE_VERSION,
        "kvWrite": False,
        "errors": errors,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote CME FedWatch snapshot: {meeting_date}; {outcomes}; changed={changed}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"FedWatch sync failed safely; existing JSON was not overwritten: {exc}", file=sys.stderr)
        raise
