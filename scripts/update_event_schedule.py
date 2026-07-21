#!/usr/bin/env python3
"""Build upcoming Gold Hunter calendar events from official release schedules.

Best-effort official sources:
- BLS release schedule pages (CPI, PPI, Employment Situation)
- BEA release schedule (GDP, Personal Income and Outlays / PCE)
- Census retail release schedule
- Federal Reserve FOMC calendar and monthly events calendar
- Weekly Initial Claims schedule (Thursday 8:30 ET; source link remains DOL)

If an upstream page changes or is temporarily unavailable, the last committed
schedule is preserved rather than replacing it with an empty file.
"""
from __future__ import annotations

import json
import re
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup
from dateutil import parser as date_parser

OUT = Path("data/generated-events.json")
LEGACY = Path("data/market-events.json")
ET = ZoneInfo("America/New_York")
MYT = ZoneInfo("Asia/Kuala_Lumpur")
UA = "GoldHunterSchedule/1.0 (+https://goldhunter.site)"
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": UA, "Accept": "text/html,application/xhtml+xml"})
TODAY = datetime.now(timezone.utc).astimezone(ET).date()
HORIZON = TODAY + timedelta(days=120)

META: dict[str, dict[str, Any]] = {
    "cpi_yoy": dict(name="Consumer Price Index", nameZh="消费者物价指数", impact=5, whyZh="衡量美国整体通胀，通常会明显影响美元与黄金。", sourceName="U.S. Bureau of Labor Statistics", sourceUrl="https://www.bls.gov/schedule/news_release/cpi.htm"),
    "core_cpi_yoy": dict(name="Core Consumer Price Index", nameZh="核心消费者物价指数", impact=5, whyZh="剔除食品与能源，更能反映基础通胀趋势。", sourceName="U.S. Bureau of Labor Statistics", sourceUrl="https://www.bls.gov/schedule/news_release/cpi.htm"),
    "ppi_yoy": dict(name="Producer Price Index", nameZh="生产者物价指数", impact=4, whyZh="反映生产端通胀压力，可影响市场对利率的预期。", sourceName="U.S. Bureau of Labor Statistics", sourceUrl="https://www.bls.gov/schedule/news_release/ppi.htm"),
    "core_ppi_yoy": dict(name="Core Producer Price Index", nameZh="核心生产者物价指数", impact=4, whyZh="剔除波动较大的项目，用于观察持续性生产通胀。", sourceName="U.S. Bureau of Labor Statistics", sourceUrl="https://www.bls.gov/schedule/news_release/ppi.htm"),
    "nfp": dict(name="Nonfarm Payrolls", nameZh="非农就业人数", impact=5, whyZh="反映美国就业增长，公布时黄金通常波动较大。", sourceName="U.S. Bureau of Labor Statistics", sourceUrl="https://www.bls.gov/schedule/news_release/empsit.htm"),
    "unemployment": dict(name="Unemployment Rate", nameZh="失业率", impact=5, whyZh="反映劳动力市场强弱，并影响利率预期。", sourceName="U.S. Bureau of Labor Statistics", sourceUrl="https://www.bls.gov/schedule/news_release/empsit.htm"),
    "avg_hourly_earnings": dict(name="Average Hourly Earnings MoM", nameZh="平均每小时工资月率", impact=4, whyZh="工资增长会影响通胀与利率预期，并可能带动黄金波动。", sourceName="U.S. Bureau of Labor Statistics", sourceUrl="https://www.bls.gov/schedule/news_release/empsit.htm"),
    "retail_sales": dict(name="Retail Sales", nameZh="零售销售", impact=4, whyZh="反映消费强弱，可能改变经济与利率预期。", sourceName="U.S. Census Bureau", sourceUrl="https://www.census.gov/retail/release_schedule.html"),
    "jobless_claims": dict(name="Initial Jobless Claims", nameZh="初请失业金人数", impact=4, whyZh="反映就业市场短期变化，可能影响美元与黄金。", sourceName="U.S. Department of Labor", sourceUrl="https://www.dol.gov/ui/data.pdf"),
    "gdp": dict(name="GDP — Advance Estimate", nameZh="国内生产总值初值", impact=4, whyZh="衡量美国经济增长，是影响利率预期的重要数据。", sourceName="U.S. Bureau of Economic Analysis", sourceUrl="https://www.bea.gov/news/schedule"),
    "pce": dict(name="PCE Price Index", nameZh="PCE物价指数", impact=5, whyZh="美联储重点关注的通胀指标之一。", sourceName="U.S. Bureau of Economic Analysis", sourceUrl="https://www.bea.gov/news/schedule"),
    "core_pce": dict(name="Core PCE Price Index", nameZh="核心PCE物价指数", impact=5, whyZh="剔除食品与能源，是美联储观察基础通胀的重要指标。", sourceName="U.S. Bureau of Economic Analysis", sourceUrl="https://www.bea.gov/news/schedule"),
    "fomc": dict(name="FOMC Interest Rate Decision", nameZh="美联储利率决议", impact=5, whyZh="利率与政策措辞会直接改变美元、收益率和黄金定价。", sourceName="Federal Reserve", sourceUrl="https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"),
    "fomc_minutes": dict(name="FOMC Meeting Minutes", nameZh="美联储会议纪要", impact=4, whyZh="披露政策讨论细节，可能改变市场对未来利率路径的判断。", sourceName="Federal Reserve", sourceUrl="https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"),
    "fed_speech": dict(name="Federal Reserve Official Speech", nameZh="美联储官员讲话", impact=4, whyZh="官方讲话可能改变市场对利率路径的判断。", sourceName="Federal Reserve", sourceUrl="https://www.federalreserve.gov/newsevents/calendar.htm"),
}


