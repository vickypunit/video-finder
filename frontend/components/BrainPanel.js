export default function BrainPanel({ data }) {
  const { product, brain } = data;
  const attrs = Object.entries(brain.attributes || {}).flatMap(([k, v]) => (Array.isArray(v) ? v : v ? [v] : []).map((x) => ({ k, x })));
  let host = null;
  try { host = product.sourceUrl ? new URL(product.sourceUrl).hostname.replace(/^www\./, '') : null; } catch { /* ignore */ }
  const how = product.uploadedImage ? 'Your uploaded photo' : product.imageUrl ? 'Product page photo' : null;
  const visual = data.visual;
  return (
    <section className="panel" aria-label="Product understanding">
      <header className="panel-head">
        <h2>Product understanding</h2>
        <span className={brain.source === 'vision' ? 'tag ok' : 'tag warn'}>{brain.source === 'vision' ? 'Image and text' : 'Title only'}</span>
      </header>
      <div className="product-row">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="p-img" src={product.imageUrl} alt={product.title} referrerPolicy="no-referrer" />
        ) : (
          <div className="p-img p-fallback" aria-hidden="true">{(product.title || '?').slice(0, 1).toUpperCase()}</div>
        )}
        <div className="p-text">
          <h3>{product.title}</h3>
          <p className="muted small">
            {[brain.category, product.brand, host, how].filter(Boolean).join(', ') || 'Searched by name'}
          </p>
        </div>
      </div>
      {brain.summary && <p className="small">{brain.summary}</p>}
      {brain.source !== 'vision' && <p className="muted small">Add ANTHROPIC_API_KEY in backend/.env so the image brain can read the product photo.</p>}
      {attrs.length > 0 && <div className="chips">{attrs.map(({ k, x }, i) => <span key={i} className="chip" title={k}>{x}</span>)}</div>}
      {visual && (
        <p className="muted small">
          {data.providerMode === 'mock'
            ? 'Sample mode: visual scores are simulated, no real thumbnails were compared.'
            : visual.available
              ? `Visual check compared ${visual.compared} thumbnails with the product photo.`
              : 'No visual comparison this time, scores use captions and hashtags only.'}
        </p>
      )}
      <details className="queries">
        <summary>Queries sent to each source</summary>
        <ul>{Object.entries(brain.queries).map(([s, q]) => <li key={s}><b>{s.replace('_', ' ')}</b> {q.join(', ')}</li>)}</ul>
        {brain.hashtags?.length > 0 && <p className="small muted">Hashtags: {brain.hashtags.map((h) => `#${h}`).join(' ')}</p>}
      </details>
    </section>
  );
}
