import { config } from '../config.js';
import { logger } from '../logger.js';
import { tokenize } from '../utils/text.js';
import { TtlCache } from '../utils/cache.js';
import { productImageBlock, productImageKey } from '../utils/image.js';
import crypto from 'node:crypto';

const brainCache = new TtlCache({ max: 200, ttlMs: config.cacheTtlMs });
export const clearBrainCache = () => brainCache.clear();

const SYSTEM = `You help find short-form videos about a specific product.
Given a product title, description and (optionally) its main image, return ONLY JSON:
{
 "product_name": string,           // short product name as a shopper would search it, e.g. "oversized graphic tee"
 "summary": string,                // one sentence on what is visible: type, colours, prints/logos, material, shape
 "category": string,
 "attributes": { "color": string[], "material": string[], "style": string[], "shape": string[], "use_case": string[], "brand": string },
 "keywords": string[],            // 6-12 distinctive words a video caption about this product would contain
 "hashtags": string[],            // 5-10 hashtags without '#', specific first, generic last
 "queries": { "instagram": string[], "meta_ads": string[], "tiktok": string[] }  // 3-5 short queries each
}
Only describe attributes that are visible in the image or stated in the text. No markdown.`;

/** Cheap fallback when no API key is configured. */
export function heuristicBrain(product) {
  const words = [...new Set(tokenize(`${product.title} ${product.description}`))];
  const core = words.slice(0, 4).join(' ');
  const tags = words.slice(0, 6);
  return {
    source: 'heuristic',
    productName: product.title || '',
    summary: '',
    category: '',
    attributes: { color: [], material: [], style: [], shape: [], use_case: [], brand: product.brand || '' },
    keywords: words.slice(0, 12),
    hashtags: tags,
    queries: {
      instagram: [core, ...tags.slice(0, 2)].filter(Boolean),
      meta_ads: [core, product.title].filter(Boolean),
      tiktok: [core].filter(Boolean),
    },
  };
}

function normalizeBrain(raw, product) {
  const fb = heuristicBrain(product);
  const arr = (v) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
  return {
    source: 'vision',
    productName: String(raw.product_name || product.title || ''),
    summary: String(raw.summary || ''),
    category: String(raw.category || ''),
    attributes: {
      color: arr(raw.attributes?.color),
      material: arr(raw.attributes?.material),
      style: arr(raw.attributes?.style),
      shape: arr(raw.attributes?.shape),
      use_case: arr(raw.attributes?.use_case),
      brand: String(raw.attributes?.brand || product.brand || ''),
    },
    keywords: arr(raw.keywords).length ? arr(raw.keywords) : fb.keywords,
    hashtags: arr(raw.hashtags).map((h) => h.replace(/^#/, '').replace(/\s+/g, '').toLowerCase()),
    queries: {
      instagram: arr(raw.queries?.instagram).length ? arr(raw.queries.instagram) : fb.queries.instagram,
      meta_ads: arr(raw.queries?.meta_ads).length ? arr(raw.queries.meta_ads) : fb.queries.meta_ads,
      tiktok: arr(raw.queries?.tiktok).length ? arr(raw.queries.tiktok) : fb.queries.tiktok,
    },
  };
}

export async function runImageBrain(product) {
  if (!config.anthropic.apiKey) return heuristicBrain(product);
  const key = crypto
    .createHash('sha1')
    .update([product.title, product.brand, product.description, productImageKey(product)].join('|'))
    .digest('hex');
  // Same product link / image is analysed once, repeat searches reuse it.
  const out = await brainCache.getOrSet(key, () => callVision(product));
  if (out.degraded) brainCache.delete(key);
  return out;
}

async function callVision(product) {
  const content = [];
  const img = productImageBlock(product);
  if (img) content.push(img);
  content.push({
    type: 'text',
    text: `Title: ${product.title || 'unknown (identify it from the image)'}\nBrand: ${product.brand || 'unknown'}\nDescription: ${product.description || 'none'}`,
  });
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(30000),
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.anthropic.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: config.anthropic.model, max_tokens: 1000, system: SYSTEM, messages: [{ role: 'user', content }] }),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
    const data = await res.json();
    const text = data.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    return normalizeBrain(JSON.parse(text.replace(/```json|```/g, '').trim()), product);
  } catch (err) {
    // Never fail the whole search because the brain is down: degrade to the heuristic (and do not cache it).
    logger.warn({ err: err.message }, 'image brain failed, using heuristic');
    const fb = heuristicBrain(product);
    fb.degraded = true;
    return fb;
  }
}
