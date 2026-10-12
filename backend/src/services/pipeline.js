import { config } from '../config.js';
import { logger } from '../logger.js';
import { AppError } from '../errors.js';
import { canonicalUrl, normalizeCaption } from '../utils/text.js';
import { resolveProduct } from './productResolver.js';
import { runImageBrain } from './imageBrain.js';
import { dedupe, idKey } from './dedup.js';
import { scoreAll } from './scoring.js';
import { instagram } from '../collectors/instagram.js';
import { metaAds } from '../collectors/metaAds.js';
import { tiktok } from '../collectors/tiktok.js';

export const COLLECTORS = { instagram, meta_ads: metaAds, tiktok };

export function productKeyFor(product) {
  return product.sourceUrl ? `link:${canonicalUrl(product.sourceUrl)}` : `name:${normalizeCaption(product.title)}`;
}

/** Pull pages for one source until `min` unseen videos exist (or pages / data run out). */
export async function collectSource(collector, ctx) {
  const { queries, hashtags, productKey, db, seen, min, maxPages } = ctx;
  let cursor = db.getCursor(productKey, collector.id);
  let pool = [];
  let result = { fresh: [], droppedSeen: 0, droppedDuplicate: 0 };
  let pages = 0;
  let error = null;
  while (result.fresh.length < min && pages < maxPages) {
    try {
      const page = await collector.collectPage({ queries, hashtags, cursor });
      pages++;
      pool = pool.concat(page.items);
      cursor = page.nextCursor;
      result = dedupe(pool, seen);
      if (!cursor) break;
    } catch (err) {
      error = err.rateLimited ? `${collector.id} rate limit reached, try again later.` : err.message;
      logger.warn({ source: collector.id, err: err.message }, 'collector failed');
      break;
    }
  }
  db.setCursor(productKey, collector.id, cursor);
  return { ...result, pages, error };
}

export async function runSearch({ input, sources }, deps) {
  const { db, collectors = COLLECTORS, resolve = resolveProduct, brainFn = runImageBrain } = deps;
  const started = Date.now();
  const enabled = Object.entries(sources).filter(([, on]) => on).map(([k]) => k);
  if (!enabled.length) throw new AppError(400, 'NO_SOURCES', 'Turn on at least one video source.');
  if (enabled.includes('tiktok') && !config.tiktok.enabled) {
    throw new AppError(400, 'TIKTOK_DISABLED', 'TikTok is switched off on the server (TIKTOK_ENABLED=false).');
  }

  const product = await resolve(input);
  const brain = await brainFn(product);
  const productKey = productKeyFor(product);
  const seen = db.getSeen(productKey);
  const log = logger.child({ productKey, sources: enabled });
  log.info({ kind: product.kind, brain: brain.source }, 'search started');

  const settled = await Promise.all(
    enabled.map(async (id) => {
      const out = await collectSource(collectors[id], {
        queries: brain.queries[id]?.length ? brain.queries[id] : [product.title],
        hashtags: brain.hashtags,
        productKey, db, seen, min: config.minPerSource, maxPages: config.maxPages,
      });
      return [id, out];
    }),
  );

  const results = {};
  const stats = {};
  const warnings = [];
  const allFresh = [];
  for (const [id, out] of settled) {
    results[id] = scoreAll(out.fresh, product, brain);
    stats[id] = { count: out.fresh.length, pages: out.pages, droppedSeen: out.droppedSeen, droppedDuplicate: out.droppedDuplicate, error: out.error };
    if (out.error) warnings.push(`${id}: ${out.error}`);
    else if (out.fresh.length < config.minPerSource) warnings.push(`${id}: only ${out.fresh.length} new videos found (minimum is ${config.minPerSource}).`);
    allFresh.push(...results[id]);
  }

  db.markSeen(productKey, allFresh.map(idKey));
  const counts = Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, v.count]));
  const payload = { product, brain, results, stats, warnings, providerMode: config.providerMode };
  const id = db.saveSearch({ productKey, input, title: product.title, counts, payload });
  log.info({ counts, ms: Date.now() - started }, 'search finished');
  return { id, ...payload };
}
