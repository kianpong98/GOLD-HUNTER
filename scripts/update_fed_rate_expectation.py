#!/usr/bin/env python3
"""Safely refresh the next-meeting CME FedWatch target-rate probabilities.

Reliability rules
-----------------
1. Use CME's authenticated FedWatch REST API when credentials are configured.
2. Otherwise try CME's public page with several HTTP/1.1 transports and retries.
3. Validate the target-rate table (contiguous ranges, total approximately 100%).
4. Never overwrite the last verified JSON when CME is unavailable or blocked.
5. A temporary source failure exits successfully so the scheduled workflow stays
   healthy and retries on its next run. A diagnostic report is still produced.
6. No Cloudflare Workers KV writes are used.

For guaranteed intraday official data, configure CME_FEDWATCH_ACCESS_TOKEN and,
when supplied by CME, CME_FEDWATCH_API_URL in GitHub Actions secrets.
"""
from __future__ import annotations

import html as html_lib
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import requests

OUT = Path("assets/data/rate-expectation.json")
DEBUG_DIR = Path("artifacts/fedwatch-debug")
CME_PAGE = "https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html"
DEFAULT_API = "https://markets.api.cmegroup.com/fedwatch/v1/forecasts"
ENGINE_VERSION = "fedwatch-github-sync-1.2-safe"
MIN_CHECKPOINT_HOURS = 6
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/18.1 Safari/605.1.15",
]


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("–", "-").replace("—", "-")).strip()


def parse_range(value: Any) -> tuple[int, int] | None:
    nums = re.findall(r"\d+(?:\.\d+)?", clean(value))
    if len(nums) < 2:
        return None
    lo, hi = float(nums[0]), float(nums[1])
    if hi > 20:  # basis-points labels such as 350-375
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
        if depth > 20 or not isinstance(value, (dict, list)):
            return
        ident = id(value)
        if ident in seen:
            return
        seen.add(ident)
        if isinstance(value, dict):
            rate_value = None
            prob_value = None
            for key, child in value.items():
                key_norm = re.sub(r"[^a-z]", "", str(key).lower())
                if rate_value is None and any(x in key_norm for x in ("targetrange", "raterange", "targetrate", "range")):
                    rate_value = child
                if prob_value is None and any(x in key_norm for x in ("probability", "percentage", "percent", "prob")):
                    prob_value = child
            if rate_value is not None and prob_value is not None:
                rows.append({"range": rate_value, "probability": prob_value})
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
        pair = parse_range(row.get("range") or row.get("targetRange"))
        prob = probability(row.get("probability"))
        if pair and prob is not None:
            by_range[pair] = prob
    ordered = sorted(by_range.items())
    candidates: list[tuple[float, list[tuple[tuple[int, int], float]]]] = []
    for start in range(len(ordered)):
        total = 0.0
        group: list[tuple[tuple[int, int], float]] = []
        for index in range(start, min(len(ordered), start + 10)):
            pair, prob = ordered[index]
            if group and pair[0] != group[-1][0][1]:
                break
            group.append((pair, prob))
            total += prob
            if 98.5 <= total <= 101.5 and len(group) >= 2:
                includes_current = current is None or any(p == current for p, _ in group)
                candidates.append((abs(total - 100) + (0 if includes_current else 10), list(group)))
    if not candidates:
        raise RuntimeError("CME rows did not form a contiguous probability table totaling about 100%")
    group = min(candidates, key=lambda item: item[0])[1]
    return [{"targetRange": display_range(pair), "probability": prob} for pair, prob in group]