def get(url: str) -> str:
    response = SESSION.get(url, timeout=45)
    response.raise_for_status()
    return response.text


def iso_myt(dt_et: datetime) -> str:
    return dt_et.astimezone(MYT).isoformat(timespec="seconds")


def period_previous_month(reference: str) -> str:
    parsed = date_parser.parse(reference, fuzzy=True, default=datetime(TODAY.year, TODAY.month, 1))
    return f"{parsed.year:04d}-{parsed.month:02d}"


def make_event(event_type: str, dt_et: datetime, release_period: str = "", suffix: str = "") -> dict[str, Any]:
    meta = META[event_type]
    # Always fold the actual release date into the id. releasePeriod alone is not
    # unique: two different releases can share a year-month label (e.g. the retail
    # release for May data lands in a month whose own data is also referenced),
    # which previously produced duplicate ids. Date + suffix guarantees uniqueness.
    release_day = dt_et.strftime("%Y-%m-%d")
    event_id = f"{event_type}-{release_day}{('-' + suffix) if suffix else ''}".replace("_", "-")
    return {
        "id": event_id,
        "type": event_type,
        "releasePeriod": release_period,
        "name": meta["name"],
        "nameZh": meta["nameZh"],
        "datetime": iso_myt(dt_et),
        "forecast": "",
        "previous": "",
        "actual": "",
        "sourceName": meta["sourceName"],
        "sourceUrl": meta["sourceUrl"],
        "impact": meta["impact"],
        "whyZh": meta["whyZh"],
    }


