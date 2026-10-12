import crypto from 'node:crypto';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { TtlCache } from '../utils/cache.js';
import { productImageBlock, productImageKey } from '../utils/image.js';
import { tokenize } from '../utils/text.js';
import { idKey } from './dedup.js';

/**
 * Visual match: compares the product photo with each video thumbnail using a vision model.
 * Returns Map<idKey, { score 0-100, reason }>. Videos without a usable thumbnail are simply
 * absent from the map, so scoring falls back to text-only for them (never a fake number).
 */
const SYSTEM = `You compare ONE reference product photo (first image) with several video thumbnails.
For each thumbnail decide whether it shows the SAME product (same design, colour, print/graphic, logo, shape).
Return ONLY a JSON array, one object per thumbnail, no markdown:
[{"index": 0, "score": 0-100, "reason": "max 14 words, say what matches or differs"}]
Scoring guide: 90-100 exact same product; 60-89 very close variant (same type + colour/print mostly match);
30-59 same category but clearly different design; 0-29 different product, no product visible, or unreadable.
Judge only what you can see. Never guess from the filename or URL.`;

const cache = new TtlCache({ max: 3000, ttlMs: 6 * 60 * 60 * 1000 });
export const clearVisualCache = () => cache.clear();

const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

/** Deterministic stand-in for sample mode. Clearly labelled, never used in live mode. */
export function mockVisual(videos, product) {
  const want = new Set(tokenize(product.title));
  const out = new Map();
  for (const v of videos) {
    const h = parseInt(crypto.createHash('md5').update(idKey(v)).digest('hex').slice(0, 6), 16);
    const hit = tokenize(v.caption).some((t) => want.has(t));
    const score = hit ? 55 + (h % 41) : h % 26;
    out.set(idKey(v), { score, reason: hit ? 'Sample mode: simulated visual match (looks like the product)' : 'Sample mode: simulated visual match (no product visible)' });
  }
  return out;
}

function parseArray(text) {
  const clean = text.replace(/```json|```/g, '').trim();
  const start = clean.indexOf('[');
  const end = clean.lastIndexOf(']');
  return JSON.parse(clean.slice(start, end + 1));
}

async function callBatch(refBlock, batch) {
  const content = [{ type: 'text', text: 'Reference product photo:' }, refBlock];
  batch.forEach((v, i) => {
    content.push({ type: 'text', text: `Thumbnail ${i}:` });
    content.push({ type: 'image', source: { type: 'url', url: v.thumbnail } });
  });
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: AbortSignal.timeout(45000),
    headers: { 'content-type': 'application/json', 'x-api-key': config.anthropic.apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: config.anthropic.model, max_tokens: 1200, system: SYSTEM, messages: [{ role: 'user', content }] }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
  const data = await res.json();
  return parseArray(data.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
}

async function pool(items, size, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  }));
}

/**
 * @returns {{ matches: Map, available: boolean, compared: number, skipped: number, note: string }}
 */
export async function runVisualMatch(videos, product) {
  if (config.providerMode === 'mock') {
    const matches = mockVisual(videos, product);
    return { matches, available: true, compared: matches.size, skipped: 0, note: 'Sample mode: visual scores are simulated.' };
  }
  const ref = productImageBlock(product);
  if (!config.anthropic.apiKey || !ref) {
    return { matches: new Map(), available: false, compared: 0, skipped: videos.length, note: !ref ? 'No product image, so only text matching was used.' : 'No ANTHROPIC_API_KEY, so only text matching was used.' };
  }

  const matches = new Map();
  const refKey = productImageKey(product);
  const todo = [];
  let skipped = 0;
  for (const v of videos) {
    if (!v.thumbnail) { skipped++; continue; }
    const hit = cache.get(`${refKey}|${v.thumbnail}`);
    if (hit) matches.set(idKey(v), hit);
    else if (todo.length < config.maxVisualVideos) todo.push(v);
    else skipped++;
  }

  const batches = [];
  for (let i = 0; i < todo.length; i += config.visualBatchSize) batches.push(todo.slice(i, i + config.visualBatchSize));
  let failedBatches = 0;
  await pool(batches, 3, async (batch) => {
    try {
      const arr = await callBatch(ref, batch);
      for (const row of arr) {
        const v = batch[Number(row.index)];
        if (!v) continue;
        const m = { score: clamp(row.score), reason: String(row.reason || '').slice(0, 140) };
        cache.set(`${refKey}|${v.thumbnail}`, m);
        matches.set(idKey(v), m);
      }
    } catch (err) {
      failedBatches++;
      logger.warn({ err: err.message, size: batch.length }, 'visual match batch failed');
    }
  });
  skipped += todo.filter((v) => !matches.has(idKey(v))).length;
  const note = skipped
    ? `Visual check ran on ${matches.size} of ${videos.length} videos; the rest had no usable thumbnail${failedBatches ? ' or the vision call failed' : ''} and use text matching only.`
    : `Visual check ran on all ${matches.size} videos.`;
  return { matches, available: matches.size > 0, compared: matches.size, skipped, note };
}
