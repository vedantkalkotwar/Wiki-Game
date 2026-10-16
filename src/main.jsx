import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, ArrowRight, BookOpen, Check, Compass, ExternalLink, Moon, RotateCcw, Search, Shuffle, Sun, Trophy, X } from 'lucide-react';
import './styles.css';

const API = 'https://en.wikipedia.org/w/api.php';
const params = (values) => new URLSearchParams({ ...values, origin: '*' });
async function api(values, signal) {
  const response = await fetch(`${API}?${params({ format: 'json', ...values })}`, { signal });
  if (!response.ok) throw new Error(response.status === 429 ? 'Wikipedia is receiving too many requests. Please wait a moment and try again.' : 'Wikipedia could not be reached. Check your connection and try again.');
  const json = await response.json();
  if (json.error) throw new Error(json.error.info || 'Wikipedia returned an error.');
  return json;
}
async function randomArticle(signal) {
  const data = await api({ action: 'query', generator: 'random', grnnamespace: 0, grnlimit: 1, prop: 'info', inprop: 'url' }, signal);
  const page = Object.values(data.query?.pages || {})[0];
  if (!page) throw new Error('No article was found. Please try again.');
  return page.title;
}
async function searchArticles(term, signal) {
  const data = await api({ action: 'query', list: 'search', srsearch: term, srnamespace: 0, srlimit: 6, formatversion: 2 }, signal);
  return data.query?.search || [];
}

const normalize = (s) => (s || '').normalize('NFKC').replaceAll('_', ' ').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
// The proxy (api/wiki.js) serves the real Wikipedia page from our own origin, so the iframe is same-origin.
const wikiSrc = (title) => `/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`;

