import { canonicalUrl, normalizeCaption } from '../utils/text.js';
import crypto from 'node:crypto';

export const idKey = (v) => `${v.source}:${v.id}`;

/** Fingerprint to catch reposts: same author + same normalised caption start. */
export function fingerprint(v) {
  const base = `${(v.author || '').toLowerCase()}|${normalizeCaption(v.caption).slice(0, 120)}`;
  return base.length > 3 ? crypto.createHash('sha1').update(base).digest('hex') : null;
}

/**
 * Removes (a) videos already seen in earlier searches and (b) duplicates inside this batch
 * (same id, same canonical URL, or same fingerprint).
 * Returns { fresh, droppedSeen, droppedDuplicate }.
 */
export function dedupe(videos, seenIds = new Set()) {
  const ids = new Set();
  const urls = new Set();
  const prints = new Set();
  const fresh = [];
  let droppedSeen = 0;
  let droppedDuplicate = 0;
  for (const v of videos) {
    if (seenIds.has(idKey(v))) {
      droppedSeen++;
      continue;
    }
    const url = canonicalUrl(v.url);
    const fp = fingerprint(v);
    if (ids.has(idKey(v)) || (url && urls.has(url)) || (fp && prints.has(fp))) {
      droppedDuplicate++;
      continue;
    }
    ids.add(idKey(v));
    if (url) urls.add(url);
    if (fp) prints.add(fp);
    fresh.push(v);
  }
  return { fresh, droppedSeen, droppedDuplicate };
}
