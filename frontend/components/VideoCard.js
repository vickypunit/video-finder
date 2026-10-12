import { compact, safeHref } from '../lib/format';
import { ScorePill, SourceBadge } from './VideoTable';

export default function VideoCard({ video, onSelect }) {
  const href = safeHref(video.url);
  return (
    <article className="vcard" onClick={() => onSelect(video)}>
      <div className="vcard-top"><ScorePill score={video.matchScore} /><SourceBadge source={video.source} /></div>
      <button className="vcard-cap" onClick={(e) => { e.stopPropagation(); onSelect(video); }}>{video.caption || video.title || 'No caption'}</button>
      <div className="vcard-foot">
        <span className="muted small">{video.author ? `@${video.author}` : 'Unknown creator'}, {compact(video.likes)} likes</span>
        {href && <a className="btn-sm" href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Open</a>}
      </div>
    </article>
  );
}
