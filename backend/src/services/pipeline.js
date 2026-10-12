import { config } from '../config.js';
import { logger } from '../logger.js';
import { AppError } from '../errors.js';
import { canonicalUrl, normalizeCaption } from '../utils/text.js';
import { withRetry, withTimeout } from '../utils/retry.js';
import { resolveProduct } from './productResolver.js';
import { runImageBrain } from './imageBrain.js';
import { dedupe, idKey } from './dedup.js';
import { scoreAll } from './scoring.js';
import { runVisualMatch } from './visualMatch.js';
import { enrichThumbnails } from './thumbnails.js';
import { parseImageDataUrl } from '../utils/image.js';
import { instagram } from '../collectors/instagram.js';
import { metaAds } from '../collectors/metaAds.js';
import { tiktok } from '../collectors/tiktok.js';

export const COLLECTORS = { instagram, meta_ads: metaAds, tiktok };
const LABEL = { instagram: 'Instagram Reels', meta_ads: 'Meta Ad Library', tiktok: 'TikTok' };

export function productKeyFor(product) {
  if (product.kind === 'image') return `image:${product.imageData?.hash}`;
  return product.sourceUrl ? `link:${canonicalUrl(product.sourceUrl)}` : `name:${normalizeCaption(product.title)}`;
}

/** Pull pages for one source until `min` unseen videos exist (or pages / data / time run out). */
export async function collectSource(collector, ctx) {
  const { queries, hashtags, productKey, db, seen, min, maxPages, onProgress } = ctx;
  const deadline = Date.now() + (ctx.sourceTimeoutMs ?? config.sourceTimeoutMs);
  let cursor = db.getCursor(productKey, collector.id);
  let pool = [];
  let result = { fresh: [], droppedSeen: 0, droppedDuplicate: 0 };
  let pages = 0;
  let retries = 0;
  let error = null;
  while (result.fresh.length < min && pages < maxPages) {
    if (Date.now() > deadline) {
      error = `${collector.id} took too long, returning what was collected so far.`;
      break;
    }
    try {
      const page = await withRetry(
        () => withTimeout(collector.collectPage({ queries, hashtags, cursor }), ctx.pageTimeoutMs ?? config.pageTimeoutMs, `${collector.id} page`),
        {
          retries: ctx.retries ?? config.collectorRetries,
          baseMs: ctx.retryBaseMs ?? 300,
          onRetry: (err, n) => { retries++; logger.warn({ source: collector.id, attempt: n, err: err.message }, 'collector retry'); },
        },
      );
      pages++;
      pool = pool.concat(page.items);
      cursor = page.nextCursor;
      result = dedupe(pool, seen);
      onProgress?.({ stage: 'searching', source: collector.id, count: result.fresh.length, message: `${LABEL[collector.id]}: ${result.fresh.length} new videos after page ${pages}` });
      if (!cursor) break;
    } catch (err) {
      error = err.rateLimited ? `${collector.id} rate limit reached, try again later.` : err.message;
      logger.warn({ source: collector.id, err: err.message }, 'collector failed');
      break;
    }
  }
  db.setCursor(productKey, collector.id, cursor);
  return { ...result, pages, retries, error };
}

async function buildProduct({ input, image }, resolve) {
  const upload = image ? parseImageDataUrl(image, config.maxUploadBytes) : null;
  let product;
  if (input && input.trim()) {
    product = await resolve(input.trim());
  } else if (upload) {
    if (!config.anthropic.apiKey) {
      throw new AppError(422, 'IMAGE_NEEDS_VISION', 'An image-only search needs ANTHROPIC_API_KEY so the image brain can identify the product. Add a name or link instead, or set the key.');
    }
    product = { kind: 'image', title: '', description: '', imageUrl: null, brand: '', sourceUrl: null };
  } else {
    throw new AppError(400, 'INVALID_INPUT', 'Enter a product name, a product link, or upload an image.');
  }
  if (upload) {
    // an uploaded photo is the most trustworthy reference, so it wins over the page image
    product.imageData = upload;
    product.imageUrl = `data:${upload.mediaType};base64,${upload.data}`;
    product.uploadedImage = true;
  }
  return product;
}

