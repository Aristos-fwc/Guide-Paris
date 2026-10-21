import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Hero from '../components/Hero.jsx';
import Toolbar from '../components/Toolbar.jsx';
import GuidesTab from '../components/GuidesTab.jsx';
import SideMenu from '../components/SideMenu.jsx';
import PlaceDetail from '../components/PlaceDetail.jsx';
import NewPlacePanel from '../components/NewPlacePanel.jsx';
import Comments from '../components/Comments.jsx';
import * as api from '../api.js';
import { findPhoto } from '../photo.js';
import { useAuth } from '../auth.jsx';
import { useGuides } from '../guides.jsx';
import { friendly } from '../errors.js';
import { useTitle } from '../useTitle.js';
import { metresBetween } from '../geo.js';

// Leaflet is the heaviest dependency: load it after the page has painted.
const PlaceMap = lazy(() => import('../components/PlaceMap.jsx'));

const DUPLICATE_METRES = 40;

export default function MapPage() {
  useTitle();
  const { canContribute, canManage, isAdmin } = useAuth();
  const { guides, links, addPlace: addToGuide, removePlace: removeFromGuide, forgetPlace } = useGuides();
  const [places, setPlaces] = useState([]);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selId, setSelId] = useState(null);
  const [filter, setFilter] = useState('All');
  // A place the owner picked from the search but has not saved yet:
  // { name, address, lat, lng, photo: { status: 'loading' | 'found' | 'none', url?, credit?, creditUrl? } }
  const [draft, setDraft] = useState(null);
  const [focus, setFocus] = useState(null); // asks the map to fly somewhere
  const [imageBusy, setImageBusy] = useState(false);
  const photoJob = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Both requests at once; the categories used by a place are merged in afterwards.
        const [ps, base] = await Promise.all([api.listPlaces(), api.listCategories()]);
        if (cancelled) return;
        setPlaces(ps);
        setCats(api.withUsedCategories(base, ps));
        setSelId(ps[0]?.id ?? null);
      } catch (e) {
        if (!cancelled) setError('Could not load the places. ' + friendly(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function stopPhotoLookup() {
    photoJob.current?.abort();
    photoJob.current = null;
  }
  useEffect(() => stopPhotoLookup, []);

  // Logging out (or losing the owner role) while adding a place cancels it.
  useEffect(() => {
    if (!canContribute) { stopPhotoLookup(); setDraft(null); }
  }, [canContribute]);

  // Stable references, so the map only updates its pins when something really changed.
  const visible = useMemo(() => places.filter((p) => filter === 'All' || p.cat === filter), [places, filter]);
  const draftPos = useMemo(() => (draft && canContribute ? { lat: draft.lat, lng: draft.lng } : null), [draft, canContribute]);
  const selected = places.find((p) => p.id === selId) || places[0] || null;
  // Guides this person may add places to: their own (every guide for the admin).
  const myGuides = useMemo(() => guides.filter((g) => canManage(g.ownerId)), [guides, canManage]);

  async function addCategory(text) {
    const t = text.trim();
    if (!t) return;
    const existing = cats.find((c) => c.toLowerCase() === t.toLowerCase());
    if (!existing) {
      try {
        await api.addCategory(t, [...cats, t]);
      } catch (e) {
        setError('Could not add the category. ' + friendly(e));
        return;
      }
      setCats((c) => [...c, t]);
    }
    setFilter(existing || t);
  }

  // A search suggestion was chosen: mark it on the map right away and look for
  // its photo in the background. Nothing is saved until the owner confirms.
  function pickPlace(r) {
    stopPhotoLookup();
    setFocus({ lat: r.lat, lng: r.lng, key: Date.now() });
    const dup = places.find((p) => metresBetween(p, r) < DUPLICATE_METRES);
    if (dup) {
      setDraft(null);
      setFilter('All');
      setSelId(dup.id);
      setError(`“${dup.name}” is already on the map.`);
      return;
    }
    setError(null);
    setDraft({ name: r.name, address: r.label || null, lat: r.lat, lng: r.lng, photo: { status: 'loading' } });
    const job = new AbortController();
    photoJob.current = job;
    findPhoto(r, job.signal)
      .then((photo) => setDraft((d) => d && (photoJob.current === job ? { ...d, photo: photo ? { status: 'found', ...photo } : { status: 'none' } } : d)))
      .catch(() => { /* aborted: a newer pick or a cancel replaced this one */ });
  }

  function cancelDraft() {
    stopPhotoLookup();
    setDraft(null);
  }

  async function savePlace({ name, cat, note, guideIds = [] }) {
    const { photo } = draft;
    const found = photo.status === 'found';
    try {
      const p = await api.createPlace({
        name: name.trim() || 'Untitled',
        cat,
        note,
        lat: draft.lat,
        lng: draft.lng,
        address: draft.address,
        image: found ? photo.url : null,
        imageCredit: found ? photo.credit : null,
        imageCreditUrl: found ? photo.creditUrl : null,
      });
      stopPhotoLookup();
      setPlaces((ps) => [...ps, p]);
      setSelId(p.id);
      setDraft(null);
      setFilter('All');
      // The place is saved; add it to the guides ticked in the panel, one by one.
      for (const guideId of guideIds) {
        try {
          await addToGuide(guideId, p.id);
        } catch (e) {
          setError('The place was saved, but adding it to a guide failed. ' + friendly(e));
          break;
        }
      }
    } catch (e) {
      setError('Could not save the place. ' + friendly(e));
    }
  }

  async function toggleGuide(guideId) {
    const inGuide = links.some((l) => l.guideId === guideId && l.placeId === selected.id);
    try {
      if (inGuide) await removeFromGuide(guideId, selected.id);
      else await addToGuide(guideId, selected.id);
    } catch (e) {
      setError('Could not update the guide. ' + friendly(e));
    }
  }

  async function updateSelected(patch) {
    try {
      await api.updatePlace(selected, patch);
      setPlaces((ps) => ps.map((p) => (p.id === selected.id ? { ...p, ...patch } : p)));
      return true;
    } catch (e) {
      setError('Could not save the changes. ' + friendly(e));
      return false;
    }
  }

  async function removeSelected() {
    if (!selected || !window.confirm(`Remove “${selected.name}”?`)) return;
    try {
      await api.removePlace(selected);
      forgetPlace(selected.id);
      const next = places.filter((p) => p.id !== selected.id);
      setPlaces(next);
      setSelId(next[0]?.id ?? null);
    } catch (e) {
      setError('Could not remove the place. ' + friendly(e));
    }
  }

  async function changeImage(blob) {
    const target = selected;
    setImageBusy(true);
    try {
      const url = await api.setPlaceImage(target, blob);
      // The owner's own photo replaces the automatic one, so its credit goes too.
      setPlaces((ps) => ps.map((p) => (p.id === target.id ? { ...p, image: url, imageCredit: null, imageCreditUrl: null } : p)));
    } catch (e) {
      setError('Could not save the photo. ' + friendly(e));
    } finally {
      setImageBusy(false);
    }
  }

  return (
    <div style={{ background: '#fff', color: 'var(--color-text)' }}>
      <SideMenu />
      <Hero />
      <section id="map" className="guide">
        {error && (
          <div className="notice" role="alert">
            <span>{error}</span>
            <button className="btn btn-ghost" onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}
        <Toolbar
          cats={cats}
          filter={filter}
          onFilter={setFilter}
          canAdd={canContribute}
          isAdmin={isAdmin}
          onAddCategory={addCategory}
          onPickPlace={pickPlace}
        />
        <div className="layout">
          <div className="map-col">
            <Suspense fallback={<div className="map-skeleton" aria-label="Loading the map" />}>
              <PlaceMap
                places={visible}
                selectedId={selected?.id}
                draft={draftPos}
                focus={focus}
                fitKey={filter}
                onSelect={(id) => { setSelId(id); }}
              />
            </Suspense>
            <GuidesTab />
          </div>
          {draft && canContribute ? (
            <NewPlacePanel
              key={draft.lat + ',' + draft.lng}
              draft={draft}
              cats={cats}
              guides={myGuides}
              defaultCat={filter !== 'All' ? filter : cats[0]}
              onSave={savePlace}
              onCancel={cancelDraft}
            />
          ) : (
            <PlaceDetail
              key={selected?.id}
              place={selected}
              loading={loading}
              canEdit={Boolean(selected) && canManage(selected.ownerId)}
              canGuide={canContribute}
              cats={cats}
              guides={guides}
              myGuides={myGuides}
              guideIds={selected ? links.filter((l) => l.placeId === selected.id).map((l) => l.guideId) : []}
              onToggleGuide={toggleGuide}
              imageBusy={imageBusy}
              onImage={changeImage}
              onError={setError}
              onRemove={removeSelected}
              onUpdate={updateSelected}
            />
          )}
        </div>
      </section>
      <Comments />
    </div>
  );
}
