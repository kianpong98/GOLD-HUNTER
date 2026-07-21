#!/usr/bin/env python3
"""Sync official central bank gold reserves (tonnes) from the IMF's free,
keyless International Financial Statistics (IFS) API.

Indicator: RAFAGOLDV_OZT = "Reserve Assets, Gold, Volume, Fine Troy Ounces"
(this is IMF's own official gold-reserves-in-volume series, confirmed against
IMF/DBnomics documentation). Converted here from troy ounces to tonnes.

IMPORTANT — read before enabling the scheduled workflow:
This script has NOT been validated against a live response yet. IMF's
CompactData endpoint keys each series by a REF_AREA code that is *usually*
the ISO alpha-2 country code, but not always (IMF-administered pools like
"IMF" itself, or the ECB, use different area codes than a normal country).
The COUNTRY_CODES map below is a best-effort guess and should be checked
against a real API response before this is trusted for accuracy. Because
main() only overwrites the output file after every configured country has
been fetched AND at least MIN_SUCCESSFUL of them succeeded, a wrong or
unreachable code for any single country fails safely (that one row is
skipped, logged, and does not corrupt the rest) — but if MIN_SUCCESSFUL is
not met, the script raises and the existing file (and the GitHub Actions
job) is left untouched rather than silently publishing bad data.
"""
from __future__ import annotations
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
import requests

BASE = 'http://dataservices.imf.org/REST/SDMX_JSON.svc/CompactData/IFS'
INDICATOR = 'RAFAGOLDV_OZT'
OUNCE_TO_TONNE = 31.1034768 / 1_000_000  # 1 fine troy ounce -> metric tonnes
OUT = Path('assets/data/gold-reserves.json')
SOURCE_URL = 'https://www.gold.org/goldhub/data/gold-reserves-by-country'
HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; GoldHunter/1.0)', 'Accept': 'application/json'}
MIN_SUCCESSFUL = 10  # refuse to publish a partial/broken sync with too few countries

# Best-effort IMF REF_AREA codes for major official gold holders. Verify against
# a live API call (see the __main__ debug helper below) before fully trusting this.
COUNTRY_CODES = {
    'United States': 'US', 'Germany': 'DE', 'Italy': 'IT', 'France': 'FR',
    'Russia': 'RU', 'China': 'CN', 'Switzerland': 'CH', 'Japan': 'JP',
    'India': 'IN', 'Netherlands': 'NL', 'Turkey': 'TR', 'Taiwan': 'TW',
    'Portugal': 'PT', 'Uzbekistan': 'UZ', 'Saudi Arabia': 'SA',
    'United Kingdom': 'GB', 'Kazakhstan': 'KZ', 'Lebanon': 'LB',
    'Spain': 'ES', 'Austria': 'AT', 'Belgium': 'BE', 'Philippines': 'PH',
    'Algeria': 'DZ', 'Thailand': 'TH', 'Singapore': 'SG', 'Sweden': 'SE',
    'South Africa': 'ZA', 'Mexico': 'MX', 'Libya': 'LY', 'Egypt': 'EG',
}


def fetch_series(ref_area: str):
    url = f'{BASE}/M.{ref_area}.{INDICATOR}'
    r = requests.get(url, timeout=30, headers=HEADERS)
    r.raise_for_status()
    data = r.json()
    series = data.get('CompactData', {}).get('DataSet', {}).get('Series')
    if not series:
        raise RuntimeError('no series in response')
    if isinstance(series, list):
        series = series[0]
    obs = series.get('Obs')
    if not obs:
        raise RuntimeError('no observations in response')
    if isinstance(obs, dict):
        obs = [obs]
    obs = sorted(obs, key=lambda o: o.get('@TIME_PERIOD', ''))
    latest, previous = obs[-1], obs[-2] if len(obs) > 1 else None
    latest_oz = float(latest['@OBS_VALUE'])
    previous_oz = float(previous['@OBS_VALUE']) if previous else None
    return latest_oz, previous_oz, latest.get('@TIME_PERIOD')


def main():
    records = []
    errors = {}
    for country, ref_area in COUNTRY_CODES.items():
        try:
            latest_oz, previous_oz, period = fetch_series(ref_area)
            holdings_tonnes = round(latest_oz * OUNCE_TO_TONNE, 2)
            change_tonnes = round((latest_oz - previous_oz) * OUNCE_TO_TONNE, 2) if previous_oz is not None else None
            if not (0 < holdings_tonnes < 20000):
                raise RuntimeError(f'implausible holdings value {holdings_tonnes}t')
            records.append({
                'country': country,
                'holdingsTonnes': holdings_tonnes,
                'monthlyChangeTonnes': change_tonnes,
                'period': period,
            })
        except Exception as exc:  # noqa: BLE001 - one bad country must not kill the run
            errors[country] = str(exc)

    if len(records) < MIN_SUCCESSFUL:
        raise RuntimeError(
            f'Only {len(records)}/{len(COUNTRY_CODES)} countries synced successfully '
            f'(need at least {MIN_SUCCESSFUL}); refusing to publish a partial sync. '
            f'Errors: {errors}'
        )

    records.sort(key=lambda r: r['holdingsTonnes'], reverse=True)
    net_change = sum(r['monthlyChangeTonnes'] for r in records if r['monthlyChangeTonnes'] is not None)
    payload = {
        'source': 'World Gold Council / IMF IFS (RAFAGOLDV_OZT, automated sync)',
        'sourceUrl': SOURCE_URL,
        'updatedAt': datetime.now(timezone.utc).isoformat(),
        'summary': {
            'netMonthlyChangeTonnes': round(net_change, 2),
            'signal': 'Net accumulation' if net_change > 0 else ('Net disposal' if net_change < 0 else 'No net change'),
        },
        'records': records,
        'syncErrors': errors,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Wrote {len(records)} official gold reserve records to {OUT} ({len(errors)} countries failed: {list(errors)})')


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--debug-one':
        # Manual validation helper: python scripts/update_gold_reserves.py --debug-one US
        code = sys.argv[2] if len(sys.argv) > 2 else 'US'
        print(fetch_series(code))
    else:
        main()
