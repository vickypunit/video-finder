import test from 'node:test';
import assert from 'node:assert/strict';
import { withRetry, withTimeout, isRetryable } from '../src/utils/retry.js';
import { TtlCache } from '../src/utils/cache.js';
import { parseImageDataUrl } from '../src/utils/image.js';
import { openDb } from '../src/db.js';
import { collectSource, runSearch } from '../src/services/pipeline.js';
import { mockPage } from '../src/collectors/mock.js';
import { config } from '../src/config.js';

config.providerMode = 'mock';
const noWait = () => Promise.resolve();

test('withRetry retries transient errors then succeeds', async () => {
  let calls = 0;
  const out = await withRetry(async () => { if (++calls < 3) throw new Error('network'); return 'ok'; }, { retries: 2, wait: noWait });
  assert.equal(out, 'ok');
  assert.equal(calls, 3);
});

test('withRetry does not retry rate limits, auth errors or 4xx', async () => {
  for (const err of [Object.assign(new Error('rl'), { rateLimited: true }), Object.assign(new Error('auth'), { noRetry: true }), Object.assign(new Error('bad'), { status: 400 })]) {
    let calls = 0;
    await assert.rejects(withRetry(async () => { calls++; throw err; }, { retries: 3, wait: noWait }));
    assert.equal(calls, 1);
    assert.equal(isRetryable(err), false);
  }
  assert.equal(isRetryable(Object.assign(new Error('x'), { status: 503 })), true);
});

test('withTimeout rejects slow work', async () => {
  await assert.rejects(withTimeout(new Promise((r) => setTimeout(r, 200)), 20, 'slow'), /timed out/);
});

test('TtlCache expires, bounds size and shares in-flight work', async () => {
  const c = new TtlCache({ max: 2, ttlMs: 20 });
  c.set('a', 1); c.set('b', 2); c.set('c', 3);
  assert.equal(c.get('a'), undefined); // evicted
  assert.equal(c.get('c'), 3);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(c.get('c'), undefined); // expired
  let runs = 0;
  const slow = () => new Promise((r) => setTimeout(() => { runs++; r('v'); }, 10));
  const [x, y] = await Promise.all([c.getOrSet('k', slow), c.getOrSet('k', slow)]);
  assert.deepEqual([x, y, runs], ['v', 'v', 1]);
  await assert.rejects(c.getOrSet('bad', async () => { throw new Error('no'); }));
  assert.equal(c.get('bad'), undefined); // failures are not cached
});

test('collectSource retries a flaky page and still reaches the minimum', async () => {
  const db = openDb(':memory:');
  let calls = 0;
  const flaky = { id: 'instagram', collectPage: async (a) => { if (++calls === 1) throw new Error('socket hang up'); return mockPage('instagram', a.queries, a.cursor); } };
  const out = await collectSource(flaky, { queries: ['red shoes'], hashtags: [], productKey: 'k', db, seen: new Set(), min: 20, maxPages: 5, retryBaseMs: 1, retries: 2 });
  assert.ok(out.fresh.length >= 20);
  assert.equal(out.retries, 1);
  assert.equal(out.error, null);
});

test('one failing source does not break the others and is reported', async () => {
  const db = openDb(':memory:');
  const broken = { id: 'meta_ads', collectPage: async () => { throw Object.assign(new Error('token expired'), { noRetry: true }); } };
  const ok = { id: 'instagram', collectPage: async (a) => mockPage('instagram', a.queries, a.cursor) };
  const r = await runSearch({ input: 'blue yoga mat', sources: { instagram: true, meta_ads: true, tiktok: false } }, { db, collectors: { instagram: ok, meta_ads: broken } });
  assert.ok(r.results.instagram.length >= 20);
  assert.equal(r.results.meta_ads.length, 0);
  assert.ok(r.warnings.some((w) => w.startsWith('meta_ads') && /token expired/.test(w)));
});

test('a source that is too slow stops at the deadline and keeps what it has', async () => {
  const db = openDb(':memory:');
  const slow = { id: 'instagram', collectPage: async (a) => { await new Promise((r) => setTimeout(r, 30)); return mockPage('instagram', a.queries, a.cursor); } };
  const out = await collectSource(slow, { queries: ['x y'], hashtags: [], productKey: 'k2', db, seen: new Set(), min: 500, maxPages: 50, sourceTimeoutMs: 100, retries: 0 });
  assert.match(out.error, /too long/);
  assert.ok(out.fresh.length > 0);
});

test('image upload validation: type, shape and size', () => {
  const tiny = 'data:image/png;base64,iVBORw0KGgo=';
  assert.equal(parseImageDataUrl(tiny, 1000).mediaType, 'image/png');
  assert.throws(() => parseImageDataUrl('data:text/html;base64,PGI+', 1000), (e) => e.code === 'INVALID_IMAGE');
  assert.throws(() => parseImageDataUrl('not an image', 1000), (e) => e.code === 'INVALID_IMAGE');
  assert.throws(() => parseImageDataUrl(`data:image/png;base64,${'A'.repeat(4000)}`, 1000), (e) => e.code === 'IMAGE_TOO_LARGE');
});

test('image-only search needs the vision key; name + image works and is never persisted as bytes', async () => {
  const db = openDb(':memory:');
  const img = 'data:image/png;base64,iVBORw0KGgo=';
  const saved = config.anthropic.apiKey;
  config.anthropic.apiKey = '';
  await assert.rejects(runSearch({ input: '', image: img, sources: { instagram: true, meta_ads: false, tiktok: false } }, { db }), (e) => e.code === 'IMAGE_NEEDS_VISION');
  const r = await runSearch({ input: 'graphic tee', image: img, sources: { instagram: true, meta_ads: false, tiktok: false } }, { db });
  config.anthropic.apiKey = saved;
  assert.ok(r.results.instagram.length >= 20);
  assert.equal(r.product.imageData, undefined);
  assert.equal(r.product.uploadedImage, true);
});

test('repeat search keeps the threshold flag and strong counts', async () => {
  const db = openDb(':memory:');
  const r = await runSearch({ input: 'Hydro Steel Water Bottle', sources: { instagram: true, meta_ads: true, tiktok: false } }, { db });
  assert.equal(r.threshold, config.matchThreshold);
  for (const id of ['instagram', 'meta_ads']) {
    assert.equal(r.stats[id].strong, r.results[id].filter((v) => !v.lowMatch).length);
    assert.ok(r.results[id].every((v) => typeof v.matchReason === 'string' && v.matchReason.length > 5));
  }
});
