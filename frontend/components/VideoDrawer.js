'use client';
import { useEffect, useRef, useState } from 'react';
import { PARTS, compact, safeHref, tier } from '../lib/format';
import { CloseIcon } from './Icons';
import { SourceBadge } from './VideoTable';

export default function VideoDrawer({ video, onClose }) {
  const closeRef = useRef(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => setCopied(false), [video]);

  const href = safeHref(video.url);
  const b = video.scoreBreakdown || {};
  const copy = async () => {
    try { await navigator.clipboard.writeText(video.url); setCopied(true); } catch { /* clipboard blocked */ }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Video details" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <SourceBadge source={video.source} />
          {video.mock && <span className="tag warn">Sample data</span>}
          <button ref={closeRef} className="icon-btn" onClick={onClose} aria-label="Close details"><CloseIcon /></button>
        </header>

        <div className="d-score">
          <span className={`d-num ${tier(video.matchScore)}`}>{video.matchScore}</span>
          <span className="muted">match score out of 100</span>
        </div>

        <section>
          <h3>Why this score</h3>
          <ul className="break">
            {PARTS.map(([k, label, max]) => (
              <li key={k}>
                <div className="break-top"><span>{label}</span><b>{b[k] ?? 0} / {max}</b></div>
                <div className="meter"><i style={{ width: `${((b[k] ?? 0) / max) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
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
          {href && <a className="btn primary" href={href} target="_blank" rel="noopener noreferrer">Open video</a>}
          <button className="btn" onClick={copy}>{copied ? 'Link copied' : 'Copy link'}</button>
        </footer>
      </aside>
    </div>
  );
}
