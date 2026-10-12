import { assertSafeUrl } from './urlGuard.js';
import { AppError } from '../errors.js';

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 4;

/** Fetch HTML from a public URL. Re-validates every redirect hop, caps size and time. */
export async function safeFetchHtml(rawUrl, { timeoutMs = 8000 } = {}) {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertSafeUrl(current);
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': 'VideoFinderBot/1.0 (+product research)', accept: 'text/html,application/xhtml+xml' },
    }).catch((e) => {
      throw new AppError(502, 'FETCH_FAILED', `Could not fetch the product page (${e.name}).`);
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location'), url).toString();
      continue;
    }
    if (!res.ok) throw new AppError(502, 'FETCH_FAILED', `Product page returned HTTP ${res.status}.`);
    const type = res.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml/.test(type)) {
      throw new AppError(422, 'NOT_HTML', 'That link is not a web page.');
    }
    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BYTES) {
        await reader.cancel();
        break; // truncate, head metadata is normally at the top
      }
      chunks.push(value);
    }
    return { html: Buffer.concat(chunks).toString('utf8'), finalUrl: url.toString() };
  }
  throw new AppError(502, 'TOO_MANY_REDIRECTS', 'Too many redirects.');
}
