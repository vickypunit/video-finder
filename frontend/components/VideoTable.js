import { SOURCES, compact, tier, safeHref, timeAgo } from '../lib/format';

export function ScorePill({ score }) {
  return <span className={`pill ${tier(score)}`}>{score}</span>;
}
export function SourceBadge({ source }) {
  return <span className="src-badge"><i style={{ background: SOURCES[source]?.color }} />{SOURCES[source]?.short || source}</span>;
}
export function Thumb({ video, className = 'thumb' }) {
  if (!video.thumbnail) return <div className={`${className} thumb-empty`} aria-hidden="true">{video.source === 'meta_ads' ? 'AD' : 'REEL'}</div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={video.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />;
}
export function Flags({ video }) {
  return (
    <>
      {video.lowMatch && <span className="tag bad">Low match</span>}
      {video.previouslySeen && <span className="tag seen">Seen before</span>}
    </>
  );
}

function Th({ k, label, sort, onSort, num }) {
  const active = sort.key === k;
  return (
    <th className={num ? 'num' : ''} aria-sort={active ? (sort.dir === 'desc' ? 'descending' : 'ascending') : 'none'}>
      <button className="th-btn" onClick={() => onSort(k)}>{label}<span aria-hidden="true">{active ? (sort.dir === 'desc' ? ' \u2193' : ' \u2191') : ''}</span></button>
    </th>
  );
}

export default function VideoTable({ videos, sort, onSort, onSelect }) {
  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <Th k="matchScore" label="Match" sort={sort} onSort={onSort} />
            <th>Video</th>
            <th>Source</th>
            <Th k="likes" label="Likes" sort={sort} onSort={onSort} num />
            <Th k="views" label="Views" sort={sort} onSort={onSort} num />
            <Th k="postedAt" label="Posted" sort={sort} onSort={onSort} />
            <th><span className="sr">Open</span></th>
          </tr>
        </thead>
        <tbody>
          {videos.map((v) => {
            const href = safeHref(v.url);
            return (
              <tr key={`${v.source}:${v.id}`} onClick={() => onSelect(v)} className={v.lowMatch ? 'dim' : ''}>
                <td>
                  <div className="score-cell"><ScorePill score={v.matchScore} /><span className="mini"><i className={tier(v.matchScore)} style={{ width: `${v.matchScore}%` }} /></span></div>
                </td>
                <td className="video-cell">
                  <div className="vc-wrap">
                    <Thumb video={v} />
                    <button className="row-link" onClick={(e) => { e.stopPropagation(); onSelect(v); }}>
                      <span className="cap">{v.caption || v.title || 'No caption'}</span>
                      <span className="by">{v.author ? `@${v.author}` : 'Unknown creator'}{v.mock ? ' (sample)' : ''} <Flags video={v} /></span>
                      {v.matchReason && <span className="why">{v.matchReason}</span>}
                    </button>
                  </div>
                </td>
                <td><SourceBadge source={v.source} /></td>
                <td className="num">{compact(v.likes)}</td>
                <td className="num">{v.views ? compact(v.views) : '-'}</td>
                <td className="muted">{timeAgo(v.postedAt)}</td>
                <td className="act">
                  {href && !v.mock && <a className="btn-sm" href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Open</a>}
                  {href && v.mock && <span className="btn-sm disabled" title="Sample data has no real link">Open</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
