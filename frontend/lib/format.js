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
  const head = ['source', 'match_score', 'creator', 'caption', 'url', 'likes', 'comments', 'views', 'posted_at'];
  const rows = videos.map((v) => [v.source, v.matchScore, v.author, v.caption || v.title, v.url, v.likes, v.comments, v.views, v.postedAt]);
  const csv = [head, ...rows].map((r) => r.map(cell).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'videos'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
