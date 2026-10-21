import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { DuotoneLayer } from '../duotone.js';

const CENTER = [48.862, 2.345];

// With a MapTiler key (VITE_MAPTILER_KEY in .env) use MapTiler, which is meant
// for production sites. Without one, fall back to the public OpenStreetMap
// tiles: fine for development and light traffic, but not for a busy site.
const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;
const MAPTILER_STYLE = import.meta.env.VITE_MAPTILER_STYLE || 'dataviz';
const TILES = MAPTILER_KEY
  ? {
      url: `https://api.maptiler.com/maps/${MAPTILER_STYLE}/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
      attribution: '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }
  : {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    };

// Icons are shared: one per look (and per number, when the pins make up an itinerary).
const iconCache = new Map();
function iconFor(cls, n = null) {
  const key = cls + '|' + n;
  if (!iconCache.has(key)) {
    const size = n ? 28 : 20;
    iconCache.set(key, L.divIcon({
      className: '',
      html: `<div class="pin${cls}${n ? ' num' : ''}">${n ? `<span>${n}</span>` : ''}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    }));
  }
  return iconCache.get(key);
}
const DRAFT_ICON = iconFor(' draft');

// places: the pins to show. draft: { lat, lng } of a place being added (not saved yet).
// focus: { lat, lng, key } asks the map to fly somewhere.
// fit: zoom the map to show all `places` (when that set changes), for a guide's page.
// fitKey: zoom to show all `places` whenever this value changes (and once they have loaded).
// route: `places` are the stops of an itinerary, in order: numbered pins joined by a dotted line.
// routeLine: [[lat, lng]] the real walking path to draw instead of straight lines between the stops.
export default function PlaceMap({ places, selectedId, draft, focus, fit = false, fitKey = null, route = false, routeLine = null, onSelect }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const markers = useRef(new Map()); // place id -> { marker, place, on }
  const fitDone = useRef('');
  // Leaflet handlers are bound once; read the latest props through a ref.
  const live = useRef({});
  live.current = { onSelect };

  useEffect(() => {
    // zoomSnap 0: the zoom level may be fractional, so a pinch zooms smoothly.
    // scrollWheelZoom stays off so scrolling the page over the map still scrolls the page.
    // fadeAnimation off: a new tile appears at once instead of fading in over the blurry one it replaces.
    const map = L.map(elRef.current, { scrollWheelZoom: false, zoomSnap: 0, fadeAnimation: false }).setView(CENTER, 12);
    // keepBuffer: tiles just outside the view stay loaded, so a small pan or zoom back finds them ready.
    const tiles = new DuotoneLayer(TILES.url, { maxZoom: 19, attribution: TILES.attribution, keepBuffer: 4 }).addTo(map);
    let prefetchTimer = null;
    const schedulePrefetch = () => { clearTimeout(prefetchTimer); prefetchTimer = setTimeout(() => tiles.prefetch(map), 400); };
    map.on('moveend', schedulePrefetch);
    schedulePrefetch();
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Pinching on a trackpad reaches the browser as a wheel event with ctrlKey set
    // (so does Ctrl + scroll with a mouse). Use it to zoom the map, around the
    // pointer, instead of letting the browser zoom the whole page.
    const container = map.getContainer();
    let gesture = null; // { anchor, zoom, dy }: the pinch in progress
    let gestureTimer = null;
    const onWheel = (e) => {
      if (!e.ctrlKey) return; // a plain scroll is left to the page
      e.preventDefault();
      const point = map.mouseEventToContainerPoint(e);
      // Remember the place under the fingers when the pinch starts, and recompute from it at
      // every step: rounding errors then never add up, and that place stays under the fingers.
      if (!gesture) gesture = { anchor: map.containerPointToLatLng(point), zoom: map.getZoom(), dy: 0 };
      clearTimeout(gestureTimer);
      gestureTimer = setTimeout(() => { gesture = null; }, 200);

      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1; // lines / pages -> pixels
      gesture.dy += e.deltaY * unit;
      const zoom = Math.min(map.getMaxZoom(), Math.max(map.getMinZoom(), gesture.zoom - gesture.dy / 100));
      gesture.dy = (gesture.zoom - zoom) * 100; // stop counting past the limits, so reversing is immediate
      const centre = map.unproject(map.project(gesture.anchor, zoom).subtract(point.subtract(map.getSize().divideBy(2))), zoom);
      map.setView(centre, zoom, { animate: false });
    };
    container.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      clearTimeout(gestureTimer);
      clearTimeout(prefetchTimer);
      container.removeEventListener('wheel', onWheel);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      markers.current.clear();
      fitDone.current = ''; // a new map has to be fitted again
    };
  }, []);

  // Keep the pins in step with `places`: add, move or remove only the ones that
  // changed, and restyle only the selection, instead of rebuilding every pin.
  const draftOn = Boolean(draft);
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const known = markers.current;
    const keep = new Set();
    places.forEach((p, i) => {
      const n = route ? i + 1 : null;
      keep.add(p.id);
      const on = p.id === selectedId && !draftOn;
      let entry = known.get(p.id);
      if (entry && (entry.place.name !== p.name || entry.place.lat !== p.lat || entry.place.lng !== p.lng)) {
        layer.removeLayer(entry.marker);
        entry = null;
      }
      if (!entry) {
        const marker = L.marker([p.lat, p.lng], { icon: iconFor(on ? ' on' : '', n), title: p.name, zIndexOffset: on ? 500 : 0 })
          .on('click', () => live.current.onSelect(p.id))
          .addTo(layer);
        known.set(p.id, { marker, place: p, on, n });
      } else if (entry.on !== on || entry.n !== n) {
        entry.marker.setIcon(iconFor(on ? ' on' : '', n)).setZIndexOffset(on ? 500 : 0);
        entry.on = on;
        entry.n = n;
      }
    });
    known.forEach((entry, id) => {
      if (!keep.has(id)) { layer.removeLayer(entry.marker); known.delete(id); }
    });
    const key = fitKey !== null ? 'k:' + fitKey : fit ? places.map((p) => p.id).join(',') : null;
    if (key !== null && places.length) {
      if (key !== fitDone.current) {
        fitDone.current = key;
        mapRef.current.invalidateSize(); // the frame may have just got its size
        mapRef.current.fitBounds(L.latLngBounds(places.map((p) => [p.lat, p.lng])), { padding: [50, 50], maxZoom: 15 });
      }
    }
  }, [places, selectedId, draftOn, fit, fitKey, route]);

  // The itinerary line: a cream under-stroke so the dots show on any part of the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !route || places.length < 2) return undefined;
    const points = routeLine && routeLine.length > 1 ? routeLine : places.map((p) => [p.lat, p.lng]);
    const line = L.layerGroup([
      L.polyline(points, { color: '#f3ead3', weight: 8, opacity: 0.85, interactive: false }),
      L.polyline(points, { color: '#0e2a2e', weight: 3, dashArray: '1 8', lineCap: 'round', interactive: false }),
    ]).addTo(map);
    return () => { map.removeLayer(line); };
  }, [places, route, routeLine]);

  const draftLat = draft?.lat;
  const draftLng = draft?.lng;
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return undefined;
    if (draftLat == null) return undefined;
    const marker = L.marker([draftLat, draftLng], { icon: DRAFT_ICON, title: 'New place', zIndexOffset: 1000, interactive: false }).addTo(layer);
    return () => { layer.removeLayer(marker); };
  }, [draftLat, draftLng]);

  useEffect(() => {
    if (focus && mapRef.current) mapRef.current.flyTo([focus.lat, focus.lng], 16, { duration: 1 });
  }, [focus]);

  // Leaflet adds its own classes to the element it controls, and React would
  // overwrite them on re-render. So React only styles the outer frame, and
  // Leaflet gets an inner div that React never touches.
  return (
    <div className="map">
      <div ref={elRef} style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}
