// Runs 5+ products and writes docs/TEST_EVIDENCE.md (counts per source + good/bad matches).
// Usage:  PROVIDER_MODE=live node scripts/evidence.js "product one" "https://shop/p/2" ...
import fs from 'node:fs';
import { openDb } from '../src/db.js';
import { runSearch } from '../src/services/pipeline.js';
import { config } from '../src/config.js';

const products = process.argv.slice(2).length ? process.argv.slice(2) : [
  'Stanley Quencher H2.0 Tumbler', 'Nike Air Force 1 white', 'Dyson Airwrap', 'Sony WH-1000XM5 headphones', 'Lodge cast iron skillet',
];
const db = openDb(':memory:');
const sources = { instagram: true, meta_ads: true, tiktok: config.tiktok.enabled };
const short = (s) => (s || '').replace(/\s+/g, ' ').slice(0, 110);

let md = `# Test evidence\n\nProvider mode: **${config.providerMode}**${config.providerMode === 'mock' ? ' (synthetic data, re-run with PROVIDER_MODE=live for real evidence)' : ''}\nGenerated: ${new Date().toISOString()}\n\n`;
md += '| Product | Instagram | Meta ads | TikTok | Duplicates removed |\n|---|---|---|---|---|\n';
const details = [];
for (const p of products) {
  const r = await runSearch({ input: p, sources }, { db });
  const dup = Object.values(r.stats).reduce((a, s) => a + s.droppedDuplicate, 0);
  md += `| ${p} | ${r.stats.instagram?.count ?? '-'} | ${r.stats.meta_ads?.count ?? '-'} | ${r.stats.tiktok?.count ?? '-'} | ${dup} |\n`;
  const all = Object.values(r.results).flat().sort((a, b) => b.matchScore - a.matchScore);
  details.push({ p, good: all.slice(0, 2), bad: all.slice(-2), warnings: r.warnings });
}
md += '\n## Examples of good and bad matches\n';
for (const d of details) {
  md += `\n### ${d.p}\n`;
  d.good.forEach((v) => (md += `- GOOD ${v.matchScore} (${v.source}): ${short(v.caption)}\n`));
  d.bad.forEach((v) => (md += `- BAD ${v.matchScore} (${v.source}): ${short(v.caption)}\n`));
  d.warnings.forEach((w) => (md += `- warning: ${w}\n`));
}
fs.writeFileSync(new URL('../../docs/TEST_EVIDENCE.md', import.meta.url), md);
console.log(md);
