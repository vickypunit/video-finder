'use client';
import { useEffect, useRef, useState } from 'react';
import { PARTS, PARTS_VISUAL, compact, embedUrl, safeHref, tier } from '../lib/format';
import { CloseIcon } from './Icons';
import { Flags, SourceBadge, Thumb } from './VideoTable';

export default function VideoDrawer({ video, onClose }) {
  const closeRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => { setCopied(false); setPlaying(false); }, [video]);

  const href = safeHref(video.url);
  const embed = video.mock ? null : embedUrl(video);
  const b = video.scoreBreakdown || {};
  const parts = 'visual' in b ? PARTS_VISUAL : PARTS;
  const copy = async () => {
    try { await navigator.clipboard.writeText(video.url); setCopied(true); } catch { /* clipboard blocked */ }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Video details" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <SourceBadge source={video.source} />
          {video.mock && <span className="tag warn">Sample data</span>}
          <Flags video={video} />
          <button ref={closeRef} className="icon-btn" onClick={onClose} aria-label="Close details"><CloseIcon /></button>
        </header>

        {playing && embed ? (
          <iframe className="player" src={embed} title="Video player" loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups" allow="encrypted-media; fullscreen" />
        ) : video.thumbnail ? (
          <Thumb video={video} className="d-thumb" />
        ) : null}

        <div className="d-score">
          <span className={`d-num ${tier(video.matchScore)}`}>{video.matchScore}</span>
          <span className="muted">match score out of 100</span>
        </div>

        {video.matchReason && (
          <section>
            <h3>Why this match</h3>
            <p className="d-why">{video.matchReason}</p>
          </section>
        )}

        <section>
          <h3>Score breakdown</h3>
          <ul className="break">
            {parts.map(([k, label, max]) => (
              <li key={k}>
                <div className="break-top"><span>{label}</span><b>{b[k] ?? 0} / {max}</b></div>
                <div className="meter"><i style={{ width: `${((b[k] ?? 0) / max) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
          {!('visual' in b) && <p className="muted small">No thumbnail was compared for this video, so the score uses caption, hashtags and engagement only.</p>}
        </section>

        <section>
          <h3>Caption</h3>
          <p className="d-cap">{video.caption || video.title || 'No caption'}</p>
        </section>

        <dl className="facts">
          <div><dt>Creator</dt><dd>{video.author ? `@${video.author}` : 'Unknown'}</dd></div>
          <div><dt>Posted</dt><dd>{video.postedAt ? new Date(video.postedAt).toLocaleDateString() : '-'}</dd></div>
          <div><dt>Likes</dt><dd>{compact(video.likes)}</dd></div>
          <div><dt>Comments</dt><dd>{compact(video.comments)}</dd></div>
          <div><dt>Views</dt><dd>{video.views ? compact(video.views) : '-'}</dd></div>
        </dl>

        <footer className="drawer-foot">
          {embed && <button className="btn" onClick={() => setPlaying((p) => !p)}>{playing ? 'Hide player' : 'Play here'}</button>}
          {href && !video.mock && <a className="btn primary" href={href} target="_blank" rel="noopener noreferrer">Open video</a>}
          {href && video.mock && <span className="btn disabled" title="Sample data has no real link">Open video</span>}
          <button className="btn" onClick={copy}>{copied ? 'Link copied' : 'Copy link'}</button>
        </footer>
      </aside>
    </div>
  );
}
