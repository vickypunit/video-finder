import { tokenize } from '../utils/text.js';
import { idKey } from './dedup.js';

/**
 * Match score 0-100. Pure function so it is easy to test.
 *
 * Text only (no thumbnail / no vision key):
 *   45 keyword coverage, 20 product phrase / brand, 15 hashtags, 10 attributes, 10 quality
 * With a visual comparison (product photo vs video thumbnail):
 *   40 visual, 25 keywords, 10 phrase / brand, 10 hashtags, 5 attributes, 10 quality
 */
export const WEIGHTS = { keywords: 45, phrase: 20, hashtags: 15, attributes: 10, quality: 10 };
export const WEIGHTS_VISUAL = { visual: 40, keywords: 25, phrase: 10, hashtags: 10, attributes: 5, quality: 10 };

const ratio = (hit, total) => (total === 0 ? 0 : Math.min(1, hit / total));

export function scoreVideo(video, product, brain, now = Date.now(), visual = null) {
  const hasVisual = visual && Number.isFinite(visual.score);
  const W = hasVisual ? WEIGHTS_VISUAL : WEIGHTS;

  const text = `${video.caption || ''} ${video.title || ''}`.toLowerCase();
  const textTokens = new Set(tokenize(text));
  const tags = new Set((video.hashtags || []).map((h) => h.toLowerCase().replace(/^#/, '')).concat(
    [...text.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1]),
  ));

  const wanted = [...new Set([...(brain.keywords || []).flatMap(tokenize), ...tokenize(product.title)])];
  const kwTotal = Math.min(wanted.length, 8);
  const kwHits = wanted.filter((t) => textTokens.has(t)).length;
  const kw = ratio(kwHits, kwTotal);

  const title = (product.title || '').toLowerCase();
  const brand = (brain.attributes?.brand || product.brand || '').toLowerCase();
  const exact = title && text.includes(title);
  const phrase = exact ? 1 : brand && text.includes(brand) ? 0.5 : 0;

  const brainTags = (brain.hashtags || []).map((h) => h.toLowerCase());
  const tagHits = brainTags.filter((h) => tags.has(h));
  const tg = ratio(tagHits.length, Math.min(brainTags.length, 3));

  const attrValues = ['color', 'material', 'style', 'shape', 'use_case']
    .flatMap((k) => brain.attributes?.[k] || [])
    .map((a) => a.toLowerCase());
  const attrHits = attrValues.filter((a) => text.includes(a));
  const at = ratio(attrHits.length, Math.min(attrValues.length, 3));

  const eng = Math.log10(1 + (video.likes || 0) + 3 * (video.comments || 0) + 0.1 * (video.views || 0));
  const engagement = Math.min(1, eng / 5);
  const ageDays = video.postedAt ? (now - new Date(video.postedAt).getTime()) / 86400000 : 365;
  const recency = ageDays <= 30 ? 1 : ageDays <= 180 ? 0.6 : ageDays <= 365 ? 0.3 : 0.1;
  const quality = engagement * 0.5 + recency * 0.5;

  const breakdown = {
    ...(hasVisual ? { visual: Math.round((visual.score / 100) * W.visual) } : {}),
    keywords: Math.round(kw * W.keywords),
    phrase: Math.round(phrase * W.phrase),
    hashtags: Math.round(tg * W.hashtags),
    attributes: Math.round(at * W.attributes),
    quality: Math.round(quality * W.quality),
  };
  const score = Math.max(0, Math.min(100, Object.values(breakdown).reduce((a, b) => a + b, 0)));

  // Human readable "why" shown in the UI.
  const parts = [];
  if (hasVisual) parts.push(`Visual ${Math.round(visual.score)}/100${visual.reason ? `: ${visual.reason}` : ''}`);
  else if (video.thumbnail === null || video.thumbnail === undefined) parts.push('No thumbnail, text match only');
  parts.push(
    kwTotal ? `caption has ${kwHits} of ${kwTotal} product keywords` : 'no product keywords to compare',
  );
  if (exact) parts.push('product name appears in caption');
  else if (phrase) parts.push('brand is mentioned');
  if (tagHits.length) parts.push(`hashtags: ${tagHits.slice(0, 3).map((h) => `#${h}`).join(' ')}`);
  if (attrHits.length) parts.push(`matches ${attrHits.slice(0, 3).join(', ')}`);
  const cap = (t) => t.replace(/[.\s]+$/, '').replace(/^./, (c) => c.toUpperCase());
  const reason = `${parts.map(cap).join('. ')}.`;

  return { score, breakdown, reason };
}

/** @param visualMap Map<idKey, {score, reason}> from services/visualMatch.js (optional) */
export function scoreAll(videos, product, brain, visualMap = new Map(), threshold = 0) {
  return videos
    .map((v) => {
      const visual = visualMap.get(idKey(v)) || null;
      const { score, breakdown, reason } = scoreVideo(v, product, brain, Date.now(), visual);
      return { ...v, matchScore: score, scoreBreakdown: breakdown, matchReason: reason, visualScore: visual ? visual.score : null, lowMatch: score < threshold };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}