# Officially published 2026 release-date schedule (day of the release month),
# sourced from the White House OMB/OIRA "Schedule of Release Dates for Principal
# Federal Economic Indicators for 2026" — the same authoritative annual calendar
# the issuing agencies themselves publish and follow. Keyed by release month
# (1-12); the value is the day-of-month the release actually lands on. This
# replaces algorithmic guessing (e.g. "2nd Wednesday") which does NOT reliably
# match real agency scheduling — for example real 2026 CPI dates fall on a mix
# of Tuesdays, Wednesdays, Thursdays and Fridays depending on the month.
# NOTE: agencies do sometimes shift a date afterward (holidays, shutdowns, etc.)
# — update this table if/when a newer official calendar is published.
REAL_SCHEDULE_2026 = {
    "cpi_yoy":       {1: 13, 2: 11, 3: 11, 4: 10, 5: 12, 6: 10, 7: 14, 8: 12, 9: 11, 10: 14, 11: 10, 12: 10},
    "core_cpi_yoy":  {1: 13, 2: 11, 3: 11, 4: 10, 5: 12, 6: 10, 7: 14, 8: 12, 9: 11, 10: 14, 11: 10, 12: 10},
    "ppi_yoy":       {1: 14, 2: 12, 3: 12, 4: 14, 5: 13, 6: 11, 7: 15, 8: 13, 9: 10, 10: 15, 11: 13, 12: 15},
    "core_ppi_yoy":  {1: 14, 2: 12, 3: 12, 4: 14, 5: 13, 6: 11, 7: 15, 8: 13, 9: 10, 10: 15, 11: 13, 12: 15},
    "nfp":                 {1: 9, 2: 6, 3: 6, 4: 3, 5: 8, 6: 5, 7: 2, 8: 7, 9: 4, 10: 2, 11: 6, 12: 4},
    "unemployment":        {1: 9, 2: 6, 3: 6, 4: 3, 5: 8, 6: 5, 7: 2, 8: 7, 9: 4, 10: 2, 11: 6, 12: 4},
    "avg_hourly_earnings": {1: 9, 2: 6, 3: 6, 4: 3, 5: 8, 6: 5, 7: 2, 8: 7, 9: 4, 10: 2, 11: 6, 12: 4},
    "retail_sales":  {1: 15, 2: 17, 3: 16, 4: 16, 5: 14, 6: 17, 7: 16, 8: 14, 9: 16, 10: 15, 11: 17, 12: 16},
    "pce":           {1: 29, 2: 26, 3: 27, 4: 30, 5: 28, 6: 25, 7: 30, 8: 26, 9: 30, 10: 29, 11: 25, 12: 23},
    "core_pce":      {1: 29, 2: 26, 3: 27, 4: 30, 5: 28, 6: 25, 7: 30, 8: 26, 9: 30, 10: 29, 11: 25, 12: 23},
    "gdp":           {4: 30, 7: 30, 10: 29},  # advance estimate only, one per quarter
}


def real_schedule_date(event_type: str, year: int, month: int) -> date | None:
    day = REAL_SCHEDULE_2026.get(event_type, {}).get(month) if year == 2026 else None
    return date(year, month, day) if day else None


EXPECTED_WEEKDAY = {"cpi_yoy": 2, "core_cpi_yoy": 2, "ppi_yoy": 3, "core_ppi_yoy": 3,
                    "nfp": 4, "unemployment": 4, "avg_hourly_earnings": 4}  # Mon=0 ... Sun=6