const presets = [['Albert Einstein','Black hole'], ['Coffee','Tea'], ['Moon','Tides'], ['Beyoncé','Grammy Awards']];
function App() {
  const [start, setStart] = useState('Albert Einstein');
  const [target, setTarget] = useState('Black hole');
  const [screen, setScreen] = useState('home');
  const [path, setPath] = useState([]);
  const [frame, setFrame] = useState({ src: '', key: 0 });
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Finding your next page…');
  const [error, setError] = useState('');
  const [randomLoading, setRandomLoading] = useState('');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchFor, setSearchFor] = useState('start');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [victory, setVictory] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('wiki-race-theme') === 'dark');
  const [notice, setNotice] = useState('');
  const searchReq = useRef(0);
  const startRef = useRef(start);
  const pathRef = useRef(path);
  const targetRef = useRef(target);
  const pendingRef = useRef(null); // set when WE reload the iframe (start/back/reset/trail jump), so it isn't counted as a step
  const wonRef = useRef(false);
  targetRef.current = target;

  const steps = Math.max(0, path.length - 1);
  const current = path[path.length - 1];

  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('wiki-race-theme', dark ? 'dark' : 'light'); }, [dark]);
  useEffect(() => { const id = setTimeout(() => setNotice(''), 2800); return () => clearTimeout(id); }, [notice]);
  useEffect(() => { pathRef.current = path; }, [path]);

  // Every page the iframe shows (including links the player clicks inside it) reports its title here.
  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== window.location.origin || e.data?.type !== 'page' || !e.data.title) return;
      const title = String(e.data.title).replaceAll('_', ' ');
      const pending = pendingRef.current;
      const old = pathRef.current;
      let next;
      if (pending) {
        pendingRef.current = null;
        next = pending.path.length ? [...pending.path.slice(0, -1), title] : [title];
        if (next.length === 1) startRef.current = title;
      } else {
        if (old.length && normalize(old[old.length - 1]) === normalize(title)) { setLoading(false); return; } // reload / same page
        next = [...old, title];
      }
      pathRef.current = next;
      setPath(next);
      setLoading(false);
      setError('');
      if (!pending && normalize(title) === normalize(targetRef.current)) { wonRef.current = true; setVictory(true); }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // If a reload never reports back (bad title, proxy down), stop the spinner and show an error.
  useEffect(() => {
    if (screen !== 'game' || !loading) return;
    const id = setTimeout(() => { setLoading(false); setError('The page did not load. Make sure the dev server (or Vercel function) is running, then try again.'); }, 15000);
    return () => clearTimeout(id);
  }, [loading, frame.key, screen]);

  const loadFrame = (title, nextPath, message) => {
    pendingRef.current = { path: nextPath };
    setLoadingMessage(message);
    setLoading(true);
    setError('');
    setFrame((f) => ({ src: wikiSrc(title), key: f.key + 1 }));
  };
  const clearWin = () => { setVictory(false); wonRef.current = false; };
  const startGame = () => { setScreen('game'); clearWin(); pathRef.current = []; setPath([]); startRef.current = start; loadFrame(start, [], 'Loading article…'); };
  const resetGame = () => { clearWin(); pathRef.current = []; setPath([]); loadFrame(startRef.current, [], 'Loading article…'); };
  const goHome = () => { pendingRef.current = null; pathRef.current = []; setPath([]); setLoading(false); setError(''); clearWin(); setFrame({ src: '', key: 0 }); setScreen('home'); };
  const back = () => {
    const p = pathRef.current;
    if (p.length < 2 || loading) return;
    const prev = p.slice(0, -1);
    clearWin();
    loadFrame(prev[prev.length - 1], prev, 'Returning to the previous page…');
  };
  const jumpTo = (i) => {
    if (loading) return;
    const p = pathRef.current.slice(0, i + 1);
    clearWin();
    loadFrame(p[p.length - 1], p, 'Returning to that page…');
  };
  const retry = () => { const p = pathRef.current; loadFrame(p.length ? p[p.length - 1] : startRef.current, p, 'Loading article…'); };

  const randomize = async (which) => {
    setRandomLoading(which);
    try {
      let next = await randomArticle();
      if (normalize(next) === normalize(which === 'start' ? target : start)) next = await randomArticle();
      if (normalize(next) === normalize(which === 'start' ? target : start)) throw new Error('The random article matched the other selection. Please try again.');
      (which === 'start' ? setStart : setTarget)(next);
    } catch(e) { setSearchError(e.message); }
    finally { setRandomLoading(''); }
  };
  const doSearch = async (e) => {
    e?.preventDefault();
    if (!search.trim()) return;
    const id = ++searchReq.current; setSearching(true); setSearchError(''); setSearchResults([]);
    try { const rows = await searchArticles(search.trim()); if(id === searchReq.current) setSearchResults(rows); }
    catch(e) { if(id === searchReq.current) setSearchError(e.message); }
    finally { if(id === searchReq.current) setSearching(false); }
  };
  const choose = (title) => { (searchFor === 'start' ? setStart : setTarget)(title); setSearchResults([]); setSearch(''); setSearchError(''); };
  const share = async () => {
    const summary = `Wikipedia Race: ${startRef.current} → ${target}\n${steps} ${steps === 1 ? 'step' : 'steps'}\nPath: ${path.join(' → ')}`;
    try { await navigator.clipboard.writeText(summary); setNotice('Result copied to clipboard.'); }
    catch { setNotice(summary); }
  };
  const isVictory = victory && wonRef.current;

  return <main className="app-shell">
    <header className="topbar"><a className="brand" href="#home" onClick={(e) => {e.preventDefault(); goHome();}}><span className="brand-mark"><BookOpen size={19}/></span><span>Wikipedia <b>Race</b></span></a><div className="top-actions"><span className="top-note">A little journey through knowledge</span><button className="icon-button" aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`} title="Toggle theme" onClick={() => setDark(!dark)}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button></div></header>
    {screen === 'home' ? <section className="landing">
      <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot"/> NO CLOCK. NO WRONG TURNS.</div><h1>Curiosity is<br/><em>the whole point.</em></h1><p className="hero-lead">A quiet little challenge: wander from one Wikipedia article to another, one interesting link at a time.</p></div>
      <div className="challenge-card"><div className="card-heading"><div><div className="eyebrow">YOUR NEXT JOURNEY</div><h2>Choose two ideas</h2></div><span className="route-icon"><Compass size={21}/></span></div>
        <div className="selection-row"><div className="selection-info"><span className="selection-label"><i className="route-dot from"/> STARTING FROM</span><strong>{start}</strong></div><button className="quiet-button" onClick={() => randomize('start')} disabled={!!randomLoading}>{randomLoading==='start' ? <span className="spinner small"/> : <Shuffle size={15}/>} Random</button></div>
        <div className="route-line"><span/><span className="route-arrow"><ArrowRight size={15}/></span><span/></div>
        <div className="selection-row"><div className="selection-info"><span className="selection-label"><i className="route-dot to"/> FIND YOUR WAY TO</span><strong>{target}</strong></div><button className="quiet-button" onClick={() => randomize('target')} disabled={!!randomLoading}>{randomLoading==='target' ? <span className="spinner small"/> : <Shuffle size={15}/>} Random</button></div>
        {normalize(start)===normalize(target) && <p className="inline-error">Pick two different articles to begin.</p>}
        <button className="primary-button start-button" disabled={normalize(start)===normalize(target)||!!randomLoading} onClick={startGame}>Start exploring <ArrowRight size={17}/></button>
        <div className="search-block"><div className="search-label"><Search size={15}/> Or pick an article by name</div><form className="search-form" onSubmit={doSearch}><input aria-label="Search Wikipedia articles" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="e.g. The Great Wave off Kanagawa"/><button disabled={searching||!search.trim()} aria-label="Search">{searching ? <span className="spinner small"/> : <Search size={17}/>}</button></form>
          {(searching || searchResults.length>0) && <div className="search-results"><div className="result-tabs"><button className={searchFor==='start'?'active':''} onClick={()=>setSearchFor('start')}>Set as start</button><button className={searchFor==='target'?'active':''} onClick={()=>setSearchFor('target')}>Set as destination</button></div>{searchResults.map((r)=><button key={r.pageid} className="search-result" onClick={()=>choose(r.title)}><span><b>{r.title}</b><small>{r.snippet.replace(/<[^>]*>/g,'')}</small></span><ArrowRight size={15}/></button>)}</div>}
          {searchError&&<p className="inline-error">{searchError}</p>}
        </div>
        <div className="preset-wrap"><span className="preset-label">NEED A PLACE TO START?</span><div className="presets">{presets.map(([a,b])=><button key={a} onClick={()=>{setStart(a);setTarget(b);}}>{a} <span>→</span> {b}</button>)}</div></div>
      </div>
      <div className="landing-foot"><span><span className="live-dot"/> Powered by the Wikipedia API</span><span>Made for the joy of getting a little lost.</span></div>
    </section> : <section className="game-screen">
      <div className="gamebar"><div className="game-route"><div className="route-cell"><span>START</span><b>{startRef.current}</b></div><ArrowRight className="game-arrow" size={16}/><div className="route-cell target-cell"><span>DESTINATION</span><b>{target}</b></div></div><div className="game-controls"><div className="step-pill"><span>STEPS</span><strong>{steps}</strong></div><button className="quiet-button control" onClick={back} disabled={path.length<2||loading} title="Go back"><ArrowLeft size={16}/> Back</button><button className="quiet-button control" onClick={resetGame} disabled={loading}><RotateCcw size={15}/> Reset</button><button className="quiet-button control new-button" onClick={goHome}>New game</button></div></div>
      <div className="workspace"><aside className="path-panel"><div className="path-title"><span className="eyebrow">YOUR TRAIL</span><span className="path-count">{path.length}</span></div>{path.length ? <ol className="path-list">{path.map((p,i)=><li key={`${i}-${p}`} className={i===path.length-1?'current':''}><span className="path-node"/>{i<path.length-1?<button onClick={()=>jumpTo(i)}>{p}</button>:<span>{p}</span>}</li>)}</ol> : <p className="path-empty">Your visited articles will appear here.</p>}<div className="trail-note"><Compass size={16}/><span>Follow the links that catch your eye. There’s no wrong way through.</span></div></aside>
        <section className="reader"><div className="reader-topline"><span><span className="live-dot"/> WIKIPEDIA ARTICLE</span>{current&&<a href={`https://en.wikipedia.org/wiki/${encodeURIComponent(current.replaceAll(' ','_'))}`} target="_blank" rel="noreferrer">View source <ExternalLink size={13}/></a>}</div>
          {loading&&<div className="loading-state"><span className="spinner"/><b>{loadingMessage}</b><span>Gathering a little knowledge</span><div className="skeleton wide"/><div className="skeleton"/><div className="skeleton short"/></div>}
          {!loading&&error&&<div className="error-state"><div className="error-icon">!</div><h2>Couldn’t open that page</h2><p>{error}</p><button className="primary-button" onClick={retry}>Try again <RotateCcw size={15}/></button></div>}
          {frame.src&&<iframe className="wiki-frame" key={frame.key} title="Wikipedia article" src={frame.src} style={{ display: loading || error ? 'none' : undefined }} />}
        </section>
      </div>
    </section>}
    {isVictory&&<div className="modal-backdrop" role="presentation"><section className="victory-modal" role="dialog" aria-modal="true" aria-labelledby="victory-title"><button className="modal-close" aria-label="Close" onClick={()=>setVictory(false)}><X size={18}/></button><div className="trophy-mark"><Trophy size={25}/></div><div className="eyebrow">NICELY WANDERED</div><h2 id="victory-title">You made it!</h2><p className="victory-sub">You followed your curiosity all the way to the destination.</p><div className="victory-route"><span>{startRef.current}</span><ArrowRight size={17}/><b>{target}</b></div><div className="victory-steps"><strong>{steps}</strong><span>{steps===1?'step':'steps'} along the way</span></div><div className="victory-path"><span className="eyebrow">YOUR PATH</span><div>{path.map((p,i)=><React.Fragment key={`${i}-${p}`}><span className={i===path.length-1?'final':''}>{p}</span>{i<path.length-1&&<i>→</i>}</React.Fragment>)}</div></div><div className="modal-actions"><button className="primary-button" onClick={resetGame}><RotateCcw size={15}/> Play again</button><button className="quiet-button" onClick={goHome}>New challenge <ArrowRight size={15}/></button><button className="share-button" onClick={share}><Check size={15}/> Copy result</button></div></section></div>}
    {notice&&<div className="toast" role="status">{notice.length>140?'Could not copy. Your result: ':''}{notice.length>140?notice.slice(0,140)+'…':notice}</div>}
    <footer className="app-footer"><span>Wikipedia Race</span><span>An independent project · Content from <a href="https://en.wikipedia.org" target="_blank" rel="noreferrer">Wikipedia</a></span></footer>
  </main>;
}

createRoot(document.getElementById('root')).render(<App/>);
