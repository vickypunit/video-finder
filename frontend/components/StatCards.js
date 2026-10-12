import { SOURCES } from '../lib/format';

export function Kpis({ data }) {
  const all = Object.values(data.results).flat();
  const stats = Object.values(data.stats);
  const avg = all.length ? Math.round(all.reduce((a, v) => a + v.matchScore, 0) / all.length) : 0;
  const strong = all.filter((v) => v.matchScore >= 65).length;
  const dup = stats.reduce((a, s) => a + s.droppedDuplicate, 0);
  const seen = stats.reduce((a, s) => a + s.droppedSeen, 0);
  const items = [
    ['Videos found', all.length, `across ${stats.length} sources`],
    ['Average match', avg, 'out of 100'],
    ['Strong matches', strong, 'score 65 or higher'],
    ['Filtered out', dup + seen, `${seen} seen before, ${dup} duplicates`],
  ];
  return (
    <div className="kpis">
      {items.map(([label, value, sub]) => (
        <div className="kpi" key={label}>
          <span className="kpi-label">{label}</span>
          <span className="kpi-value">{value}</span>
          <span className="kpi-sub">{sub}</span>
        </div>
      ))}
    </div>
  );
}

export function Coverage({ data, min }) {
  return (
    <section className="panel" aria-label="Source coverage">
      <header className="panel-head"><h2>Source coverage</h2><span className="muted small">Minimum {min} new videos per source</span></header>
      <div className="cov-list">
        {Object.entries(data.stats).map(([id, s]) => {
          const ok = s.count >= min && !s.error;
          return (
            <div className="cov" key={id}>
              <div className="cov-top">
                <span className="dot" style={{ background: SOURCES[id]?.color }} />
                <b>{SOURCES[id]?.short || id}</b>
                <span className={ok ? 'tag ok' : 'tag warn'}>{ok ? 'Minimum met' : s.error ? 'Error' : 'Below minimum'}</span>
                <span className="cov-count">{s.count} / {min}</span>
              </div>
              <div className="meter"><i style={{ width: `${Math.min(100, (s.count / min) * 100)}%` }} /></div>
              <p className="muted small">{s.pages} page{s.pages === 1 ? '' : 's'} read, {s.droppedSeen} seen before, {s.droppedDuplicate} duplicates removed</p>
              {s.error && <p className="err small">{s.error}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