export async function runSearch({ input = '', image = null, sources }, deps) {
  const {
    db, collectors = COLLECTORS, resolve = resolveProduct, brainFn = runImageBrain,
    visualFn = runVisualMatch, onProgress = () => {},
  } = deps;
  const started = Date.now();
  const enabled = Object.entries(sources).filter(([, on]) => on).map(([k]) => k);
  if (!enabled.length) throw new AppError(400, 'NO_SOURCES', 'Turn on at least one video source.');
  if (enabled.includes('tiktok') && !config.tiktok.enabled) {
    throw new AppError(400, 'TIKTOK_DISABLED', 'TikTok is switched off on the server (TIKTOK_ENABLED=false).');
  }

  onProgress({ stage: 'resolving', message: input && /^https?:\/\//i.test(input) ? 'Fetching the product page' : 'Reading your product input' });
  const product = await buildProduct({ input, image }, resolve);

  onProgress({ stage: 'analyzing', message: 'Analysing the product image' });
  const brain = await brainFn(product);
  if (product.kind === 'image') product.title = brain.productName || 'Uploaded product';
  const productKey = productKeyFor(product);
  const seen = db.getSeen(productKey);
  const log = logger.child({ productKey, sources: enabled });
  log.info({ kind: product.kind, brain: brain.source }, 'search started');
  onProgress({ stage: 'analyzing', message: `Product understood: ${product.title}`, done: true });

  // Sources run in parallel; a failing source never breaks the others.
  const settled = await Promise.all(
    enabled.map(async (id) => {
      onProgress({ stage: 'searching', source: id, count: 0, message: `Searching ${LABEL[id]}` });
      const out = await collectSource(collectors[id], {
        queries: brain.queries[id]?.length ? brain.queries[id] : [product.title],
        hashtags: brain.hashtags,
        productKey, db, seen, min: config.minPerSource, maxPages: config.maxPages, onProgress,
      });
      return [id, out];
    }),
  );

  onProgress({ stage: 'scoring', message: 'Comparing thumbnails with the product image and scoring' });
  const fresh = settled.flatMap(([, out]) => out.fresh);
  await enrichThumbnails(fresh).catch((err) => log.warn({ err: err.message }, 'thumbnail enrichment failed'));
  let visual = { matches: new Map(), available: false, compared: 0, skipped: fresh.length, note: '' };
  try {
    visual = await visualFn(fresh, product);
  } catch (err) {
    log.warn({ err: err.message }, 'visual match failed, using text scoring only');
    visual.note = 'Visual check failed, so only text matching was used.';
  }

  const results = {};
  const stats = {};
  const warnings = [];
  const notes = [];
  const allFresh = [];
  for (const [id, out] of settled) {
    results[id] = scoreAll(out.fresh, product, brain, visual.matches, config.matchThreshold);
    const strong = results[id].filter((v) => !v.lowMatch).length;
    stats[id] = {
      count: out.fresh.length, strong, pages: out.pages, retries: out.retries,
      droppedSeen: out.droppedSeen, droppedDuplicate: out.droppedDuplicate, error: out.error,
    };
    if (out.error) warnings.push(`${id}: ${out.error}`);
    else if (out.fresh.length < config.minPerSource) warnings.push(`${id}: only ${out.fresh.length} new videos found (minimum is ${config.minPerSource}). Try a broader product name or run the search again.`);
    if (out.fresh.length && strong < out.fresh.length) notes.push(`${LABEL[id]}: ${strong} of ${out.fresh.length} are strong matches (score ${config.matchThreshold}+), the rest are flagged low match.`);
    allFresh.push(...results[id]);
  }
  if (visual.note) notes.push(visual.note);

  onProgress({ stage: 'saving', message: 'Saving search history' });
  db.markSeen(productKey, allFresh.map(idKey));
  const counts = Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, v.count]));
  const { imageData, ...publicProduct } = product; // never persist raw bytes twice
  const payload = {
    product: publicProduct, brain, results, stats, warnings, notes,
    threshold: config.matchThreshold,
    visual: { available: visual.available, compared: visual.compared, skipped: visual.skipped },
    providerMode: config.providerMode,
  };
  const id = db.saveSearch({ productKey, input: input || '(image upload)', title: product.title, counts, payload });
  log.info({ counts, ms: Date.now() - started }, 'search finished');
  onProgress({ stage: 'done', message: 'Done' });
  return { id, ...payload };
}
