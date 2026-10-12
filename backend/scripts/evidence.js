// Runs 5+ products and writes docs/TEST_EVIDENCE.md:
// counts per source, strong matches, a repeat-search proof, and good / bad match examples with reasons.
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
const cell = (s, k) => (s?.[k] ?? '-');

let md = `# Test evidence\n\nProvider mode: **${config.providerMode}**${config.providerMode === 'mock' ? ' (synthetic data, re-run with PROVIDER_MODE=live for real evidence)' : ''}\n`;
md += `Match threshold: ${config.matchThreshold} (below this a video is flagged low match). Generated: ${new Date().toISOString()}\n\n`;
md += '| Product | Instagram (new / strong) | Meta ads (new / strong) | TikTok | Duplicates removed | Visual check | Warnings |\n|---|---|---|---|---|---|---|\n';
const details = [];
let firstRun = null;
for (const p of products) {
  const r = await runSearch({ input: p, sources }, { db });
  if (!firstRun) firstRun = { p, r };
  const dup = Object.values(r.stats).reduce((a, s) => a + s.droppedDuplicate, 0);
  const pair = (id) => (r.stats[id] ? `${cell(r.stats[id], 'count')} / ${cell(r.stats[id], 'strong')}` : '-');
  md += `| ${p} | ${pair('instagram')} | ${pair('meta_ads')} | ${r.stats.tiktok ? pair('tiktok') : '-'} | ${dup} | ${r.visual.available ? `${r.visual.compared} compared` : 'text only'} | ${r.warnings.length || 'none'} |\n`;
  const all = Object.values(r.results).flat().sort((a, b) => b.matchScore - a.matchScore);
  details.push({ p, brain: r.brain, good: all.slice(0, 3), bad: all.slice(-3), warnings: r.warnings, notes: r.notes });
}

// Uniqueness: same product again must return only videos that were not shown the first time.
const again = await runSearch({ input: firstRun.p, sources }, { db });
const ids = new Set(Object.values(firstRun.r.results).flat().map((v) => `${v.source}:${v.id}`));
const overlap = Object.values(again.results).flat().filter((v) => ids.has(`${v.source}:${v.id}`)).length;
md += `\n## Repeat search (uniqueness)\n\nProduct: **${firstRun.p}**. First search returned ${ids.size} videos; searching again returned ` +
  `${Object.values(again.results).flat().length} videos, of which **${overlap}** had been shown before. ` +
  `Per source now: ${Object.entries(again.stats).map(([k, v]) => `${k} ${v.count}`).join(', ')}.\n`;

md += '\n## Examples of good and bad matches\n';
for (const d of details) {
  md += `\n### ${d.p}\n`;
  if (d.brain.summary) md += `Image brain: ${short(d.brain.summary)}\n\n`;
  d.good.forEach((v) => (md += `- GOOD ${v.matchScore} (${v.source}): ${short(v.caption)}\n  - why: ${short(v.matchReason)}\n`));
  d.bad.forEach((v) => (md += `- BAD ${v.matchScore} (${v.source}): ${short(v.caption)}\n  - why: ${short(v.matchReason)}\n`));
  d.warnings.forEach((w) => (md += `- warning: ${w}\n`));
  d.notes.forEach((w) => (md += `- note: ${w}\n`));
}
fs.writeFileSync(new URL('../../docs/TEST_EVIDENCE.md', import.meta.url), md);
console.log(md);
