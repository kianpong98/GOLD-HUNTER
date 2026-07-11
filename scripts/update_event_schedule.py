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
    key_period = release_period or dt_et.strftime("%Y-%m-%d")
    event_id = f"{event_type}-{key_period}{('-' + suffix) if suffix else ''}".replace("_", "-")
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
    result = sorted(dedup.values(), key=lambda e: e.get("datetime", ""))
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
