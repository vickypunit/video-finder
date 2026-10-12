import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';

config.providerMode = 'mock';
config.rateLimitPerMinute = 1000;

async function boot() {
  const db = openDb(':memory:');
  const app = createApp(db);
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => server.close(), app };
}
const post = (base, body) => fetch(`${base}/api/search`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
async function waitDone(base, id) {
  for (let i = 0; i < 100; i++) {
    const j = await (await fetch(`${base}/api/search/${id}`)).json();
    if (j.status === 'done' || j.status === 'error') return j;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('job did not finish');
}

test('POST /api/search answers 202 at once, job finishes with 20 + 20', async () => {
  const { base, close } = await boot();
  try {
    const res = await post(base, { input: 'Hydro Steel Water Bottle', sources: { instagram: true, meta_ads: true } });
    assert.equal(res.status, 202);
    const { jobId } = await res.json();
    const job = await waitDone(base, jobId);
    assert.equal(job.status, 'done');
    assert.ok(job.result.results.instagram.length >= 20 && job.result.results.meta_ads.length >= 20);
    assert.ok(job.progress.some((p) => p.stage === 'searching'));
    assert.ok(job.progress.some((p) => p.stage === 'scoring'));
    assert.ok(Number.isInteger(job.searchId));
  } finally { close(); }
});

test('SSE streams progress and ends with a done event', async () => {
  const { base, close } = await boot();
  try {
    const { jobId } = await (await post(base, { input: 'blue yoga mat', sources: { instagram: true, meta_ads: true } })).json();
    const res = await fetch(`${base}/api/search/${jobId}/events`);
    assert.match(res.headers.get('content-type'), /text\/event-stream/);
    const text = await res.text(); // the server closes the stream after `done`
    assert.match(text, /event: progress/);
    assert.match(text, /"stage":"scoring"/);
    assert.match(text, /event: done/);
  } finally { close(); }
});

test('repeat search returns new videos and /previous lists the old ones', async () => {
  const { base, close } = await boot();
  try {
    const run = async () => waitDone(base, (await (await post(base, { input: 'red running shoes', sources: { instagram: true, meta_ads: false } })).json()).jobId);
    const a = await run();
    const b = await run();
    const idsA = new Set(a.result.results.instagram.map((v) => v.id));
    assert.equal(b.result.results.instagram.filter((v) => idsA.has(v.id)).length, 0);
    const prev = await (await fetch(`${base}/api/history/${b.searchId}/previous`)).json();
    assert.equal(prev.results.instagram.length, a.result.results.instagram.length);
    assert.ok(prev.results.instagram.every((v) => v.previouslySeen === true));
  } finally { close(); }
});

test('errors are clear: bad input 400, missing job 404, unsafe URL surfaces on the job', async () => {
  const { base, close } = await boot();
  try {
    const bad = await post(base, { input: 'x' });
    assert.equal(bad.status, 400);
    assert.equal((await bad.json()).error.code, 'INVALID_INPUT');
    const missing = await fetch(`${base}/api/search/nope`);
    assert.equal(missing.status, 404);
    const { jobId } = await (await post(base, { input: 'http://127.0.0.1:4000/admin' })).json();
    const job = await waitDone(base, jobId);
    assert.equal(job.status, 'error');
    assert.ok(job.error.code && job.error.message);
  } finally { close(); }
});

test('bad image upload is rejected', async () => {
  const { base, close } = await boot();
  try {
    const { jobId } = await (await post(base, { input: 'tee', image: 'data:text/html;base64,PGI+' })).json();
    const job = await waitDone(base, jobId);
    assert.equal(job.error.code, 'INVALID_IMAGE');
  } finally { close(); }
});
