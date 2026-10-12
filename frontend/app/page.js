'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { SOURCES, downloadCsv } from '../lib/format';
import Sidebar from '../components/Sidebar';
import { Kpis, Coverage } from '../components/StatCards';
import BrainPanel from '../components/BrainPanel';
import VideoTable from '../components/VideoTable';
import VideoCard from '../components/VideoCard';
import VideoDrawer from '../components/VideoDrawer';
import { SearchIcon, TableIcon, GridIcon, DownloadIcon } from '../components/Icons';

const PAGE_SIZE = 20;
const EXAMPLES = ['Stanley Quencher Tumbler', 'Sony WH-1000XM5 headphones', 'Lodge cast iron skillet'];

export default function Home() {
  const [cfg, setCfg] = useState(null);
  const [input, setInput] = useState('');
  const [sources, setSources] = useState({ instagram: true, meta_ads: true, tiktok: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState('all');
  const [minScore, setMinScore] = useState(0);
  const [text, setText] = useState('');
  const [sort, setSort] = useState({ key: 'matchScore', dir: 'desc' });
  const [view, setView] = useState('table');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const refreshHistory = useCallback(() => api.history().then((r) => setHistory(r.searches)).catch(() => {}), []);
  useEffect(() => {
    api.config().then(setCfg).catch(() => setError('Cannot reach the backend. Start it on port 4000.'));
    refreshHistory();
  }, [refreshHistory]);

  async function runSearch(value = input) {
    setError(''); setLoading(true); setSelected(null);
    try {
      const r = await api.search(value, sources);
      setData(r); setTab('all'); setText('');
      refreshHistory();
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  async function openHistory(id) {
    setError(''); setSelected(null);
    try { setData(await api.historyItem(id)); setTab('all'); setText(''); } catch (err) { setError(err.message); }
  }

  async function clearHistory() {
    if (!window.confirm('Clear all history? Videos you have seen will show up again.')) return;
    await api.clearHistory(); setHistory([]); setData(null);
  }

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = text.trim().toLowerCase();
    const list = Object.values(data.results).flat().filter((v) =>
      (tab === 'all' || v.source === tab) && v.matchScore >= minScore &&
      (!q || `${v.caption} ${v.author} ${v.title}`.toLowerCase().includes(q)));
    const val = (v) => (sort.key === 'postedAt' ? new Date(v.postedAt || 0).getTime() : v[sort.key] || 0);
    return list.sort((a, b) => (sort.dir === 'desc' ? val(b) - val(a) : val(a) - val(b)));
  }, [data, tab, minScore, text, sort]);

  useEffect(() => setPage(1), [data, tab, minScore, text, sort, view]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }));
  const total = data ? Object.values(data.results).flat().length : 0;
  const closeDrawer = useCallback(() => setSelected(null), []);

  return (
    <div className="app">
      <Sidebar items={history} activeId={data?.id} onPick={openHistory} onClear={clearHistory}
        onNew={() => { setData(null); setInput(''); setError(''); }} cfg={cfg} />

      <div className="content" id="top">
        <header className="topbar">
          <form className="cmd" onSubmit={(e) => { e.preventDefault(); runSearch(); }}>
            <label htmlFor="q" className="sr">Product name or link</label>
            <SearchIcon className="cmd-icon" />
            <input id="q" value={input} onChange={(e) => setInput(e.target.value)} autoComplete="off"
              placeholder="Product name, or a link to the product page" />
            <button type="submit" className="btn primary" disabled={loading || input.trim().length < 2}>{loading ? 'Searching' : 'Search'}</button>
          </form>
          <div className="srcs" role="group" aria-label="Video sources">
            {Object.keys(SOURCES).filter((id) => id !== 'tiktok' || cfg?.tiktokEnabled).map((id) => (
              <label key={id} className={sources[id] ? 'src-toggle on' : 'src-toggle'}>
                <input type="checkbox" checked={sources[id]} onChange={(e) => setSources({ ...sources, [id]: e.target.checked })} />
                <i style={{ background: SOURCES[id].color }} />{SOURCES[id].label}
              </label>
            ))}
          </div>
        </header>

        <main className="page">
          {error && <div role="alert" className="banner err-banner">{error}</div>}
          {cfg?.providerMode === 'mock' && <div className="banner warn-banner">Sample data mode: results are generated for testing, not real posts. Set PROVIDER_MODE=live in backend/.env for real videos.</div>}

          {loading && (
            <div className="panel loading" aria-live="polite">
              <div className="load-bar" />
              <p><b>Collecting videos</b></p>
              <p className="muted small">Reading the product, building queries, then pulling pages from each source. This can take up to a minute.</p>
            </div>
          )}

          {!data && !loading && (
            <div className="panel empty">
              <h1>Find videos that show your product</h1>
              <p className="muted">Enter a product name or paste a product page link. You get at least 20 Instagram Reels and 20 Meta ads, ranked by match. Search the same product again to get videos you have not seen.</p>
              <div className="examples">
                <span className="muted small">Try</span>
                {EXAMPLES.map((e) => <button key={e} className="chip-btn" onClick={() => { setInput(e); runSearch(e); }}>{e}</button>)}
              </div>
            </div>
          )}

          {data && !loading && (
            <>
              <div className="page-title">
                <h1>{data.product.title}</h1>
                <span className="muted small">Search #{data.id}</span>
              </div>
              <Kpis data={data} />
              <div className="two-col">
                <BrainPanel data={data} />
                <Coverage data={data} min={cfg?.minPerSource || 20} />
              </div>
              {data.warnings.length > 0 && <div className="banner warn-banner">{data.warnings.join(' ')}</div>}

              <section className="panel results" aria-label="Videos">
                <div className="toolbar">
                  <div className="tabs" role="tablist">
                    {['all', ...Object.keys(data.results)].map((s) => (
                      <button key={s} role="tab" aria-selected={tab === s} className={tab === s ? 'tab on' : 'tab'} onClick={() => setTab(s)}>
                        {s === 'all' ? 'All' : SOURCES[s]?.short || s}
                        <span className="count">{s === 'all' ? total : data.results[s].length}</span>
                      </button>
                    ))}
                  </div>
                  <div className="tools">
                    <input className="filter" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Filter by caption or creator" aria-label="Filter by caption or creator" />
                    <label className="range">Min match <b>{minScore}</b>
                      <input type="range" min="0" max="100" step="5" value={minScore} onChange={(e) => setMinScore(+e.target.value)} />
                    </label>
                    <label className="sel">Sort
                      <select value={sort.key} onChange={(e) => setSort({ key: e.target.value, dir: 'desc' })}>
                        <option value="matchScore">Best match</option><option value="postedAt">Most recent</option>
                        <option value="likes">Most liked</option><option value="views">Most viewed</option>
                      </select>
                    </label>
                    <div className="seg" role="group" aria-label="View">
                      <button className={view === 'table' ? 'on' : ''} onClick={() => setView('table')} aria-label="Table view" aria-pressed={view === 'table'}><TableIcon /></button>
                      <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')} aria-label="Card view" aria-pressed={view === 'grid'}><GridIcon /></button>
                    </div>
                    <button className="btn" onClick={() => downloadCsv(filtered, data.product.title)} disabled={!filtered.length}><DownloadIcon /> Export CSV</button>
                  </div>
                </div>

                {filtered.length === 0 ? (
                  <p className="muted pad">No videos match these filters. Lower the minimum match or clear the filter.</p>
                ) : view === 'table' ? (
                  <VideoTable videos={pageItems} sort={sort} onSort={toggleSort} onSelect={setSelected} />
                ) : (
                  <div className="vgrid">{pageItems.map((v) => <VideoCard key={`${v.source}:${v.id}`} video={v} onSelect={setSelected} />)}</div>
                )}

                {filtered.length > 0 && (
                  <footer className="pager">
                    <span className="muted small">Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
                    <div>
                      <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
                      <span className="pg">Page {page} of {pages}</span>
                      <button className="btn" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
                    </div>
                  </footer>
                )}
              </section>
            </>
          )}
        </main>
      </div>

      {selected && <VideoDrawer video={selected} onClose={closeDrawer} />}
    </div>
  );
}
