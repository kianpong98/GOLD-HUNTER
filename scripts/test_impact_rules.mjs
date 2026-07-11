// Lightweight deployment smoke test: confirms the API contains unified freshness,
// range parsing, comparison, surprise strength and Gold-impact fields.
import fs from 'node:fs';
const source=fs.readFileSync('functions/api/data-engine.js','utf8');
for (const token of ['mergeOfficialMetrics','parseComparable','surpriseStrength','goldImpactZh','avg_hourly_earnings']) {
  if (!source.includes(token)) throw new Error(`Missing V4 token: ${token}`);
}
console.log('V4 unified data engine smoke test passed.');
