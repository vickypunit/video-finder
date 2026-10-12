'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { SOURCES, downloadCsv } from '../lib/format';
import Sidebar from '../components/Sidebar';
import Progress from '../components/Progress';
import { Kpis, Coverage } from '../components/StatCards';
import BrainPanel from '../components/BrainPanel';
import VideoTable from '../components/VideoTable';
import VideoCard from '../components/VideoCard';
import VideoDrawer from '../components/VideoDrawer';
import { SearchIcon, TableIcon, GridIcon, DownloadIcon, CloseIcon } from '../components/Icons';

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
  const [image, setImage] = useState(null); // { name, dataUrl } optional product photo
  const [events, setEvents] = useState([]);
  const [hideLow, setHideLow] = useState(false);
  const [showSeen, setShowSeen] = useState(false);
  const [prev, setPrev] = useState(null);

  const refreshHistory = useCallback(() => api.history().then((r) => setHistory(r.searches)).catch(() => {}), []);
  useEffect(() => {
    api.config().then(setCfg).catch(() => setError('Cannot reach the backend. Start it on port 4000.'));
    refreshHistory();
  }, [refreshHistory]);

  async function runSearch(value = input, img = image) {
    setError(''); setLoading(true); setSelected(null); setEvents([]); setShowSeen(false); setPrev(null);
    try {
      const r = await api.search({ input: value, image: img?.dataUrl, sources }, (e) => setEvents((list) => [...list, e]));
      setData(r); setTab('all'); setText('');
      refreshHistory();
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  function onPickImage(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const max = cfg?.maxUploadBytes || 1.5 * 1024 * 1024;
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) { setError('Upload a PNG, JPEG, WebP or GIF image.'); return; }
    if (file.size > max) { setError(`That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. Use one under ${(max / 1024 / 1024).toFixed(1)} MB.`); return; }
    setError('');
    const reader = new FileReader();
    reader.onload = () => setImage({ name: file.name, dataUrl: reader.result });
    reader.readAsDataURL(file);
  }

  async function openHistory(id) {
    setError(''); setSelected(null);
    try { setData(await api.historyItem(id)); setTab('all'); setText(''); setShowSeen(false); setPrev(null); } catch (err) { setError(err.message); }
  }

  async function clearHistory() {
    if (!window.confirm('Clear all history? Videos you have seen will show up again.')) return;
    await api.clearHistory(); setHistory([]); setData(null);
  }

  // "Show previously seen": old results of the same product are fetched on demand
  useEffect(() => {
    if (!showSeen || !data?.id || prev) return;
    api.previous(data.id).then((r) => setPrev(r.results)).catch((err) => { setError(err.message); setShowSeen(false); });
  }, [showSeen, data, prev]);
  const prevCount = prev ? Object.values(prev).flat().length : 0;

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = text.trim().toLowerCase();
    const pool = [...Object.values(data.results).flat(), ...(showSeen && prev ? Object.values(prev).flat() : [])];
    const list = pool.filter((v) =>
      (tab === 'all' || v.source === tab) && v.matchScore >= minScore && !(hideLow && v.lowMatch) &&
      (!q || `${v.caption} ${v.author} ${v.title}`.toLowerCase().includes(q)));
    const val = (v) => (sort.key === 'postedAt' ? new Date(v.postedAt || 0).getTime() : v[sort.key] || 0);
    return list.sort((a, b) => (sort.dir === 'desc' ? val(b) - val(a) : val(a) - val(b)));
  }, [data, tab, minScore, text, sort, hideLow, showSeen, prev]);

  useEffect(() => setPage(1), [data, tab, minScore, text, sort, view, hideLow, showSeen]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }));
  const total = data ? Object.values(data.results).flat().length : 0;
  const lowCount = data ? Object.values(data.results).flat().filter((v) => v.lowMatch).length : 0;
  const canSearch = !loading && (input.trim().length >= 2 || Boolean(image));
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
            <label className="btn upload" title="Optional: add a product photo">
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onPickImage} disabled={loading} />
              Add photo
            </label>
            <button type="submit" className="btn primary" disabled={!canSearch}>{loading ? 'Searching' : 'Search'}</button>
          </form>
          {image && (
            <div className="img-chip">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.dataUrl} alt="" />
              <span className="small">{image.name}</span>
              <button className="icon-btn sm" onClick={() => setImage(null)} aria-label="Remove photo"><CloseIcon /></button>
              <span className="muted small">{input.trim() ? 'Used as the reference photo' : 'Searching from the photo alone'}</span>
            </div>
          )}
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

          {loading && <Progress events={events} sources={sources} min={cfg?.minPerSource || 20} />}

          {!data && !loading && (
            <div className="panel empty">
              <h1>Find videos that show your product</h1>
              <p className="muted">Enter a product name, paste a product page link, or add a product photo. You get at least 20 Instagram Reels and 20 Meta ads, ranked by match. Search the same product again to get videos you have not seen.</p>
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
              {data.warnings.length > 0 && <div className="banner warn-banner" role="alert">{data.warnings.join(' ')} You can switch that source off, wait a minute, or search again for more.</div>}
              {data.notes?.length > 0 && <div className="banner info-banner">{data.notes.join(' ')}</div>}

              <section className="panel results" aria-label="Videos">
                <div className="toolbar">
                  <div className="tabs" role="tablist">
                    {['all', ...Object.keys(data.results)].map((s) => (
                      <button key={s} role="tab" aria-selected={tab === s} className={tab === s ? 'tab on' : 'tab'} onClick={() => setTab(s)}>
                        {s === 'all' ? 'All' : SOURCES[s]?.short || s}
                        <span className="count">{s === 'all' ? total : `${data.results[s].length}/${cfg?.minPerSource || 20}`}</span>
                      </button>
                    ))}
                  </div>
                  <div className="tools">
                    <input className="filter" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Filter by caption or creator" aria-label="Filter by caption or creator" />
                    <label className="range">Min match <b>{minScore}</b>
                      <input type="range" min="0" max="100" step="5" value={minScore} onChange={(e) => setMinScore(+e.target.value)} />
                    </label>
                    <label className="check"><input type="checkbox" checked={hideLow} onChange={(e) => setHideLow(e.target.checked)} /> Hide low matches{lowCount ? ` (${lowCount})` : ''}</label>
                    <label className="check"><input type="checkbox" checked={showSeen} onChange={(e) => setShowSeen(e.target.checked)} /> Show previously seen{showSeen && prev ? ` (${prevCount})` : ''}</label>
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
                  <p className="muted pad">No videos match these filters. Lower the minimum match, show low matches, or clear the filter.</p>
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
