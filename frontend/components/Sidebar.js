import { LogoMark, PlusIcon, SearchIcon, ClockIcon } from './Icons';

export default function Sidebar({ items, activeId, onPick, onClear, onNew, cfg }) {
  return (
    <aside className="sidebar">
      <div className="brand"><LogoMark /><span>Video Finder</span></div>

      <button className="new-btn" onClick={onNew}><PlusIcon /> New search</button>

      <nav aria-label="Main">
        <a className="nav-item on" href="#top" aria-current="page"><SearchIcon /> Search</a>
      </nav>

      <div className="side-section">
        <div className="side-head"><span><ClockIcon /> History</span>
          {items.length > 0 && <button className="side-link" onClick={onClear}>Clear all</button>}
        </div>
        {items.length === 0 ? (
          <p className="side-empty">No searches yet. Repeat a search later to get videos you have not seen.</p>
        ) : (
          <ul className="hist-list">
            {items.map((s) => (
              <li key={s.id}>
                <button className={s.id === activeId ? 'hist on' : 'hist'} onClick={() => onPick(s.id)}>
                  <span className="hist-title">{s.title}</span>
                  <span className="hist-sub">
                    {Object.values(s.counts).reduce((a, b) => a + b, 0)} videos, {new Date(`${s.createdAt}Z`).toLocaleDateString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="side-foot">
        <span className={cfg?.providerMode === 'live' ? 'mode live' : 'mode'}>
          <i /> {cfg ? (cfg.providerMode === 'live' ? 'Live data' : 'Sample data mode') : 'Connecting'}
        </span>
      </div>
    </aside>
  );
}
