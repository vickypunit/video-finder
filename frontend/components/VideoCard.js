const SOURCE_LABEL = { instagram: 'Instagram Reel', meta_ads: 'Meta ad', tiktok: 'TikTok' };
const PARTS = [
  ['keywords', 'Keywords'],
  ['phrase', 'Product name'],
  ['hashtags', 'Hashtags'],
  ['attributes', 'Attributes'],
  ['quality', 'Engagement'],
];

const compact = (n) => new Intl.NumberFormat('en', { notation: 'compact' }).format(n || 0);
const tier = (s) => (s >= 65 ? 'good' : s >= 35 ? 'mid' : 'bad');
const safeHref = (u) => (/^https?:\/\//i.test(u || '') ? u : null);

export default function VideoCard({ video }) {
  const href = safeHref(video.url);
  const t = tier(video.matchScore);
  const b = video.scoreBreakdown || {};
  const tip = PARTS.map(([k, l]) => `${l}: ${b[k] ?? 0}`).join(' | ');

  return (
    <article className={`card src-${video.source}`}>
      <div className="card-head">
        <div className={`score ${t}`} title={tip}>
          <span className="score-num">{video.matchScore}</span>
          <span className="score-cap">match</span>
        </div>
        <div className="card-meta">
          <span className="src">{SOURCE_LABEL[video.source]}</span>
          {video.mock && <span className="mock">sample data</span>}
        </div>
      </div>

      <div className="bar" role="img" aria-label={`Score breakdown. ${tip}`}>
        {PARTS.map(([k]) => (
          <i key={k} className={`seg seg-${k}`} style={{ width: `${b[k] ?? 0}%` }} />
        ))}
      </div>

      <p className="caption">{video.caption || video.title || 'No caption'}</p>

      <div className="card-foot">
        <span className="who">{video.author ? `@${video.author}` : 'Unknown creator'}</span>
        <span className="stats">
          {compact(video.likes)} likes{video.views ? `, ${compact(video.views)} views` : ''}
        </span>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="open">Open video</a>
        ) : (
          <span className="open off">No link</span>
        )}
      </div>
    </article>
  );
}
