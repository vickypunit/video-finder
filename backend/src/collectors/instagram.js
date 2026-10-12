import { config } from '../config.js';
import { mockPage } from './mock.js';

const GRAPH = 'https://graph.facebook.com/v21.0';
const hashtagCache = new Map();

async function graph(path, params) {
  const url = new URL(`${GRAPH}${path}`);
  Object.entries({ ...params, access_token: config.instagram.token }).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (res.status === 429 || res.status === 400 || res.status === 403) {
    const body = await res.json().catch(() => ({}));
    // 4, 17, 32, 613 = Graph API rate limit codes
    const err = new Error(body?.error?.message || `Instagram API ${res.status}`);
    err.rateLimited = [4, 17, 32, 613].includes(body?.error?.code);
    throw err;
  }
  if (!res.ok) throw new Error(`Instagram API ${res.status}`);
  return res.json();
}

const toHashtag = (q) => q.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Official Instagram Graph API hashtag search (recent_media). Reels show up as media_type VIDEO.
 * Cursor = JSON { t: tagIndex, a: afterCursor }.
 */
export const instagram = {
  id: 'instagram',
  async collectPage({ queries, hashtags = [], cursor }) {
    const tags = [...new Set([...hashtags, ...queries].map(toHashtag).filter(Boolean))].slice(0, 6);
    if (config.providerMode === 'mock') return mockPage('instagram', queries, cursor);
    if (!config.instagram.token || !config.instagram.userId) throw new Error('Instagram credentials are not configured.');

    const state = cursor ? JSON.parse(cursor) : { t: 0, a: null };
    while (state.t < tags.length) {
      const tag = tags[state.t];
      if (!hashtagCache.has(tag)) {
        const found = await graph('/ig_hashtag_search', { user_id: config.instagram.userId, q: tag });
        hashtagCache.set(tag, found.data?.[0]?.id || null);
      }
      const hid = hashtagCache.get(tag);
      if (!hid) { state.t++; state.a = null; continue; }
      const page = await graph(`/${hid}/recent_media`, {
        user_id: config.instagram.userId,
        fields: 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count',
        limit: 50,
        ...(state.a ? { after: state.a } : {}),
      });
      const next = page.paging?.cursors?.after && page.paging?.next ? page.paging.cursors.after : null;
      const items = (page.data || [])
        .filter((m) => m.media_type === 'VIDEO')
        .map((m) => ({
          id: m.id, source: 'instagram', url: m.permalink, title: '', caption: m.caption || '', author: '',
          thumbnail: null, hashtags: [], likes: m.like_count || 0, comments: m.comments_count || 0, views: 0, postedAt: m.timestamp,
        }));
      const nextState = next ? { t: state.t, a: next } : { t: state.t + 1, a: null };
      return { items, nextCursor: nextState.t >= tags.length ? null : JSON.stringify(nextState) };
    }
    return { items: [], nextCursor: null };
  },
};
