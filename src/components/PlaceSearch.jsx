import { useEffect, useRef, useState } from 'react';
import { MIN_CHARS, searchPlaces, searchSource } from '../geocode.js';

// The way to add a place: type a name or address, pick a suggestion, and the
// parent places it on the map with its photo for the owner to describe.
export default function PlaceSearch({ onPick }) {
  const [text, setText] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | loading | empty | error
  const [active, setActive] = useState(-1);
  const seq = useRef(0);

  useEffect(() => {
    const q = text.trim();
    if (q.length < MIN_CHARS) { setResults([]); setStatus('idle'); return; }
    const id = ++seq.current;
    const ctrl = new AbortController();
    setStatus('loading');
    const timer = setTimeout(async () => {
      try {
        const found = await searchPlaces(q, ctrl.signal);
        if (id !== seq.current) return;
        setResults(found);
        setActive(-1);
        setStatus(found.length ? 'idle' : 'empty');
      } catch (e) {
        if (e.name === 'AbortError' || id !== seq.current) return;
        setResults([]);
        setStatus('error');
      }
    }, 250); // debounce: wait until the user pauses typing
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [text]);

  function choose(r) {
    setText('');
    setResults([]);
    setOpen(false);
    onPick(r);
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && results.length) { e.preventDefault(); choose(results[active >= 0 ? active : 0]); }
    else if (e.key === 'Escape') setOpen(false);
  }

  const showList = open && text.trim().length >= MIN_CHARS;

  return (
    <div className="search">
      <input
        className="input"
        type="search"
        placeholder="Search a place to add…"
        aria-label="Search a place to add to the map"
        role="combobox"
        aria-expanded={showList}
        aria-controls="search-results"
        autoComplete="off"
        value={text}
        onChange={(e) => { setText(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul className="search-results" id="search-results" role="listbox">
          {results.map((r, i) => (
            // onMouseDown (not onClick) so the choice registers before the input loses focus
            <li key={r.id} role="option" aria-selected={i === active} className={i === active ? 'active' : ''} onMouseDown={() => choose(r)}>
              <strong>{r.name}</strong>
              {r.label && <span>{r.label}</span>}
            </li>
          ))}
          {status === 'loading' && !results.length && <li className="search-note">Searching…</li>}
          {status === 'empty' && <li className="search-note">No result</li>}
          {status === 'error' && <li className="search-note">Search unavailable, try again</li>}
          {searchSource === 'Wikipedia' && (
            <li className="search-note search-source">Landmarks only (Wikipedia). Add a MapTiler key to find any bar, shop or address.</li>
          )}
        </ul>
      )}
    </div>
  );
}
