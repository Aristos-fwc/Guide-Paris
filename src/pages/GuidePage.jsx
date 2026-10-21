import { Fragment, lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Hero from '../components/Hero.jsx';
import * as api from '../api.js';
import { useAuth } from '../auth.jsx';
import { useGuides } from '../guides.jsx';
import { friendly } from '../errors.js';
import { useTitle } from '../useTitle.js';
import { loadPseudo, savePseudo } from '../pseudo.js';
import { useRoute } from '../useRoute.js';
import { formatDistance, formatDuration } from '../routing.js';

const PlaceMap = lazy(() => import('../components/PlaceMap.jsx'));

// One themed guide: its places in order, on a map. The owner can edit the
// introduction, add places from the map's places, reorder and remove them.
export default function GuidePage() {
  const { guideId } = useParams();
  const { canManage } = useAuth();
  const { guides, loading: guidesLoading, error: guidesError, idsIn, updateGuide, addPlace, removePlace, movePlace, setOrder } = useGuides();
  const [places, setPlaces] = useState([]);
  const [placesLoading, setPlacesLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selId, setSelId] = useState(null);
  const [focus, setFocus] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: '', summary: '', author: '' });
  const [dragId, setDragId] = useState(null); // the stop being dragged
  const [overId, setOverId] = useState(null); // the stop it hovers
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);

  const guide = guides.find((g) => g.id === guideId);
  const canEdit = Boolean(guide) && canManage(guide.ownerId); // its creator, or the admin
  useTitle(guide ? guide.title : 'Guide');

  useEffect(() => {
    let alive = true;
    api.listPlaces()
      .then((p) => { if (alive) setPlaces(p); })
      .catch((e) => { if (alive) setError('Could not load the places. ' + friendly(e)); })
      .finally(() => { if (alive) setPlacesLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!canEdit) setEditing(false);
  }, [canEdit]);

  const ids = idsIn(guideId);
  const idsKey = ids.join(',');
  const stops = useMemo(() => ids.map((id) => places.find((p) => p.id === id)).filter(Boolean), [idsKey, places]); // eslint-disable-line react-hooks/exhaustive-deps
  const available = places.filter((p) => !ids.includes(p.id));
  // The walking route through the stops, in order: time and distance per leg and in total.
  const walk = useRoute(stops);

  async function run(label, fn) {
    setBusy(true);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(`Could not ${label}. ` + friendly(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveIntro(e) {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) return;
    const author = form.author.trim();
    if (await run('save the guide', () => updateGuide(guideId, { title, summary: form.summary.trim(), author }))) {
      savePseudo(author);
      setEditing(false);
    }
  }

  async function add() {
    if (!pick) return;
    if (await run('add the place', () => addPlace(guideId, pick))) setPick('');
  }

  // Dropping a stop on another puts it in that position.
  function dropOn(targetId) {
    const from = stops.findIndex((p) => p.id === dragId);
    const to = stops.findIndex((p) => p.id === targetId);
    setDragId(null);
    setOverId(null);
    if (from < 0 || to < 0 || from === to) return;
    const order = stops.map((p) => p.id);
    order.splice(to, 0, order.splice(from, 1)[0]);
    run('reorder the places', () => setOrder(guideId, order));
  }

  function show(place) {
    setSelId(place.id);
    setFocus({ lat: place.lat, lng: place.lng, key: Date.now() });
  }

  function pinClicked(id) {
    setSelId(id);
    document.getElementById('stop-' + id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  const loading = guidesLoading || placesLoading;
  const shownError = error || (guidesError && 'Could not load the guide. ' + friendly(guidesError));

  return (
    <div style={{ background: '#fff', color: 'var(--color-text)' }}>
      <Hero short lines={[guide ? guide.title : 'Guide', ': Paris']}>
        <Link to="/guides" className="back-link"><span aria-hidden="true">←</span> All guides</Link>
      </Hero>

      <main className="guides">
        {shownError && (
          <div className="notice" role="alert">
            <span>{shownError}</span>
            <button className="btn btn-ghost" onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {loading ? (
          <p className="comments-empty">Loading the guide…</p>
        ) : !guide ? (
          <p className="comments-empty">This guide does not exist. <Link to="/guides">See all guides</Link>.</p>
        ) : (
          <>
            {editing ? (
              <form className="guide-intro-form" onSubmit={saveIntro}>
                <div className="field">
                  <label htmlFor="g-title">Title</label>
                  <input id="g-title" className="input" maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="g-author">Your pseudo <span className="text-muted">(shown as the author)</span></label>
                  <input id="g-author" className="input" maxLength={40} value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder="Anonymous" />
                </div>
                <div className="field">
                  <label htmlFor="g-summary">Short introduction</label>
                  <textarea id="g-summary" className="input" maxLength={500} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="What is this guide about?" />
                </div>
                <div className="guide-actions">
                  <button className="btn btn-primary" type="submit" disabled={busy || !form.title.trim()}>{busy ? 'Saving…' : 'Save'}</button>
                  <button className="btn btn-secondary" type="button" onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </form>
            ) : (
              <div className="guides-head">
                <div>
                  {(guide.author || guide.ownerId) && <p className="guide-byline">By {guide.author || 'Anonymous'}</p>}
                  <p className="guides-intro">{guide.summary || (canEdit ? 'No introduction yet.' : '')}</p>
                </div>
                {canEdit && (
                  <button className="btn btn-secondary" onClick={() => { setForm({ title: guide.title, summary: guide.summary || '', author: guide.author || loadPseudo() }); setEditing(true); }}>Edit guide</button>
                )}
              </div>
            )}

            {canEdit && (
              <div className="guide-add">
                <label htmlFor="guide-pick">Add a place to this guide</label>
                <div className="guide-add-row">
                  <select id="guide-pick" className="input" value={pick} onChange={(e) => setPick(e.target.value)} disabled={!available.length}>
                    <option value="">{available.length ? 'Choose a place…' : places.length ? 'Every place is already in this guide' : 'No places on the map yet'}</option>
                    {available.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.cat})</option>)}
                  </select>
                  <button className="btn btn-primary" onClick={add} disabled={!pick || busy}>Add</button>
                </div>
                <p className="text-muted guide-add-hint">New place? Search it on the <Link to="/map">map</Link>, then add it to a guide from its panel.</p>
              </div>
            )}

            {stops.length > 1 && (
              <div className="guide-route" aria-live="polite">
                <span className="guide-route-label">Walking itinerary</span>
                {walk ? (
                  <>
                    <span className="guide-route-total">{walk.estimated ? '≈ ' : ''}{formatDuration(walk.seconds)}</span>
                    <span className="guide-route-detail">
                      {formatDistance(walk.metres)} · {stops.length} stops
                      {walk.estimated && ' · estimate (street routing unavailable)'}
                    </span>
                  </>
                ) : (
                  <span className="guide-route-detail">Calculating the walk…</span>
                )}
                {canEdit && <span className="guide-route-hint">Drag the ⠿ handles or use ↑ ↓ to change the order: times update.</span>}
              </div>
            )}

            {stops.length === 0 ? (
              <p className="comments-empty">No places in this guide yet.</p>
            ) : (
              <div className="layout guide-layout">
                <div className="map-col">
                  <Suspense fallback={<div className="map-skeleton" aria-label="Loading the map" />}>
                    <PlaceMap places={stops} selectedId={selId} focus={focus} fit route routeLine={walk?.line} onSelect={pinClicked} />
                  </Suspense>
                </div>
                <ol className="guide-stops">
                  {stops.map((p, i) => (
                    <Fragment key={p.id}>
                    {i > 0 && (
                      <li className="stop-leg">
                        <span className="stop-leg-arrow" aria-hidden="true">↓</span>
                        <div className="stop-leg-body">
                          {walk ? (
                            <>
                              <span className="stop-leg-time">
                                {walk.estimated ? '≈ ' : ''}{formatDuration(walk.legs[i - 1].seconds)} on foot <span className="text-muted">· {formatDistance(walk.legs[i - 1].metres)}</span>
                              </span>
                              {walk.legs[i - 1].via && <span className="stop-leg-via">via {walk.legs[i - 1].via}</span>}
                              {walk.legs[i - 1].steps && (
                                <details className="stop-leg-steps">
                                  <summary>Directions</summary>
                                  <ol>
                                    {walk.legs[i - 1].steps.map((s, n) => (
                                      <li key={n}>
                                        {s.text}
                                        {s.metres >= 20 && <span className="text-muted"> · {formatDistance(s.metres)}</span>}
                                        {s.via && <span className="text-muted"> · via {s.via}</span>}
                                      </li>
                                    ))}
                                  </ol>
                                  <p className="stop-leg-note">A rough guide to the way, not turn-by-turn navigation.</p>
                                </details>
                              )}
                            </>
                          ) : <span className="text-muted">…</span>}
                        </div>
                      </li>
                    )}
                    <li
                      id={'stop-' + p.id}
                      className={'stop' + (p.id === selId ? ' on' : '') + (dragId === p.id ? ' dragging' : '') + (overId === p.id && dragId !== p.id ? ' over' : '')}
                      draggable={canEdit && !busy}
                      onDragStart={(e) => { setDragId(p.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', p.id); }}
                      onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverId(p.id); } }}
                      onDrop={(e) => { e.preventDefault(); dropOn(p.id); }}
                      onDragEnd={() => { setDragId(null); setOverId(null); }}
                    >
                      <div className="stop-side">
                        <span className="stop-num">{i + 1}</span>
                        {canEdit && <span className="stop-grip" aria-hidden="true" title="Drag to reorder">⠿</span>}
                      </div>
                      <div className="stop-body">
                        {p.image && <div className="stop-photo grayscale"><img src={p.image} alt={p.name} loading="lazy" draggable={false} /></div>}
                        {p.imageCredit && (
                          <div className="photo-credit">Photo: <a href={p.imageCreditUrl || undefined} target="_blank" rel="noopener noreferrer">{p.imageCredit}</a></div>
                        )}
                        <div className="detail-cat">{p.cat}</div>
                        <h3 className="stop-name">{p.name}</h3>
                        {p.address && <div className="text-muted stop-address">{p.address}</div>}
                        {p.note && <p className="stop-note">{p.note}</p>}
                        <div className="guide-actions">
                          <button className="btn btn-ghost" onClick={() => show(p)}>Show on map</button>
                          {canEdit && (
                            <>
                              <button className="btn btn-ghost" aria-label={`Move ${p.name} up`} disabled={busy || i === 0} onClick={() => run('move the place', () => movePlace(guideId, p.id, -1))}>↑</button>
                              <button className="btn btn-ghost" aria-label={`Move ${p.name} down`} disabled={busy || i === stops.length - 1} onClick={() => run('move the place', () => movePlace(guideId, p.id, 1))}>↓</button>
                              <button className="btn btn-ghost" onClick={() => run('remove the place', () => removePlace(guideId, p.id))}>Remove from guide</button>
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                    </Fragment>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
