export default function History({ items, activeId, onPick, onClear }) {
  return (
    <aside className="history" aria-label="Search history">
      <div className="history-head">
        <h2>History</h2>
        {items.length > 0 && <button className="link" onClick={onClear}>Clear all</button>}
      </div>
      {items.length === 0 ? (
        <p className="muted small">Your searches will show up here. Repeat a search to get videos you have not seen yet.</p>
      ) : (
        <ul>
          {items.map((s) => (
            <li key={s.id}>
              <button className={s.id === activeId ? 'hist active' : 'hist'} onClick={() => onPick(s.id)}>
                <span className="hist-title">{s.title}</span>
                <span className="muted small">
                  {Object.values(s.counts).reduce((a, b) => a + b, 0)} videos, {new Date(s.createdAt + 'Z').toLocaleString()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