def parse_date(text: str) -> str:
    direct = re.search(r"(20\d{2})[-/](\d{1,2})[-/](\d{1,2})", text)
    if direct:
        return f"{direct.group(1)}-{int(direct.group(2)):02d}-{int(direct.group(3)):02d}"
    for fmt in ("%d %b %Y", "%d %B %Y", "%b %d, %Y", "%B %d, %Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(text.strip(), fmt).date().isoformat()
        except ValueError:
            pass
    return ""


def text_from_html(raw: str) -> str:
    raw = re.sub(r"(?is)<script[^>]*>.*?</script>", " ", raw)
    raw = re.sub(r"(?is)<style[^>]*>.*?</style>", " ", raw)
    raw = re.sub(r"(?s)<[^>]+>", " ", raw)
    return clean(html_lib.unescape(raw))


def parse_document(raw: str) -> dict[str, Any]:
    # Inspect embedded JSON first; CME can place the table in script payloads.
    rows: list[dict[str, Any]] = []
    for match in re.finditer(r"(?s)<script[^>]*>(.*?)</script>", raw):
        body = html_lib.unescape(match.group(1)).strip()
        possible = [body]
        # Also inspect JSON object/array substrings inside assignment wrappers.
        first_obj, last_obj = body.find("{"), body.rfind("}")
        first_arr, last_arr = body.find("["), body.rfind("]")
        if first_obj >= 0 and last_obj > first_obj:
            possible.append(body[first_obj:last_obj + 1])
        if first_arr >= 0 and last_arr > first_arr:
            possible.append(body[first_arr:last_arr + 1])
        for candidate in possible:
            try:
                rows.extend(rows_from_object(json.loads(candidate)))
            except Exception:
                pass

    visible = text_from_html(raw)
    current_match = re.search(
        r"current(?: federal funds)? target rate(?: is|:)\s*(\d+(?:\.\d+)?\s*%?\s*-\s*\d+(?:\.\d+)?\s*%?)",
        visible, re.I,
    )
    current = parse_range(current_match.group(1)) if current_match else None
    meeting_date = ""
    meeting_match = re.search(r"Target Rate Probabilities for\s+(.{3,45}?)\s+Fed Meeting", visible, re.I)
    if meeting_match:
        meeting_date = parse_date(meeting_match.group(1))

    # Visible table fallback (350-375 ... 54.6%).
    pattern = re.compile(
        r"(?<!\d)(\d{2,4}(?:\.\d+)?\s*-\s*\d{2,4}(?:\.\d+)?)(?:[^\d%]{0,180})(\d{1,3}(?:\.\d+)?)\s*%",
        re.I,
    )
    rows.extend({"range": m.group(1), "probability": m.group(2)} for m in pattern.finditer(visible))
    outcomes = coherent_outcomes(rows, current)
    return {"meetingDate": meeting_date, "current": current, "outcomes": outcomes}


def request_headers(user_agent: str) -> dict[str, str]:
    return {
        "User-Agent": user_agent,
        "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Referer": "https://www.cmegroup.com/",
        "Connection": "close",
    }


def fetch_api() -> dict[str, Any] | None:
    token = os.getenv("CME_FEDWATCH_ACCESS_TOKEN", "").strip()
    if not token:
        return None
    url = os.getenv("CME_FEDWATCH_API_URL", DEFAULT_API).strip()
    response = requests.get(url, timeout=60, headers={"Accept": "application/json", "Authorization": f"Bearer {token}"})
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


def fetch_with_requests() -> tuple[str, str]:
    errors: list[str] = []
    session = requests.Session()
    for attempt in range(1, 5):
        ua = USER_AGENTS[(attempt - 1) % len(USER_AGENTS)]
        try:
            response = session.get(CME_PAGE, timeout=(20, 70), headers=request_headers(ua), allow_redirects=True)
            if response.status_code == 200 and len(response.text) > 5000:
                return response.text, "official-public-http1-requests"
            errors.append(f"attempt {attempt}: HTTP {response.status_code}, bytes={len(response.content)}")
        except Exception as exc:
            errors.append(f"attempt {attempt}: {type(exc).__name__}: {exc}")
        time.sleep(attempt * 3)
    raise RuntimeError("; ".join(errors))


def fetch_with_curl() -> tuple[str, str]:
    errors: list[str] = []
    for attempt in range(1, 4):
        ua = USER_AGENTS[(attempt - 1) % len(USER_AGENTS)]
        command = [
            "curl", "--http1.1", "--location", "--compressed", "--silent", "--show-error",
            "--fail-with-body", "--connect-timeout", "20", "--max-time", "90",
            "--retry", "2", "--retry-delay", "3", "--retry-all-errors",
            "-A", ua, "-H", "Accept-Language: en-US,en;q=0.9", "-H", "Referer: https://www.cmegroup.com/",
            CME_PAGE,
        ]
        try:
            completed = subprocess.run(command, check=True, capture_output=True, text=True)
            if len(completed.stdout) > 5000:
                return completed.stdout, "official-public-http1-curl"
            errors.append(f"attempt {attempt}: response too small ({len(completed.stdout)} bytes)")
        except Exception as exc:
            stderr = getattr(exc, "stderr", "")
            errors.append(f"attempt {attempt}: {type(exc).__name__}: {clean(stderr or exc)}")
        time.sleep(attempt * 3)
    raise RuntimeError("; ".join(errors))


def fetch_public_page() -> dict[str, Any]:
    DEBUG_DIR.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    for fetcher in (fetch_with_requests, fetch_with_curl):
        try:
            raw, mode = fetcher()
            (DEBUG_DIR / f"page-{mode}.html").write_text(raw, encoding="utf-8")
            parsed = parse_document(raw)
            parsed["mode"] = mode
            return parsed
        except Exception as exc:
            errors.append(f"{fetcher.__name__}: {exc}")
    raise RuntimeError(" | ".join(errors))


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


def write_diagnostic(checked_at: datetime, errors: list[str]) -> None:
    DEBUG_DIR.mkdir(parents=True, exist_ok=True)
    report = {
        "checkedAt": checked_at.isoformat().replace("+00:00", "Z"),
        "engineVersion": ENGINE_VERSION,
        "source": CME_PAGE,
        "result": "source-unavailable-existing-snapshot-preserved",
        "errors": errors,
        "hint": "For guaranteed official intraday updates, configure CME_FEDWATCH_ACCESS_TOKEN and CME_FEDWATCH_API_URL.",
    }
    (DEBUG_DIR / "result.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


def main() -> int:
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
        write_diagnostic(checked_at, errors)
        print("CME is temporarily unavailable or blocking automation. Existing verified snapshot was preserved.")
        for error in errors:
            print("-", error)
        return 0

    meeting_date = result.get("meetingDate") or existing.get("meetingDate")
    current_pair = result.get("current") or parse_range(existing.get("currentTargetRange"))
    if not meeting_date or not current_pair:
        errors.append("meeting date/current target range could not be safely verified")
        write_diagnostic(checked_at, errors)
        print("CME response was incomplete. Existing verified snapshot was preserved.")
        return 0

    current_range = display_range(current_pair)
    outcomes = []
    for row in result["outcomes"]:
        target_mid = midpoint(row["targetRange"])
        current_mid = midpoint(current_range)
        bps = round(target_mid - current_mid)
        direction = "cut" if bps < 0 else "hike" if bps > 0 else "hold"
        move = "No change" if bps == 0 else f"{abs(bps)} bps {direction}"
        outcomes.append({**row, "move": move, "direction": direction})

    total = round(sum(float(row["probability"]) for row in outcomes), 1)
    if not 98.5 <= total <= 101.5:
        errors.append(f"probability total failed validation: {total}")
        write_diagnostic(checked_at, errors)
        print("CME table failed validation. Existing verified snapshot was preserved.")
        return 0

    core = {"meetingDate": meeting_date, "meetingLabel": "Next FOMC decision", "currentTargetRange": current_range, "outcomes": outcomes}
    changed = core != {key: existing.get(key) for key in core}
    prior_checked = existing.get("lastCheckedAt") or existing.get("updatedAt")
    checkpoint_due = True
    if prior_checked:
        try:
            prior = datetime.fromisoformat(str(prior_checked).replace("Z", "+00:00"))
            checkpoint_due = checked_at - prior >= timedelta(hours=MIN_CHECKPOINT_HOURS)
        except ValueError:
            pass
    if not changed and not checkpoint_due:
        print("CME verified; probabilities unchanged and freshness checkpoint is not due.")
        return 0

    now_text = checked_at.isoformat().replace("+00:00", "Z")
    updated_at = now_text if changed else existing.get("updatedAt", now_text)
    payload = {
        **existing, **core,
        "updatedAt": updated_at,
        "lastCheckedAt": now_text,
        "officialDataChangedAt": updated_at,
        "source": "CME FedWatch",
        "sourceUrl": CME_PAGE,
        "sourceMode": "official-github-sync",
        "sourceTransport": result.get("mode"),
        "sourceStatus": "live",
        "live": True,
        "exactOfficialValues": True,
        "probabilityTotal": total,
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
    print(f"Wrote CME snapshot: {meeting_date}; {outcomes}; changed={changed}; via={result.get('mode')}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        # Last-resort safety: preserve existing JSON and keep the scheduled job alive.
        DEBUG_DIR.mkdir(parents=True, exist_ok=True)
        (DEBUG_DIR / "fatal.txt").write_text(f"{type(exc).__name__}: {exc}\n", encoding="utf-8")
        print(f"Unexpected FedWatch updater error; existing snapshot preserved: {exc}", file=sys.stderr)
        raise SystemExit(0)
