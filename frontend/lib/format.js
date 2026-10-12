export const SOURCES = {
  instagram: { label: 'Instagram Reels', short: 'Instagram', color: '#d6336c' },
  meta_ads: { label: 'Meta Ad Library', short: 'Meta ads', color: '#1877f2' },
  tiktok: { label: 'TikTok', short: 'TikTok', color: '#111827' },
};

// [key, label, max points] - mirrors backend/src/services/scoring.js
export const PARTS = [
  ['keywords', 'Keyword coverage', 45],
  ['phrase', 'Product name mention', 20],
  ['hashtags', 'Hashtag overlap', 15],
  ['attributes', 'Attribute hits', 10],
  ['quality', 'Engagement and recency', 10],
];
// used when a thumbnail was compared with the product photo
export const PARTS_VISUAL = [
  ['visual', 'Visual match (photo vs thumbnail)', 40],
  ['keywords', 'Keyword coverage', 25],
  ['phrase', 'Product name mention', 10],
  ['hashtags', 'Hashtag overlap', 10],
  ['attributes', 'Attribute hits', 5],
  ['quality', 'Engagement and recency', 10],
];

/** Embeddable player URL for sources that allow it. Meta ad snapshots block framing, so those only link out. */
export function embedUrl(v) {
  try {
    const u = new URL(v.url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'instagram.com') {
      const m = u.pathname.match(/^\/(reel|reels|p|tv)\/([\w-]+)/);
      return m ? `https://www.instagram.com/${m[1] === 'reels' ? 'reel' : m[1]}/${m[2]}/embed` : null;
    }
    if (host === 'tiktok.com' && v.id && /^\d+$/.test(String(v.id))) return `https://www.tiktok.com/embed/v2/${v.id}`;
  } catch { /* not a URL */ }
  return null;
}

export const compact = (n) => new Intl.NumberFormat('en', { notation: 'compact' }).format(n || 0);
export const tier = (s) => (s >= 65 ? 'good' : s >= 35 ? 'mid' : 'bad');
export const safeHref = (u) => (/^https?:\/\//i.test(u || '') ? u : null);

export function timeAgo(iso) {
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (!iso || Number.isNaN(d)) return '-';
  if (d < 1) return 'today';
  if (d < 30) return `${Math.floor(d)}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

// CSV cells starting with = + - @ are prefixed so spreadsheets never run them as formulas.
const cell = (v) => {
  let s = String(v ?? '').replace(/\r?\n/g, ' ');
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export function downloadCsv(videos, name) {
  const head = ['source', 'match_score', 'visual_score', 'low_match', 'previously_seen', 'why', 'creator', 'caption', 'url', 'likes', 'comments', 'views', 'posted_at'];
  const rows = videos.map((v) => [v.source, v.matchScore, v.visualScore ?? '', v.lowMatch ? 'yes' : 'no', v.previouslySeen ? 'yes' : 'no', v.matchReason, v.author, v.caption || v.title, v.url, v.likes, v.comments, v.views, v.postedAt]);
  const csv = [head, ...rows].map((r) => r.map(cell).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'videos'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
