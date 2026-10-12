export default function BrainPanel({ data }) {
  const { product, brain, stats, warnings } = data;
  const attrs = Object.entries(brain.attributes || {}).flatMap(([k, v]) =>
    (Array.isArray(v) ? v : v ? [v] : []).map((x) => ({ k, x })));
  return (
    <section className="brain" aria-label="What the image brain understood">
      <div className="brain-top">
        {product.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt={product.title} className="thumb" referrerPolicy="no-referrer" />
        )}
        <div>
          <h2>{product.title}</h2>
          <p className="muted">
            {brain.source === 'vision' ? 'Read from the product image and text' : 'Built from the title only (no image model key set)'}
            {brain.category ? `, category: ${brain.category}` : ''}
          </p>
        </div>
      </div>

      {attrs.length > 0 && (
        <div className="chips">
          {attrs.map(({ k, x }, i) => <span key={i} className="chip" title={k}>{x}</span>)}
        </div>
      )}

      <details>
        <summary>Search queries sent to each source</summary>
        <ul className="queries">
          {Object.entries(brain.queries).map(([src, qs]) => (
            <li key={src}><b>{src.replace('_', ' ')}</b> {qs.join(', ')}</li>
          ))}
        </ul>
      </details>

      <p className="muted small">
        {Object.entries(stats).map(([s, v]) =>
          `${s.replace('_', ' ')}: ${v.count} new, ${v.droppedSeen} already seen, ${v.droppedDuplicate} duplicates removed`).join('   |   ')}
      </p>
      {warnings.length > 0 && <ul className="warn">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
    </section>
  );
}
