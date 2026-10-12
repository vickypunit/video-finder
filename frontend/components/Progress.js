import { SOURCES } from '../lib/format';

const STEPS = [
  ['resolving', 'Reading the product'],
  ['analyzing', 'Analysing the product image'],
  ['searching', 'Collecting videos'],
  ['scoring', 'Comparing thumbnails and scoring'],
  ['saving', 'Saving history'],
];

/** Live pipeline status built from the job's progress events (SSE / polling). */
export default function Progress({ events, sources, min }) {
  const last = events[events.length - 1];
  const current = Math.max(0, STEPS.findIndex(([s]) => s === last?.stage));
  const counts = {};
  events.forEach((e) => { if (e.stage === 'searching' && e.source) counts[e.source] = e.count ?? counts[e.source] ?? 0; });
  const active = Object.keys(sources).filter((id) => sources[id]);

  return (
    <div className="panel loading" aria-live="polite" role="status">
      <div className="load-bar" />
      <p><b>{last?.message || 'Starting the search'}</b></p>
      <ol className="steps">
        {STEPS.map(([id, label], i) => {
          const state = !last ? 'todo' : i < current || last.stage === 'done' ? 'done' : i === current ? 'now' : 'todo';
          return (
            <li key={id} className={`step ${state}`}>
              <span className="step-dot" aria-hidden="true">{state === 'done' ? '\u2713' : i + 1}</span>
              <span>{label}</span>
              {id === 'searching' && (state === 'now' || state === 'done') && (
                <div className="step-sub">
                  {active.map((s) => (
                    <div key={s} className="step-src">
                      <span>{SOURCES[s]?.short || s}</span>
                      <div className="meter"><i style={{ width: `${Math.min(100, ((counts[s] || 0) / min) * 100)}%` }} /></div>
                      <b>{counts[s] || 0} / {min}</b>
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <p className="muted small">Instagram and Meta run in parallel. Long searches keep running on the server, so you can leave this page open.</p>
    </div>
  );
}
