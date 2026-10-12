import { tokenize } from '../utils/text.js';

/**
 * Match score 0-100. Pure function so it is easy to test.
 *   45  caption/title keyword coverage (brain keywords + product title tokens)
 *   20  exact product phrase / brand mention
 *   15  hashtag overlap
 *   10  attribute hits (colour, material, style ...)
 *   10  quality signal (engagement and recency)
 */
export const WEIGHTS = { keywords: 45, phrase: 20, hashtags: 15, attributes: 10, quality: 10 };

const ratio = (hit, total) => (total === 0 ? 0 : Math.min(1, hit / total));

export function scoreVideo(video, product, brain, now = Date.now()) {
  const text = `${video.caption || ''} ${video.title || ''}`.toLowerCase();
  const textTokens = new Set(tokenize(text));
  const tags = new Set((video.hashtags || []).map((h) => h.toLowerCase().replace(/^#/, '')).concat(
    [...text.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1]),
  ));

  const wanted = [...new Set([...(brain.keywords || []).flatMap(tokenize), ...tokenize(product.title)])];
  const kw = ratio(wanted.filter((t) => textTokens.has(t)).length, Math.min(wanted.length, 8));

  const title = product.title.toLowerCase();
  const brand = (brain.attributes?.brand || product.brand || '').toLowerCase();
  const phrase = text.includes(title) ? 1 : brand && text.includes(brand) ? 0.5 : 0;

  const brainTags = (brain.hashtags || []).map((h) => h.toLowerCase());
  const tg = ratio(brainTags.filter((h) => tags.has(h)).length, Math.min(brainTags.length, 3));

  const attrValues = ['color', 'material', 'style', 'shape', 'use_case']
    .flatMap((k) => brain.attributes?.[k] || [])
    .map((a) => a.toLowerCase());
  const at = ratio(attrValues.filter((a) => text.includes(a)).length, Math.min(attrValues.length, 3));

  const eng = Math.log10(1 + (video.likes || 0) + 3 * (video.comments || 0) + 0.1 * (video.views || 0));
  const engagement = Math.min(1, eng / 5);
  const ageDays = video.postedAt ? (now - new Date(video.postedAt).getTime()) / 86400000 : 365;
  const recency = ageDays <= 30 ? 1 : ageDays <= 180 ? 0.6 : ageDays <= 365 ? 0.3 : 0.1;
  const quality = engagement * 0.5 + recency * 0.5;

  const breakdown = {
    keywords: Math.round(kw * WEIGHTS.keywords),
    phrase: Math.round(phrase * WEIGHTS.phrase),
    hashtags: Math.round(tg * WEIGHTS.hashtags),
    attributes: Math.round(at * WEIGHTS.attributes),
    quality: Math.round(quality * WEIGHTS.quality),
  };
  const score = Math.max(0, Math.min(100, Object.values(breakdown).reduce((a, b) => a + b, 0)));
  return { score, breakdown };
}

export function scoreAll(videos, product, brain) {
  return videos
    .map((v) => ({ ...v, ...(({ score, breakdown }) => ({ matchScore: score, scoreBreakdown: breakdown }))(scoreVideo(v, product, brain)) }))
    .sort((a, b) => b.matchScore - a.matchScore);
}
