import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { runSearch } from '../src/services/pipeline.js';
import { config } from '../src/config.js';

config.providerMode = 'mock';

test('meets the 20 + 20 minimum and a repeat search returns only new videos', async () => {
  const db = openDb(':memory:');
  const sources = { instagram: true, meta_ads: true, tiktok: false };

  const first = await runSearch({ input: 'Hydro Steel Water Bottle', sources }, { db });
  assert.ok(first.results.instagram.length >= 20, `instagram ${first.results.instagram.length}`);
  assert.ok(first.results.meta_ads.length >= 20, `meta_ads ${first.results.meta_ads.length}`);
  assert.deepEqual(first.warnings, []);

  const second = await runSearch({ input: 'Hydro Steel Water Bottle', sources }, { db });
  const firstIds = new Set([...first.results.instagram, ...first.results.meta_ads].map((v) => v.id));
  const overlap = [...second.results.instagram, ...second.results.meta_ads].filter((v) => firstIds.has(v.id));
  assert.equal(overlap.length, 0);
  assert.ok(second.results.instagram.length >= 20);
});

test('different products keep separate histories', async () => {
  const db = openDb(':memory:');
  const s = { instagram: true, meta_ads: false, tiktok: false };
  const a = await runSearch({ input: 'red running shoes', sources: s }, { db });
  const b = await runSearch({ input: 'blue yoga mat', sources: s }, { db });
  assert.ok(a.results.instagram.length >= 20 && b.results.instagram.length >= 20);
});

test('rejects when no source is on', async () => {
  const db = openDb(':memory:');
  await assert.rejects(runSearch({ input: 'x y', sources: { instagram: false, meta_ads: false, tiktok: false } }, { db }), (e) => e.code === 'NO_SOURCES');
});
