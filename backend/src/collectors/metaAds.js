import { config } from '../config.js';
import { mockPage } from './mock.js';

/** Strip the access_token Meta embeds in ad_snapshot_url before it goes anywhere near a browser. */
export function cleanSnapshotUrl(u) {
  try {
    const x = new URL(u);
    x.searchParams.delete('access_token');
    return x.toString();
  } catch {
    return '';
  }
}

/**
 * Meta Ad Library API (ads_archive). Cursor = the `after` paging cursor.
 * Note: the API returns a snapshot page for each ad, not a raw video file.
 */
export const metaAds = {
  id: 'meta_ads',
  async collectPage({ queries, cursor }) {
    if (config.providerMode === 'mock') return mockPage('meta_ads', queries, cursor);
    if (!config.meta.token) throw Object.assign(new Error('Meta Ad Library token is not configured.'), { noRetry: true });
    const url = new URL('https://graph.facebook.com/v21.0/ads_archive');
    url.searchParams.set('search_terms', queries[0]);
    url.searchParams.set('ad_reached_countries', JSON.stringify(config.meta.countries));
    url.searchParams.set('ad_active_status', 'ACTIVE');
    url.searchParams.set('ad_type', 'ALL');
    url.searchParams.set('limit', '50');
    url.searchParams.set('fields', 'id,page_name,ad_creative_bodies,ad_creative_link_titles,ad_snapshot_url,ad_delivery_start_time');
    url.searchParams.set('access_token', config.meta.token);
    if (cursor) url.searchParams.set('after', cursor);
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(body?.error?.message || `Meta Ad Library API ${res.status}`);
      err.status = res.status;
      err.rateLimited = res.status === 429 || [4, 17, 32, 613].includes(body?.error?.code);
      if (res.status < 500) err.noRetry = true;
      throw err;
    }
    const data = await res.json();
    const items = (data.data || []).map((a) => ({
      id: a.id, source: 'meta_ads', url: cleanSnapshotUrl(a.ad_snapshot_url),
      title: (a.ad_creative_link_titles || [])[0] || '', caption: (a.ad_creative_bodies || [])[0] || '',
      author: a.page_name || '', thumbnail: null, hashtags: [], likes: 0, comments: 0, views: 0, postedAt: a.ad_delivery_start_time,
    }));
    return { items, nextCursor: data.paging?.next ? data.paging.cursors?.after : null };
  },
};
