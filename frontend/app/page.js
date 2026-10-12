'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import VideoCard from '../components/VideoCard';
import BrainPanel from '../components/BrainPanel';
import History from '../components/History';

const SOURCES = [
  ['instagram', 'Instagram Reels'],
  ['meta_ads', 'Meta Ad Library'],
  ['tiktok', 'TikTok'],
];

export default function Home() {
  const [cfg, setCfg] = useState(null);
  const [input, setInput] = useState('');
  const [sources, setSources] = useState({ instagram: true, meta_ads: true, tiktok: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [filter, setFilter] = useState({ source: 'all', minScore: 0, sort: 'score' });

  const refreshHistory = () => api.history().then((r) => setHistory(r.searches)).catch(() => {});
  useEffect(() => { api.config().then(setCfg).catch(() => setError('Cannot reach the backend. Start it on port 4000.')); refreshHistory(); }, []);

  async function submit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const r = await api.search(input, sources);
      setData(r); setFilter((f) => ({ ...f, source: 'all' }));
      refreshHistory();
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  async function openHistory(id) {
    setError('');
    try { setData(await api.historyItem(id)); } catch (err) { setError(err.message); }
  }

  async function clearHistory() {
    if (!window.confirm('Clear all history? Videos you have seen will show up again.')) return;
    await api.clearHistory(); setHistory([]); setData(null);
  }

  const videos = useMemo(() => {
    if (!data) return [];
    const all = Object.values(data.results).flat().filter((v) => filter.source === 'all' || v.source === filter.source)
      .filter((v) => v.matchScore >= filter.minScore);
    return all.sort((a, b) => (filter.sort === 'likes' ? b.likes - a.likes : filter.sort === 'recent' ? new Date(b.postedAt) - new Date(a.postedAt) : b.matchScore - a.matchScore));
  }, [data, filter]);

  return (
    <div className="shell">
      <History items={history} activeId={data?.id} onPick={openHistory} onClear={clearHistory} />

      <main className="main">
        <header className="top">
          <h1>Find videos that actually show your product</h1>
          <form onSubmit={submit} className="search">
            <label htmlFor="q" className="sr">Product name or link</label>
            <input id="q" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Product name or a link to the product page" autoComplete="off" />
            <button type="submit" disabled={loading || input.trim().length < 2}>{loading ? 'Searching' : 'Search'}</button>
          </form>
          <div className="toggles" role="group" aria-label="Video sources">
            {SOURCES.filter(([id]) => id !== 'tiktok' || cfg?.tiktokEnabled).map(([id, label]) => (
              <label key={id} className={sources[id] ? 'toggle on' : 'toggle'}>
                <input type="checkbox" checked={sources[id]} onChange={(e) => setSources({ ...sources, [id]: e.target.checked })} />
                {label}
              </label>
            ))}
            {cfg?.providerMode === 'mock' && <span className="mock-banner">Sample mode: results are generated, not real posts.</span>}
          </div>
          {error && <p role="alert" className="error">{error}</p>}
        </header>

        {loading && <p className="muted" aria-live="polite">Reading the product, then collecting videos. This can take up to a minute.</p>}

        {data && !loading && (
          <>
            <BrainPanel data={data} />
            <div className="filters">
              <div className="tabs" role="tablist">
                {['all', ...Object.keys(data.results)].map((s) => (
                  <button key={s} role="tab" aria-selected={filter.source === s} className={filter.source === s ? 'tab on' : 'tab'} onClick={() => setFilter({ ...filter, source: s })}>
                    {s === 'all' ? `All ${Object.values(data.results).flat().length}` : `${s.replace('_', ' ')} ${data.results[s].length}`}
                  </button>
                ))}
              </div>
              <label className="range">Minimum match {filter.minScore}
                <input type="range" min="0" max="100" step="5" value={filter.minScore} onChange={(e) => setFilter({ ...filter, minScore: +e.target.value })} />
              </label>
              <label className="sort">Sort
                <select value={filter.sort} onChange={(e) => setFilter({ ...filter, sort: e.target.value })}>
                  <option value="score">Best match</option><option value="recent">Most recent</option><option value="likes">Most liked</option>
                </select>
              </label>
            </div>
            {videos.length === 0 ? <p className="muted">No videos at this match level. Lower the minimum.</p> : (
              <div className="grid">{videos.map((v) => <VideoCard key={`${v.source}:${v.id}`} video={v} />)}</div>
            )}
          </>
        )}

        {!data && !loading && <p className="muted empty">Search a product to see Instagram Reels and Meta ads ranked by how well they match. Search the same product again to get videos you have not seen.</p>}
      </main>
    </div>
  );
}
