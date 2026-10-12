import * as cheerio from 'cheerio';
import { safeFetchHtml } from '../utils/safeFetch.js';
import { assertSafeUrl } from '../utils/urlGuard.js';
import { AppError } from '../errors.js';

const clean = (s) => (s ? String(s).replace(/\s+/g, ' ').trim() : '');

export function looksLikeUrl(input) {
  return /^https?:\/\//i.test(input.trim());
}

function fromJsonLd($) {
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    try {
      const data = JSON.parse($(el).contents().text());
      const nodes = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
      const product = nodes.find((n) => n && [].concat(n['@type'] || []).includes('Product'));
      if (product) {
        const img = Array.isArray(product.image) ? product.image[0] : product.image;
        return {
          title: clean(product.name),
          description: clean(product.description),
          image: typeof img === 'string' ? img : img?.url,
          brand: clean(product.brand?.name || product.brand),
        };
      }
    } catch {
      /* ignore malformed JSON-LD */
    }
  }
  return {};
}

export function parseProductHtml(html, baseUrl) {
  const $ = cheerio.load(html);
  const meta = (n) => $(`meta[property="${n}"], meta[name="${n}"]`).attr('content');
  const ld = fromJsonLd($);
  const title = clean(ld.title || meta('og:title') || meta('twitter:title') || $('title').first().text());
  const description = clean(ld.description || meta('og:description') || meta('description'));
  let image = ld.image || meta('og:image') || meta('twitter:image') || $('img').first().attr('src');
  if (image) {
    try {
      image = new URL(image, baseUrl).toString();
    } catch {
      image = null;
    }
  }
  return { title, description, imageUrl: image || null, brand: ld.brand || clean(meta('og:site_name')) };
}

/** Turns "product name or link" into { title, description, imageUrl, sourceUrl }. */
export async function resolveProduct(input) {
  const raw = input.trim();
  if (!looksLikeUrl(raw)) {
    return { kind: 'name', title: raw, description: '', imageUrl: null, brand: '', sourceUrl: null };
  }
  const { html, finalUrl } = await safeFetchHtml(raw);
  const parsed = parseProductHtml(html, finalUrl);
  if (!parsed.title) throw new AppError(422, 'NO_PRODUCT_INFO', 'Could not find a product title on that page.');
  // the image is sent to the vision model, so it must pass the same URL checks
  if (parsed.imageUrl) {
    try {
      await assertSafeUrl(parsed.imageUrl);
    } catch {
      parsed.imageUrl = null;
    }
  }
  return { kind: 'link', ...parsed, sourceUrl: finalUrl };
}
