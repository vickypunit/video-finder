import * as cheerio from 'cheerio';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { safeFetchHtml } from '../utils/safeFetch.js';
import { TtlCache } from '../utils/cache.js';

/**
 * OPTIONAL, best effort (ENRICH_THUMBNAILS=true). The Instagram hashtag API does not return a
 * thumbnail for Reels, so we try the public og:image of the permalink. Only instagram.com is
 * allowed, concurrency is low and misses are cached. Turn it off if you are not comfortable with
 * the platform's terms; visual scoring then only runs for videos that already have a thumbnail.
 */
const ALLOWED = /(^|\.)instagram\.com$/i;
const cache = new TtlCache({ max: 2000, ttlMs: 24 * 60 * 60 * 1000 });

async function lookup(url) {
  const hit = cache.get(url);
  if (hit !== undefined) return hit;
  let img = null;
  try {
    if (!ALLOWED.test(new URL(url).hostname)) return null;
    const { html } = await safeFetchHtml(url);
    img = cheerio.load(html)('meta[property="og:image"]').attr('content') || null;
  } catch (err) {
    logger.debug({ err: err.message }, 'thumbnail lookup failed');
  }
  cache.set(url, img);
  return img;
}

export async function enrichThumbnails(videos, { limit = 40, concurrency = 3 } = {}) {
  if (!config.enrichThumbnails || config.providerMode === 'mock') return 0;
  const todo = videos.filter((v) => !v.thumbnail && v.url && v.source === 'instagram').slice(0, limit);
  let found = 0;
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, async () => {
    while (i < todo.length) {
      const v = todo[i++];
      const img = await lookup(v.url);
      if (img) { v.thumbnail = img; found++; }
    }
  }));
  return found;
}