def parse_bls_page(url: str, types: list[str]) -> list[dict[str, Any]]:
    soup = BeautifulSoup(get(url), "html.parser")
    events: list[dict[str, Any]] = []
    for row in soup.select("tr"):
        cells = [" ".join(cell.get_text(" ", strip=True).split()) for cell in row.select("th,td")]
        if len(cells) < 3:
            continue
        joined = " | ".join(cells)
        # Typical columns: Reference Month | Release Date | Release Time
        date_cell = next((c for c in cells if re.search(r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b.*\b20\d{2}\b", c, re.I)), "")
        time_cell = next((c for c in cells if re.search(r"\b\d{1,2}:\d{2}\s*(?:AM|PM)\b", c, re.I)), "")
        if not date_cell or not time_cell:
            continue
        try:
            release_date = date_parser.parse(date_cell, fuzzy=True).date()
            release_time = date_parser.parse(time_cell, fuzzy=True).time().replace(tzinfo=None)
        except Exception:
            continue
        if release_date < TODAY - timedelta(days=5) or release_date > HORIZON:
            continue
        # Reject any row whose date doesn't plausibly match this release's real,
        # officially published day (within a few days, to allow for a holiday
        # shift). A schedule/links/footnote table elsewhere on the page can
        # otherwise produce an unrelated date that LOOKS like a valid row (this
        # is exactly how a Tuesday got matched as a "CPI" release). Falls back
        # to the old weekday heuristic only for years the real table doesn't
        # cover yet (e.g. 2027+).
        def plausible(t: str) -> bool:
            real = real_schedule_date(t, release_date.year, release_date.month)
            if real:
                return abs((release_date - real).days) <= 4
            return EXPECTED_WEEKDAY.get(t) is None or release_date.weekday() == EXPECTED_WEEKDAY[t]
        if any(not plausible(t) for t in types):
            continue
        ref_cell = cells[0]
        try:
            release_period = period_previous_month(ref_cell)
        except Exception:
            release_period = ""
        dt_et = datetime.combine(release_date, release_time, ET)
        for event_type in types:
            events.append(make_event(event_type, dt_et, release_period))
    return events


def parse_bea() -> list[dict[str, Any]]:
    soup = BeautifulSoup(get("https://www.bea.gov/news/schedule"), "html.parser")
    events: list[dict[str, Any]] = []
    for row in soup.select("tr"):
        text = " ".join(row.get_text(" ", strip=True).split())
        if not text or not ("GDP" in text or "Personal Income and Outlays" in text):
            continue
        date_match = re.search(r"\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,\s*20\d{2})?", text, re.I)
        time_match = re.search(r"\b\d{1,2}:\d{2}\s*(?:a\.?m\.?|p\.?m\.?)", text, re.I)
        if not date_match or not time_match:
            continue
        try:
            d = date_parser.parse(date_match.group(0), default=datetime(TODAY.year, TODAY.month, 1)).date()
            t = date_parser.parse(time_match.group(0), fuzzy=True).time().replace(tzinfo=None)
        except Exception:
            continue
        if d < TODAY - timedelta(days=5) or d > HORIZON:
            continue
        dt_et = datetime.combine(d, t, ET)
        if "Personal Income and Outlays" in text:
            ref = re.search(r"Personal Income and Outlays,\s*([A-Za-z]+\s+20\d{2})", text, re.I)
            period = period_previous_month(ref.group(1)) if ref else ""
            events.extend([make_event("pce", dt_et, period), make_event("core_pce", dt_et, period)])
        if re.search(r"GDP\s*\(Advance Estimate\)", text, re.I):
            q = re.search(r"(\d)(?:st|nd|rd|th) Quarter\s+20(\d{2})", text, re.I)
            period = f"20{q.group(2)}-Q{q.group(1)}" if q else ""
            events.append(make_event("gdp", dt_et, period))
    return events


def parse_retail() -> list[dict[str, Any]]:
    soup = BeautifulSoup(get("https://www.census.gov/retail/release_schedule.html"), "html.parser")
    events: list[dict[str, Any]] = []
    for row in soup.select("tr"):
        cells = [" ".join(c.get_text(" ", strip=True).split()) for c in row.select("th,td")]
        if len(cells) < 2:
            continue
        ref, release = cells[0], " ".join(cells[1:])
        if not re.search(r"20\d{2}", ref) or not re.search(r"20\d{2}", release):
            continue
        try:
            release_date = date_parser.parse(release, fuzzy=True).date()
            release_period = period_previous_month(ref)
        except Exception:
            continue
        if release_date < TODAY - timedelta(days=5) or release_date > HORIZON:
            continue
        events.append(make_event("retail_sales", datetime.combine(release_date, time(8, 30), ET), release_period))
    return events


def parse_fomc() -> list[dict[str, Any]]:
    text = " ".join(BeautifulSoup(get("https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"), "html.parser").get_text(" ", strip=True).split())
    events: list[dict[str, Any]] = []
    # Matches blocks such as "July 28-29" under a year heading. Capture current/next year around each match.
    for match in re.finditer(r"\b(January|March|April|May|June|July|September|October|November|December)\s+(\d{1,2})(?:\s*[–-]\s*(\d{1,2}))?", text, re.I):
        month_name, start_day, end_day = match.group(1), int(match.group(2)), int(match.group(3) or match.group(2))
        prefix = text[max(0, match.start() - 300):match.start()]
        years = re.findall(r"\b20(?:2[5-9]|3\d)\b", prefix)
        year = int(years[-1]) if years else TODAY.year
        try:
            month = date_parser.parse(month_name).month
            decision_date = date(year, month, end_day)
        except Exception:
            continue
        if decision_date < TODAY - timedelta(days=5) or decision_date > HORIZON:
            continue
        decision_dt = datetime.combine(decision_date, time(14, 0), ET)
        period = decision_date.isoformat()
        events.append(make_event("fomc", decision_dt, period))
        minutes_dt = datetime.combine(decision_date + timedelta(days=21), time(14, 0), ET)
        if minutes_dt.date() <= HORIZON:
            events.append(make_event("fomc_minutes", minutes_dt, "", suffix=period))
    return events


def nth_weekday(year: int, month: int, weekday: int, n: int) -> date | None:
    """Return the date of the n-th given weekday (Mon=0) in a month, or None."""
    d = date(year, month, 1)
    count = 0
    while d.month == month:
        if d.weekday() == weekday:
            count += 1
            if count == n:
                return d
        d += timedelta(days=1)
    return None


def months_ahead(n: int) -> list[tuple[int, int]]:
    out = []
    y, m = TODAY.year, TODAY.month
    for _ in range(n):
        out.append((y, m))
        m += 1
        if m > 12:
            m, y = 1, y + 1
    return out


def estimated_schedule() -> list[dict[str, Any]]:
    """Safety-net future schedule used when the official scrape for a release
    fails or hasn't found an upcoming date yet. For 2026, dates come from the
    real, officially published OMB/OIRA release calendar (see REAL_SCHEDULE_2026
    above) — not a guessed pattern. For months beyond that table's coverage
    (2027+, until next year's official calendar is added), this falls back to
    a rough nth-weekday-of-month approximation as a last resort.
    """
    events: list[dict[str, Any]] = []

    def add(event_type: str, d: date | None, hh: int, mm: int, period: str):
        # Lower bound is 7 days out, not yesterday: a date that lands within the
        # next week is almost always THIS month's release, which has already
        # occurred. Estimates only need to cover genuinely-future months.
        if not d or d < TODAY + timedelta(days=7) or d > HORIZON:
            return
        ev = make_event(event_type, datetime.combine(d, time(hh, mm), ET), period)
        ev["estimated"] = True
        events.append(ev)

    def resolve(event_type: str, year: int, month: int, fallback: date | None) -> date | None:
        return real_schedule_date(event_type, year, month) or fallback

    for y, m in months_ahead(6):
        data_month = period_previous_month(f"{date(y, m, 1):%B %Y}")
        # CPI / core CPI
        cpi = resolve("cpi_yoy", y, m, nth_weekday(y, m, 2, 2))
        add("cpi_yoy", cpi, 8, 30, data_month)
        add("core_cpi_yoy", resolve("core_cpi_yoy", y, m, cpi), 8, 30, data_month)
        # PPI / core PPI
        ppi = resolve("ppi_yoy", y, m, nth_weekday(y, m, 3, 2))
        add("ppi_yoy", ppi, 8, 30, data_month)
        add("core_ppi_yoy", resolve("core_ppi_yoy", y, m, ppi), 8, 30, data_month)
        # NFP / Unemployment / AHE
        nfp = resolve("nfp", y, m, nth_weekday(y, m, 4, 1))
        add("nfp", nfp, 8, 30, data_month)
        add("unemployment", resolve("unemployment", y, m, nfp), 8, 30, data_month)
        add("avg_hourly_earnings", resolve("avg_hourly_earnings", y, m, nfp), 8, 30, data_month)
        # Retail Sales
        add("retail_sales", resolve("retail_sales", y, m, nth_weekday(y, m, 1, 3)), 8, 30, data_month)
        # PCE / core PCE
        pce = resolve("pce", y, m, nth_weekday(y, m, 4, 4))
        add("pce", pce, 8, 30, data_month)
        add("core_pce", resolve("core_pce", y, m, pce), 8, 30, data_month)
        # GDP advance — quarterly
        if m in (1, 4, 7, 10):
            q = (m - 1) // 3
            qy = y if q >= 1 else y - 1
            q = q if q >= 1 else 4
            add("gdp", resolve("gdp", y, m, nth_weekday(y, m, 3, 4)), 8, 30, f"{qy}-Q{q}")

    # FOMC meetings are published a year ahead and almost never move, so the
    # confirmed schedule is safe to hardcode as a fallback (decision day = 2nd
    # day of each meeting, announcement 2:00 PM ET). Update this list once a year.
    fomc_2026 = [date(2026, 1, 28), date(2026, 3, 18), date(2026, 4, 29), date(2026, 6, 17),
                 date(2026, 7, 29), date(2026, 9, 16), date(2026, 10, 28), date(2026, 12, 9)]
    fomc_2027 = [date(2027, 1, 27), date(2027, 3, 17)]
    for dday in fomc_2026 + fomc_2027:
        add("fomc", dday, 14, 0, dday.isoformat())
        mins = dday + timedelta(days=21)
        if TODAY - timedelta(days=1) <= mins <= HORIZON:
            ev = make_event("fomc_minutes", datetime.combine(mins, time(14, 0), ET), "", suffix=dday.isoformat())
            ev["estimated"] = True
            events.append(ev)
    return events


def generate_jobless() -> list[dict[str, Any]]:
    events = []
    d = TODAY
    while d.weekday() != 3:  # Thursday
        d += timedelta(days=1)
    while d <= HORIZON:
        reference = d - timedelta(days=5)  # week ending preceding Saturday
        events.append(make_event("jobless_claims", datetime.combine(d, time(8, 30), ET), reference.isoformat()))
        d += timedelta(days=7)
    return events


def load_existing() -> list[dict[str, Any]]:
    for path in (OUT, LEGACY):
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(data, list):
                    return data
            except Exception:
                pass
    return []


def main() -> None:
    existing = load_existing()
    existing_by_key = {(str(e.get("type", "")), str(e.get("releasePeriod", ""))): e for e in existing}
    events: list[dict[str, Any]] = []
    errors: dict[str, str] = {}
    tasks = [
        ("bls_cpi", lambda: parse_bls_page(META["cpi_yoy"]["sourceUrl"], ["cpi_yoy", "core_cpi_yoy"])),
        ("bls_ppi", lambda: parse_bls_page(META["ppi_yoy"]["sourceUrl"], ["ppi_yoy", "core_ppi_yoy"])),
        ("bls_jobs", lambda: parse_bls_page(META["nfp"]["sourceUrl"], ["nfp", "unemployment", "avg_hourly_earnings"])),
        ("bea", parse_bea),
        ("retail", parse_retail),
        ("fomc", parse_fomc),
        ("jobless", generate_jobless),
    ]
    for name, task in tasks:
        try:
            events.extend(task())
        except Exception as exc:
            errors[name] = str(exc)

    # Safety net: figure out which release types actually got a future-dated
    # entry from the scrapers above. For every type that did NOT (because its
    # source failed, changed, or returned nothing upcoming), fill in rule-based
    # estimated dates so that section of the calendar never goes blank. A real
    # scraped date always wins because estimates are merged with setdefault
    # after the real ones are already keyed in.
    types_with_future = set()
    for e in events:
        try:
            if datetime.fromisoformat(str(e.get("datetime"))).astimezone(ET).date() >= TODAY:
                types_with_future.add(str(e.get("type", "")))
        except Exception:
            continue
    estimates = [e for e in estimated_schedule() if str(e.get("type", "")) not in types_with_future]

    # Preserve official Fed speech entries already entered through admin. Their official
    # calendar is irregular; these remain event-only and only show speaker/time/status.
    for old in existing:
        if old.get("type") == "fed_speech" and new_time_ok(old.get("datetime")):
            events.append(old)

    dedup: dict[str, dict[str, Any]] = {}
    for event in events:
        key = (event.get("type", ""), event.get("releasePeriod", ""), event.get("datetime", "")[:10])
        old = existing_by_key.get((str(event.get("type", "")), str(event.get("releasePeriod", ""))))
        if old:
            event["forecast"] = str(old.get("forecast") or "")
        dedup["|".join(key)] = event

    # Add estimated fallbacks only where a real event for that type+period is not
    # already present. Keyed by type+period (not date) so a real scraped date for
    # the same reporting period always overrides the estimate, even if the day differs.
    real_type_periods = {(e.get("type", ""), e.get("releasePeriod", "")) for e in dedup.values()}
    for est in estimates:
        tp = (est.get("type", ""), est.get("releasePeriod", ""))
        if tp in real_type_periods:
            continue
        old = existing_by_key.get((str(est.get("type", "")), str(est.get("releasePeriod", ""))))
        if old and new_time_ok(old.get("datetime")):
            continue  # keep the previously stored (likely real) date
        if old:
            est["forecast"] = str(old.get("forecast") or "")
        key = "|".join((est.get("type", ""), est.get("releasePeriod", ""), est.get("datetime", "")[:10]))
        dedup.setdefault(key, est)

    # Self-healing: if a source failed this run, don't lose events the calendar
    # previously had — but ONLY carry forward old rows we can trust. A stale file
    # may contain bad-date numeric rows (e.g. a CPI mis-dated to a random weekday);
    # reviving those is exactly how 2026-07-21 CPI/PPI kept coming back. So an old
    # numeric macro row is carried forward only if the freshly-built schedule
    # already contains that metric for the same reporting period (meaning it's a
    # real release we just want to enrich), never as a brand-new date. Weekly
    # jobless claims and irregular fed speeches are rule-based/authoritative and
    # always safe to preserve.
    if errors:
        built_type_periods = {(e.get("type", ""), e.get("releasePeriod", "")) for e in dedup.values()}
        for old in existing:
            if not new_time_ok(old.get("datetime")):
                continue
            otype = str(old.get("type", ""))
            safe = (
                otype in ("jobless_claims", "fed_speech")
                or (otype, str(old.get("releasePeriod", ""))) in built_type_periods
            )
            if not safe:
                continue
            key = (old.get("type", ""), old.get("releasePeriod", ""), old.get("datetime", "")[:10])
            dedup.setdefault("|".join(key), old)

    # Universal real-schedule guard, applied last and to every event regardless
    # of source (scraper, estimate, or self-healing carry-forward): each event's
    # date must be within a plausible window of the real, officially published
    # release day for its type/month (small tolerance for a possible holiday
    # shift). This is the final backstop — even a bug in some path I haven't
    # anticipated cannot put a wrong-date event on the calendar, because
    # anything violating the real schedule is dropped right here.
    for key in list(dedup.keys()):
        ev = dedup[key]
        etype = str(ev.get("type", ""))
        if etype not in REAL_SCHEDULE_2026:
            continue
        try:
            ev_date = datetime.fromisoformat(str(ev.get("datetime"))).astimezone(ET).date()
        except Exception:
            del dedup[key]
            continue
        real = real_schedule_date(etype, ev_date.year, ev_date.month)
        if real is None:
            continue  # table doesn't cover this year/month (e.g. 2027+); nothing to check against
        if abs((ev_date - real).days) > 4:
            del dedup[key]

    # Authoritative FOMC decision-day whitelist. The scraper's regex can match
    # unrelated "Month D-D" strings elsewhere on the Fed page (e.g. statistical
    # release date lists), producing bogus consecutive-day FOMC rows like
    # 26/27/28/29 July. Only keep FOMC rows that fall on a real known decision
    # day (announcement = 2nd meeting day), and FOMC minutes ~21 days later.
    FOMC_DECISION_DAYS = {
        date(2026, 1, 28), date(2026, 3, 18), date(2026, 4, 29), date(2026, 6, 17),
        date(2026, 7, 29), date(2026, 9, 16), date(2026, 10, 28), date(2026, 12, 9),
        date(2027, 1, 27), date(2027, 3, 17), date(2027, 4, 28), date(2027, 6, 16),
    }
    def is_valid_fomc(ev: dict[str, Any]) -> bool:
        try:
            d = datetime.fromisoformat(str(ev.get("datetime"))).astimezone(ET).date()
        except Exception:
            return False
        if ev.get("type") == "fomc":
            return any(abs((d - dd).days) <= 1 for dd in FOMC_DECISION_DAYS)
        # fomc_minutes: ~3 weeks after a decision day
        return any(14 <= (d - dd).days <= 28 for dd in FOMC_DECISION_DAYS)

    for key in list(dedup.keys()):
        ev = dedup[key]
        if ev.get("type") in ("fomc", "fomc_minutes") and not is_valid_fomc(ev):
            del dedup[key]

    # Collapse FOMC/minutes by the canonical US-Eastern decision day. Two entries
    # for the SAME meeting can arrive with different stored timezones (e.g. one as
    # 2026-07-29T14:00 ET and another already converted to 2026-07-30T02:00 MYT),
    # which look like different calendar dates. Map each to the nearest known
    # decision day so they merge into exactly one row per meeting.
    def canonical_meeting_day(ev: dict[str, Any]):
        try:
            d = datetime.fromisoformat(str(ev.get("datetime"))).astimezone(ET).date()
        except Exception:
            return None
        if ev.get("type") == "fomc":
            near = [dd for dd in FOMC_DECISION_DAYS if abs((d - dd).days) <= 1]
            return min(near, key=lambda dd: abs((d - dd).days)) if near else d
        near = [dd for dd in FOMC_DECISION_DAYS if 14 <= (d - dd).days <= 28]
        return (min(near, key=lambda dd: (d - dd).days), "minutes") if near else d

    collapsed: dict[str, dict[str, Any]] = {}
    passthrough: list[dict[str, Any]] = []
    for ev in dedup.values():
        if ev.get("type") in ("fomc", "fomc_minutes"):
            ckey = f"{ev.get('type')}|{canonical_meeting_day(ev)}"
            prev = collapsed.get(ckey)
            if prev is None:
                collapsed[ckey] = ev
            else:
                # Prefer the entry that (a) is non-estimated, but above all (b) has
                # the correct announcement time. A stale file can carry the same
                # meeting with a wrong datetime; the estimated fallback is always
                # generated at the correct 2pm-ET / 02:00-next-day-MYT instant, so
                # when times disagree, trust whichever matches the canonical day.
                def good_time(x):
                    try:
                        dt = datetime.fromisoformat(str(x.get("datetime"))).astimezone(ET)
                    except Exception:
                        return False
                    return dt.hour == 14  # 2:00 PM ET announcement
                if good_time(ev) and not good_time(prev):
                    keep, drop = ev, prev
                elif good_time(prev) and not good_time(ev):
                    keep, drop = prev, ev
                else:
                    keep = prev if not prev.get("estimated") else ev
                    drop = ev if keep is prev else prev
                if not keep.get("forecast") and drop.get("forecast"):
                    keep["forecast"] = drop.get("forecast")
                collapsed[ckey] = keep
        else:
            passthrough.append(ev)

    result = sorted(list(collapsed.values()) + passthrough, key=lambda e: e.get("datetime", ""))

    # Authoritative FOMC rebuild: no matter what the scrapers, old file, or KV
    # produced, the final FOMC/minutes rows are regenerated from the trusted
    # decision-day whitelist with correct announcement times (2pm ET = 02:00
    # next-day MYT) and periods. Any admin-entered forecast is carried over by
    # matching decision day. This is the hard guarantee that garbage like the
    # 26/27/28/29-July duplicates can never appear on the calendar again.
    forecast_by_day: dict[date, str] = {}
    for ev in result:
        if ev.get("type") == "fomc" and ev.get("forecast"):
            cd = canonical_meeting_day(ev)
            if isinstance(cd, date):
                forecast_by_day[cd] = ev["forecast"]
    result = [e for e in result if e.get("type") not in ("fomc", "fomc_minutes")]
    for dday in sorted(FOMC_DECISION_DAYS):
        if not (TODAY - timedelta(days=1) <= dday <= HORIZON):
            continue
        fev = make_event("fomc", datetime.combine(dday, time(14, 0), ET), dday.isoformat())
        carried = forecast_by_day.get(dday) or next((v for k, v in forecast_by_day.items() if abs((k - dday).days) <= 1), "")
        if carried:
            fev["forecast"] = carried
        result.append(fev)
        mins = dday + timedelta(days=21)
        if TODAY - timedelta(days=1) <= mins <= HORIZON:
            result.append(make_event("fomc_minutes", datetime.combine(mins, time(14, 0), ET), "", suffix=dday.isoformat()))
    result.sort(key=lambda e: e.get("datetime", ""))

    if not result:
        raise SystemExit(f"No events generated; preserving old file. Errors: {errors}")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"events": len(result), "errors": errors}, ensure_ascii=False, indent=2))


def new_time_ok(value: Any) -> bool:
    try:
        d = datetime.fromisoformat(str(value)).astimezone(ET).date()
        return TODAY - timedelta(days=5) <= d <= HORIZON
    except Exception:
        return False


if __name__ == "__main__":
    main()
