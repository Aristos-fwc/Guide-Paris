import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as api from './api.js';

// The guides and which places each one contains, loaded once and shared by the
// map page (add a place to a guide), the guides list and each guide's page.
// Actions save first and update the screen after; they throw if saving fails.
const GuidesContext = createContext(null);

export function GuidesProvider({ children }) {
  const [guides, setGuides] = useState([]);
  const [links, setLinks] = useState([]); // [{ guideId, placeId, position }]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // The latest links, readable inside async actions that run several in a row.
  const linksRef = useRef(links);
  const setAllLinks = useCallback((next) => { linksRef.current = next; setLinks(next); }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([api.listGuides(), api.listGuidePlaces()])
      .then(([g, l]) => { if (alive) { setGuides(g); setAllLinks(l); } })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [setAllLinks]);

  const createGuide = useCallback(async (title, author) => {
    const g = await api.createGuide(title, author);
    setGuides((gs) => [...gs, g]);
    return g;
  }, []);

  const updateGuide = useCallback(async (id, patch) => {
    await api.updateGuide(id, patch);
    setGuides((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }, []);

  const removeGuide = useCallback(async (id) => {
    await api.removeGuide(id);
    setGuides((gs) => gs.filter((g) => g.id !== id));
    setAllLinks(linksRef.current.filter((l) => l.guideId !== id));
  }, [setAllLinks]);

  // A place's ids in a guide, in order.
  const orderedIds = useCallback((guideId) => linksRef.current
    .filter((l) => l.guideId === guideId)
    .sort((a, b) => a.position - b.position)
    .map((l) => l.placeId), []);

  const addPlace = useCallback(async (guideId, placeId) => {
    if (linksRef.current.some((l) => l.guideId === guideId && l.placeId === placeId)) return;
    const position = 1 + Math.max(0, ...linksRef.current.filter((l) => l.guideId === guideId).map((l) => l.position));
    await api.addPlaceToGuide(guideId, placeId, position);
    setAllLinks([...linksRef.current, { guideId, placeId, position }]);
  }, [setAllLinks]);

  const removePlace = useCallback(async (guideId, placeId) => {
    await api.removePlaceFromGuide(guideId, placeId);
    setAllLinks(linksRef.current.filter((l) => !(l.guideId === guideId && l.placeId === placeId)));
  }, [setAllLinks]);

  // The whole itinerary at once: placeIds in their new order.
  const setOrder = useCallback(async (guideId, placeIds) => {
    await api.reorderGuidePlaces(guideId, placeIds);
    setAllLinks([
      ...linksRef.current.filter((l) => l.guideId !== guideId),
      ...placeIds.map((id, n) => ({ guideId, placeId: id, position: n + 1 })),
    ]);
  }, [setAllLinks]);

  // delta -1 moves a place up the guide, +1 down.
  const movePlace = useCallback(async (guideId, placeId, delta) => {
    const ids = orderedIds(guideId);
    const i = ids.indexOf(placeId);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await setOrder(guideId, ids);
  }, [orderedIds, setOrder]);

  // A place was deleted: the database drops its links itself, just refresh the screen.
  const forgetPlace = useCallback((placeId) => {
    setAllLinks(linksRef.current.filter((l) => l.placeId !== placeId));
  }, [setAllLinks]);

  const value = useMemo(() => ({
    guides, links, loading, error,
    createGuide, updateGuide, removeGuide, addPlace, removePlace, movePlace, setOrder, forgetPlace,
    idsIn: (guideId) => links.filter((l) => l.guideId === guideId).sort((a, b) => a.position - b.position).map((l) => l.placeId),
    guidesOf: (placeId) => guides.filter((g) => links.some((l) => l.guideId === g.id && l.placeId === placeId)),
  }), [guides, links, loading, error, createGuide, updateGuide, removeGuide, addPlace, removePlace, movePlace, setOrder, forgetPlace]);

  return <GuidesContext.Provider value={value}>{children}</GuidesContext.Provider>;
}

export function useGuides() {
  return useContext(GuidesContext);
}
