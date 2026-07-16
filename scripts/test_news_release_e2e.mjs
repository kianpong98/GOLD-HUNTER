#!/usr/bin/env node
/**
 * Gold Hunter end-to-end news release simulation.
 *
 * Runs the real Cloudflare data-engine module with an in-memory KV namespace,
 * synthetic schedule, and synthetic official-data snapshot. It never contacts
 * production, never writes real KV, and never edits repository data.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const ENGINE = path.join(ROOT, 'functions/api/data-engine.js');
const SCHEDULE = path.join(ROOT, 'data/generated-events.json');
const OFFICIAL = path.join(ROOT, 'data/official-data.json');
const REPORT_JSON = path.join(ROOT, 'news-e2e-report.json');
const REPORT_MD = path.join(ROOT, 'news-e2e-report.md');

const AUTO_TYPES = [
  'cpi_yoy','core_cpi_yoy','ppi_yoy','core_ppi_yoy','retail_sales',
  'jobless_claims','fomc','gdp','pce','core_pce','nfp','unemployment',
  'avg_hourly_earnings'
];

class MemoryKV {
  constructor(initial = {}) { this.map = new Map(Object.entries(initial).map(([k,v]) => [k, structuredClone(v)])); this.puts = []; }
  async get(key, opts = {}) {
    if (!this.map.has(key)) return null;
    const value = structuredClone(this.map.get(key));
    return opts?.type === 'json' ? value : JSON.stringify(value);
  }
  async put(key, value) {
    const parsed = typeof value === 'string' ? JSON.parse(value) : structuredClone(value);
    this.map.set(key, parsed); this.puts.push({ key, value: structuredClone(parsed) });
  }
}

const checks = [];
function check(name, ok, detail = '') { checks.push({ name, ok: Boolean(ok), detail }); }
function fail(name, error) { checks.push({ name, ok: false, detail: error?.stack || String(error) }); }

function syntheticValue(type, idx) {
  if (['nfp','jobless_claims'].includes(type)) return `${220 + idx}K`;
  if (type === 'fomc') return '3.75–4.00%';
  return `${(2.0 + idx / 10).toFixed(1)}%`;
}
function syntheticPrevious(type, idx) {
  if (['nfp','jobless_claims'].includes(type)) return `${215 + idx}K`;
  if (type === 'fomc') return '4.00–4.25%';
  return `${(1.9 + idx / 10).toFixed(1)}%`;
}
function periodFor(type, idx) {
  if (type === 'jobless_claims') return `2099-01-${String(10 + idx).padStart(2,'0')}`;
  if (type === 'fomc') return '2099-01-30';
  if (type === 'gdp') return '2099-Q1';
  return `2099-${String((idx % 9) + 1).padStart(2,'0')}`;
}

async function loadJson(file) { return JSON.parse(await fs.readFile(file, 'utf8')); }

async function main() {
  const startedAt = new Date().toISOString();
  const sourceSchedule = await loadJson(SCHEDULE);
  const sourceOfficial = await loadJson(OFFICIAL);
  check('Project files readable', Array.isArray(sourceSchedule) && sourceOfficial?.metrics, `schedule=${sourceSchedule.length}`);

  const missingTypes = AUTO_TYPES.filter(t => !sourceSchedule.some(e => e.type === t));
  check('All 13 supported news types exist in schedule', missingTypes.length === 0, missingTypes.join(', '));

  const duplicateKeys = [];
  const seen = new Set();
  for (const e of sourceSchedule.filter(e => AUTO_TYPES.includes(e.type))) {
    const k = `${e.type}|${e.releasePeriod}`;
    if (seen.has(k)) duplicateKeys.push(k); else seen.add(k);
  }
  check('No duplicate type + releasePeriod rows', duplicateKeys.length === 0, duplicateKeys.join(', '));

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gh-news-e2e-'));
  const engineCopy = path.join(tempDir, 'data-engine.mjs');
  await fs.copyFile(ENGINE, engineCopy);

  const releaseIso = '2099-01-30T20:30:00+08:00';
  const schedule = AUTO_TYPES.map((type, idx) => ({
    id: `e2e-${type}`,
    type,
    releasePeriod: periodFor(type, idx),
    name: `E2E ${type}`,
    nameZh: `测试 ${type}`,
    datetime: releaseIso,
    forecast: syntheticPrevious(type, idx),
    previous: syntheticPrevious(type, idx),
    sourceName: 'E2E official source',
    sourceUrl: 'https://example.invalid',
    impact: 5,
    releaseHistory: [],
    releaseForecasts: {}
  }));

  let officialPayload = { schemaVersion: 99, updatedAt: '2099-01-30T12:30:05Z', metrics: {}, errors: {}, coverage: {} };
  let fakeNow = Date.parse('2099-01-30T12:29:00Z'); // 20:29 MYT
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...args) { super(...(args.length ? args : [fakeNow])); }
    static now() { return fakeNow; }
  }
  globalThis.Date = FakeDate;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('/data/generated-events.json')) return new Response(JSON.stringify(schedule), { status: 200, headers: { 'content-type': 'application/json' } });
    if (url.includes('/data/official-data.json')) return new Response(JSON.stringify(officialPayload), { status: 200, headers: { 'content-type': 'application/json' } });
    throw new Error(`E2E blocked unexpected network request: ${url}`);
  };

  try {
    const mod = await import(`${pathToFileURL(engineCopy).href}?v=${Date.now()}`);
    check('Real data-engine module imports', typeof mod.onRequestGet === 'function');

    const kv = new MemoryKV({ 'gold-market-events-v3': schedule });
    const env = { GH_MARKET_DATA: kv, ADMIN_PIN: 'e2e-pin' };
    const call = async () => {
      const request = new Request('https://e2e.invalid/api/data-engine', { headers: { 'x-admin-pin': 'e2e-pin' } });
      const response = await mod.onRequestGet({ request, env });
      const body = await response.json();
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${JSON.stringify(body)}`);
      return body;
    };

    // Phase A: one minute before release.
    let body = await call();
    for (const type of AUTO_TYPES) {
      const row = body.events.find(e => e.type === type);
      check(`${type}: pre-release row returned`, Boolean(row));
      check(`${type}: pre-release Actual remains empty`, row?.actual === '', `actual=${row?.actual}`);
      check(`${type}: Forecast preserved before release`, row?.forecast === schedule.find(e=>e.type===type).forecast, `forecast=${row?.forecast}`);
      check(`${type}: status Scheduled before release`, row?.status === 'Scheduled', `status=${row?.status}`);
    }

    // Phase B: after scheduled time but official period is still old.
    fakeNow = Date.parse('2099-01-30T12:31:00Z');
    officialPayload.metrics = Object.fromEntries(AUTO_TYPES.map((type, idx) => [type, {
      period: type === 'gdp' ? '2098-Q4' : type === 'jobless_claims' ? '2099-01-01' : type === 'fomc' ? '2098-12-01' : '2098-12',
      actual: syntheticValue(type, idx), previous: syntheticPrevious(type, idx), history: []
    }]));
    body = await call();
    for (const type of AUTO_TYPES) {
      const row = body.events.find(e => e.type === type);
      check(`${type}: wrong-period Actual is rejected`, row?.actual === '', `actual=${row?.actual}, officialPeriod=${row?.officialPeriod}`);
      check(`${type}: no premature Last Release`, !row?.lastRelease?.actual, JSON.stringify(row?.lastRelease || null));
    }

    // Phase C: exact official period arrives.
    officialPayload.metrics = Object.fromEntries(AUTO_TYPES.map((type, idx) => [type, {
      period: schedule.find(e=>e.type===type).releasePeriod,
      actual: syntheticValue(type, idx),
      previous: syntheticPrevious(type, idx),
      observationDate: schedule.find(e=>e.type===type).releasePeriod,
      source: 'E2E verified official snapshot',
      history: [
        { period: schedule.find(e=>e.type===type).releasePeriod, actual: syntheticValue(type, idx), previous: syntheticPrevious(type, idx) },
        { period: `older-${idx}`, actual: syntheticPrevious(type, idx), previous: syntheticPrevious(type, idx) }
      ]
    }]));
    body = await call();
    for (const type of AUTO_TYPES) {
      const row = body.events.find(e => e.type === type);
      const expected = syntheticValue(type, AUTO_TYPES.indexOf(type));
      check(`${type}: exact-period Actual appears`, row?.actual === expected, `actual=${row?.actual}, expected=${expected}`);
      check(`${type}: Forecast survives release`, row?.forecast === schedule.find(e=>e.type===type).forecast, `forecast=${row?.forecast}`);
      check(`${type}: Last Release receives Actual`, row?.lastRelease?.actual === expected, JSON.stringify(row?.lastRelease || null));
      check(`${type}: Last Release receives Forecast`, row?.lastRelease?.forecast === schedule.find(e=>e.type===type).forecast, JSON.stringify(row?.lastRelease || null));
      check(`${type}: Last Release stores real release datetime`, row?.lastRelease?.dateTime === releaseIso, JSON.stringify(row?.lastRelease || null));
      check(`${type}: frontend payload contains required fields`, ['id','type','datetime','releasePeriod','actual','forecast','previous','status','history'].every(k => Object.hasOwn(row,k)));
    }
    check('Release merge writes only events KV', kv.puts.every(x => ['gold-market-events-v3','official-release-history-v1'].includes(x.key)), kv.puts.map(x=>x.key).join(', '));
    check('Admin forecast overrides key is never written', !kv.puts.some(x => x.key === 'news-admin-overrides-v1'));

    // Phase D: next Malaysia day, exact release archives while Last Release persists.
    fakeNow = Date.parse('2099-01-31T00:05:00Z'); // 08:05 MYT next day
    body = await call();
    for (const type of AUTO_TYPES.filter(t => t !== 'fomc')) {
      const row = body.events.find(e => e.type === type);
      check(`${type}: archived live Actual is cleared`, row?.actual === '', `actual=${row?.actual}`);
      check(`${type}: archived Last Release persists`, row?.lastRelease?.actual === syntheticValue(type, AUTO_TYPES.indexOf(type)), JSON.stringify(row?.lastRelease || null));
      check(`${type}: archived Forecast persists`, row?.lastRelease?.forecast === schedule.find(e=>e.type===type).forecast, JSON.stringify(row?.lastRelease || null));
    }

    // Structural coverage of watcher/lifecycle/UI code that the runtime harness does not execute.
    const watcher = await fs.readFile(path.join(ROOT,'.github/workflows/actual-release-watcher.yml'),'utf8');
    const lifecycle = await fs.readFile(path.join(ROOT,'.github/workflows/run-release-lifecycle.yml'),'utf8');
    const marketTools = await fs.readFile(path.join(ROOT,'market-tools.js'),'utf8');
    check('Actual watcher has automatic schedule trigger', /schedule:\s*[\s\S]*cron:/m.test(watcher));
    check('Actual watcher supports manual dispatch', /workflow_dispatch:/m.test(watcher));
    check('Lifecycle workflow has automatic schedule trigger', /schedule:\s*[\s\S]*cron:/m.test(lifecycle));
    check('Frontend contains waiting-for-official-result state', /Waiting for official release|Awaiting official result/i.test(marketTools));
  } catch (error) {
    fail('E2E harness execution', error);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.Date = RealDate;
    await fs.rm(tempDir, { recursive: true, force: true });
  }

  const failed = checks.filter(c => !c.ok);
  const report = {
    suite: 'Gold Hunter News Release End-to-End Simulation',
    startedAt,
    finishedAt: new Date().toISOString(),
    readOnly: true,
    productionKvWrites: 0,
    total: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    verdict: failed.length ? 'NO-GO' : 'FULL PASS',
    checks
  };
  await fs.writeFile(REPORT_JSON, JSON.stringify(report, null, 2));
  const md = [
    '# Gold Hunter News Release E2E Report','',
    `**Verdict:** ${report.verdict}`,
    `**Passed:** ${report.passed}/${report.total}`,
    `**Production writes:** 0 (in-memory simulation only)`,'',
    '## Checks','',
    ...checks.map(c => `- ${c.ok ? '✅' : '❌'} ${c.name}${c.detail ? ` — ${String(c.detail).replace(/\n/g,' ')}` : ''}`)
  ].join('\n');
  await fs.writeFile(REPORT_MD, md);
  console.log(`\n${report.verdict}: ${report.passed}/${report.total} checks passed`);
  for (const c of failed) console.error(`FAIL: ${c.name}: ${c.detail}`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch(error => { console.error(error); process.exit(1); });
