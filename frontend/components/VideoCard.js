import { compact, safeHref } from '../lib/format';
import { Flags, ScorePill, SourceBadge, Thumb } from './VideoTable';

export default function VideoCard({ video, onSelect }) {
  const href = safeHref(video.url);
  return (
    <article className={video.lowMatch ? 'vcard dim' : 'vcard'} onClick={() => onSelect(video)}>
      <Thumb video={video} className="vthumb" />
      <div className="vcard-top"><ScorePill score={video.matchScore} /><SourceBadge source={video.source} /><Flags video={video} /></div>
      <button className="vcard-cap" onClick={(e) => { e.stopPropagation(); onSelect(video); }}>{video.caption || video.title || 'No caption'}</button>
      {video.matchReason && <p className="why">{video.matchReason}</p>}
      <div className="vcard-foot">
        <span className="muted small">{video.author ? `@${video.author}` : 'Unknown creator'}, {compact(video.likes)} likes</span>
        {href && !video.mock && <a className="btn-sm" href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Open</a>}
        {href && video.mock && <span className="btn-sm disabled" title="Sample data has no real link">Open</span>}
      </div>
    </article>
  );
}
