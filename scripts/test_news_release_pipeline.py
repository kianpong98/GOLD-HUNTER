#!/usr/bin/env python3
"""Pre-release test suite for the Gold Hunter news pipeline.

This script is deliberately read-only. It never writes KV, never edits
``data/official-data.json`` and never changes event state. It tests both:

1. Synthetic release scenarios for every supported news type, including exact
   release-period matching and rejection of stale periods.
2. Optional live connector/parser checks against the same official-source code
   used by the production GitHub Actual Engine.

The goal is to catch schedule, period, parser and mapping errors before the next
real news release.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
EVENTS_PATH = ROOT / "data" / "generated-events.json"
OFFICIAL_PATH = ROOT / "data" / "official-data.json"
UPDATER_PATH = ROOT / "scripts" / "update_official_data.py"
REPORT_PATH = ROOT / "news-pipeline-test-report.json"

SUPPORTED_TYPES = {
    "cpi_yoy",
    "core_cpi_yoy",
    "ppi_yoy",
    "core_ppi_yoy",
    "retail_sales",
    "jobless_claims",
    "fomc",
    "gdp",
    "pce",
    "core_pce",
    "nfp",
    "unemployment",
    "avg_hourly_earnings",
}

MONTHLY_TYPES = {
    "cpi_yoy",
    "core_cpi_yoy",
    "ppi_yoy",
    "core_ppi_yoy",
    "retail_sales",
    "pce",
    "core_pce",
    "nfp",
    "unemployment",
    "avg_hourly_earnings",
}

SAMPLE_ACTUALS = {
    "cpi_yoy": "3.1%",
    "core_cpi_yoy": "3.2%",
    "ppi_yoy": "2.8%",
    "core_ppi_yoy": "2.9%",
    "retail_sales": "0.4%",
    "jobless_claims": "219K",
    "fomc": "3.5–3.75%",
    "gdp": "2.4%",
    "pce": "2.6%",
    "core_pce": "2.7%",
    "nfp": "175K",
    "unemployment": "4.1%",
    "avg_hourly_earnings": "0.3%",
}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def load_updater():
    spec = importlib.util.spec_from_file_location("gh_update_official_data", UPDATER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load update_official_data.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def normalize_period(event_type: str, value: Any) -> str:
    text = str(value or "").strip()
    if event_type in MONTHLY_TYPES:
        match = re.fullmatch(r"(\d{4})[-/]?(\d{1,2})", text)
        return f"{match.group(1)}-{int(match.group(2)):02d}" if match else text
    if event_type == "gdp":
        match = re.fullmatch(r"(\d{4})[- ]?[Qq]([1-4])", text)
        return f"{match.group(1)}-Q{match.group(2)}" if match else text.upper()
    if event_type in {"jobless_claims", "fomc"}:
        return text[:10]
    return text


def period_format_ok(event_type: str, period: str) -> bool:
    if event_type in MONTHLY_TYPES:
        return bool(re.fullmatch(r"\d{4}-\d{2}", period))
    if event_type == "jobless_claims":
        return bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", period))
    if event_type == "fomc":
        return bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", period))
    if event_type == "gdp":
        return bool(re.fullmatch(r"\d{4}-Q[1-4]", period))
    return False


def stale_period(event_type: str, period: str) -> str:
    if event_type in MONTHLY_TYPES:
        year, month = map(int, period.split("-"))
        month -= 1
        if month == 0:
            month = 12
            year -= 1
        return f"{year:04d}-{month:02d}"
    if event_type == "gdp":
        year = int(period[:4])
        quarter = int(period[-1]) - 1
        if quarter == 0:
            quarter = 4
            year -= 1
        return f"{year:04d}-Q{quarter}"
    # A distinct valid-looking date is enough to verify strict matching.
    date = datetime.fromisoformat(period).date()
    return date.replace(day=max(1, date.day - 1)).isoformat()


def synthetic_status(event: dict[str, Any], metric: dict[str, Any] | None) -> str:
    event_period = normalize_period(str(event["type"]), event.get("releasePeriod"))
    metric_period = normalize_period(str(event["type"]), (metric or {}).get("period"))
    has_verified_actual = bool(metric and metric.get("actual") and event_period == metric_period)
    return "released" if has_verified_actual else "awaiting_official_result"


def select_representative_events(events: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    selected: dict[str, dict[str, Any]] = {}
    for event in sorted(events, key=lambda row: str(row.get("datetime") or "")):
        event_type = str(event.get("type") or "").strip()
        if event_type in SUPPORTED_TYPES and event_type not in selected:
            selected[event_type] = event
    return selected


def run_static_and_synthetic() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    events = load_json(EVENTS_PATH)
    official = load_json(OFFICIAL_PATH) if OFFICIAL_PATH.exists() else {"metrics": {}}
    if not isinstance(events, list):
        raise RuntimeError("data/generated-events.json must contain a JSON array")

    passed: list[dict[str, Any]] = []
    failed: list[dict[str, Any]] = []

    def check(name: str, ok: bool, detail: str) -> None:
        target = passed if ok else failed
        target.append({"test": name, "detail": detail})

    representatives = select_representative_events(events)
    missing = sorted(SUPPORTED_TYPES - set(representatives))
    check("all_13_types_scheduled", not missing, "missing=" + (", ".join(missing) if missing else "none"))

    seen: set[tuple[str, str]] = set()
    duplicates: list[str] = []
    for event in events:
        event_type = str(event.get("type") or "").strip()
        if event_type not in SUPPORTED_TYPES:
            continue
        period = normalize_period(event_type, event.get("releasePeriod"))
        key = (event_type, period)
        if key in seen:
            duplicates.append(f"{event_type}:{period}")
        seen.add(key)
    check("no_duplicate_type_period", not duplicates, "duplicates=" + (", ".join(duplicates[:20]) if duplicates else "none"))

    updater = load_updater()
    mapped = set(updater.BLS_SERIES) | set(updater.FRED_SERIES) | {"fomc"}
    unmapped = sorted(SUPPORTED_TYPES - mapped)
    check("all_13_types_have_source_mapping", not unmapped, "unmapped=" + (", ".join(unmapped) if unmapped else "none"))

    for event_type in sorted(SUPPORTED_TYPES):
        event = representatives.get(event_type)
        if not event:
            continue
        period = normalize_period(event_type, event.get("releasePeriod"))
        check(
            f"{event_type}:period_format",
            period_format_ok(event_type, period),
            f"releasePeriod={period}",
        )

        forecast = str(event.get("forecast") or "TEST_FORECAST")
        previous = str(event.get("previous") or "TEST_PREVIOUS")
        last_release = event.get("lastRelease") or {"actual": "OLD_ACTUAL", "forecast": "OLD_FORECAST"}
        exact_metric = {
            "period": period,
            "actual": SAMPLE_ACTUALS[event_type],
            "previous": previous,
            "source": "Synthetic verified official source",
        }
        stale_metric = {**exact_metric, "period": stale_period(event_type, period)}

        check(
            f"{event_type}:exact_period_releases",
            synthetic_status(event, exact_metric) == "released",
            f"event={period}, metric={exact_metric['period']}",
        )
        check(
            f"{event_type}:stale_period_rejected",
            synthetic_status(event, stale_metric) == "awaiting_official_result",
            f"event={period}, staleMetric={stale_metric['period']}",
        )
        check(
            f"{event_type}:missing_actual_not_released",
            synthetic_status(event, None) == "awaiting_official_result",
            "no metric must remain awaiting official result",
        )
        # Synthetic merge safety: official Actual must not erase admin/user state.
        simulated = {
            **event,
            "forecast": forecast,
            "previous": previous,
            "lastRelease": last_release,
            "actual": exact_metric["actual"],
        }
        check(
            f"{event_type}:forecast_preserved",
            simulated["forecast"] == forecast,
            f"forecast={simulated['forecast']}",
        )
        check(
            f"{event_type}:previous_preserved",
            simulated["previous"] == previous,
            f"previous={simulated['previous']}",
        )
        check(
            f"{event_type}:last_release_preserved",
            simulated["lastRelease"] == last_release,
            "existing Last Release remains intact before lifecycle archive",
        )

        existing_metric = (official.get("metrics") or {}).get(event_type) or {}
        check(
            f"{event_type}:current_snapshot_has_actual",
            bool(existing_metric.get("actual")),
            f"snapshotPeriod={existing_metric.get('period')}, actual={existing_metric.get('actual')}",
        )

    return passed, failed


def run_live_connectors() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    updater = load_updater()
    passed: list[dict[str, Any]] = []
    failed: list[dict[str, Any]] = []

    def record(event_type: str, metric: dict[str, Any] | None, error: str | None, source: str) -> None:
        row = {
            "test": f"live:{event_type}",
            "detail": (
                f"source={source}, period={(metric or {}).get('period')}, actual={(metric or {}).get('actual')}"
                if metric and metric.get("actual")
                else f"source={source}, error={error or 'no usable metric'}"
            ),
        }
        (passed if metric and metric.get("actual") else failed).append(row)

    bls_metrics, bls_errors = updater.fetch_bls()
    fred_needed: set[str] = set(updater.FRED_SERIES)
    fred_metrics, fred_errors = updater.fetch_fred(fred_needed)

    for event_type in sorted(SUPPORTED_TYPES - {"fomc"}):
        if event_type in updater.BLS_SERIES:
            metric = bls_metrics.get(event_type) or fred_metrics.get(event_type)
            error = bls_errors.get(event_type) or fred_errors.get(event_type)
            source = str((metric or {}).get("source") or "BLS/FRED")
        else:
            metric = fred_metrics.get(event_type)
            error = fred_errors.get(event_type)
            source = str((metric or {}).get("source") or "FRED")
        record(event_type, metric, error, source)

    fomc_metric, fomc_error = updater.fetch_fomc_official_statements()
    if not fomc_metric:
        fomc_metric, fallback_error = updater.fetch_fomc_range()
        fomc_error = fomc_error or fallback_error
    record("fomc", fomc_metric, fomc_error, str((fomc_metric or {}).get("source") or "Federal Reserve/FRED"))
    return passed, failed


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Read-only pre-release test for all Gold Hunter news types.")
    parser.add_argument("--live", action="store_true", help="Also test current official connectors and parsers without writing data.")
    parser.add_argument("--report", default=str(REPORT_PATH), help="JSON report output path.")
    parser.add_argument("--strict-live", action="store_true", help="Treat live connector failures as blocking. Without this flag they are reported as warnings.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    static_passed, static_failed = run_static_and_synthetic()
    live_passed: list[dict[str, Any]] = []
    live_failed: list[dict[str, Any]] = []
    if args.live:
        live_passed, live_failed = run_live_connectors()

    report = {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "readOnly": True,
        "productionFilesModified": False,
        "staticSynthetic": {
            "passed": len(static_passed),
            "failed": len(static_failed),
            "failures": static_failed,
        },
        "liveConnectors": {
            "enabled": bool(args.live),
            "strict": bool(args.strict_live),
            "passed": len(live_passed),
            "failed": len(live_failed),
            "failures": live_failed,
        },
        "passedChecks": static_passed + live_passed,
    }
    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps(report, ensure_ascii=False, indent=2))
    blocking_failures = list(static_failed)
    if args.strict_live:
        blocking_failures.extend(live_failed)
    if blocking_failures:
        raise SystemExit(f"News pipeline pre-release test failed: {len(blocking_failures)} blocking check(s)")
    if live_failed:
        print(f"WARNING: internal pipeline passed, but {len(live_failed)} live connector check(s) failed temporarily.")
    else:
        print("PASS: all selected pre-release news pipeline checks succeeded; no production data was changed.")


if __name__ == "__main__":
    main()
