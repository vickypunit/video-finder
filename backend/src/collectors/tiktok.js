import { config } from '../config.js';
import { mockPage } from './mock.js';

const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');

/**
 * OPTIONAL. Uses the official TikTok Research API (requires approved access).
 * Cursor = JSON { c: cursor, s: search_id }.
 */
export const tiktok = {
  id: 'tiktok',
  async collectPage({ queries, cursor }) {
    if (config.providerMode === 'mock') return mockPage('tiktok', queries, cursor);
    if (!config.tiktok.token) throw new Error('TikTok token is not configured.');
    const st = cursor ? JSON.parse(cursor) : {};
    const now = new Date();
    const res = await fetch(
      'https://open.tiktokapis.com/v2/research/video/query/?fields=id,video_description,create_time,like_count,comment_count,view_count,username,hashtag_names',
      {
        method: 'POST',
        signal: AbortSignal.timeout(20000),
        headers: { authorization: `Bearer ${config.tiktok.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          query: { and: [{ operation: 'IN', field_name: 'keyword', field_values: [queries[0]] }] },
          start_date: fmt(new Date(now - 29 * 86400000)),
          end_date: fmt(now),
          max_count: 100,
          ...(st.c ? { cursor: st.c, search_id: st.s } : {}),
        }),
      },
    );
    if (!res.ok) throw new Error(`TikTok API ${res.status}`);
    const { data } = await res.json();
    const items = (data?.videos || []).map((v) => ({
      id: String(v.id), source: 'tiktok', url: `https://www.tiktok.com/@${v.username}/video/${v.id}`, title: '',
      caption: v.video_description || '', author: v.username, thumbnail: null, hashtags: v.hashtag_names || [],
      likes: v.like_count || 0, comments: v.comment_count || 0, views: v.view_count || 0,
      postedAt: new Date(v.create_time * 1000).toISOString(),
    }));
    return { items, nextCursor: data?.has_more ? JSON.stringify({ c: data.cursor, s: data.search_id }) : null };
  },
};
