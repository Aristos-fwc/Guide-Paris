// Place search for the "add a place" field. Only places: never streets, towns,
// postcodes or historical events.
//  - With VITE_MAPTILER_KEY: MapTiler Geocoding (OpenStreetMap data): points of
//    interest (monuments, museums, bars, shops, stations...) plus Paris neighbourhoods.
//  - Without a key: Wikipedia, which only knows notable places but works with
//    no setup.
// Every result: { id, name, label, lat, lng, photoFile?, wikidata? }.
import { PARIS, searchWikipedia } from './wikipedia.js';
import { normaliseAreas, normaliseMapTiler, norm } from './maptiler.js';

const KEY = import.meta.env.VITE_MAPTILER_KEY;

export const searchSource = KEY ? 'MapTiler' : 'Wikipedia';
export const MIN_CHARS = 3; // suggestions start from this many letters

// Greater Paris (Ile-de-France): west, south, east, north
const BBOX = '1.4,48.1,3.6,49.3';

async function geocode(query, types, limit, signal) {
  const params = new URLSearchParams({
    key: KEY,
    types,
    language: 'fr,en',
    bbox: BBOX,
    proximity: `${PARIS.lng},${PARIS.lat}`, // rank results near central Paris first
    limit: String(limit),
    autocomplete: 'true',
  });
  const res = await fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?${params}`, { signal });
  if (!res.ok) throw new Error('Place search failed (' + res.status + ').');
  return (await res.json()).features;
}

// Two searches at once: points of interest (monuments, museums, bars, shops, stations...;
// extra are asked for because bus stops and offices are dropped afterwards), and the
// named neighbourhoods of Paris. A neighbourhood that matches what was typed comes first.
async function searchMapTiler(query, signal) {
  const [pois, areas] = await Promise.all([
    geocode(query, 'poi', 10, signal),
    geocode(query, 'place,locality,neighbourhood', 6, signal).catch((e) => { if (e.name === 'AbortError') throw e; return []; }),
  ]);
  const places = normaliseMapTiler(pois);
  const q = norm(query);
  // Keep only areas whose name really matches what was typed (the geocoder also returns loose matches).
  const named = normaliseAreas(areas).filter((a) => (norm(a.name).includes(q) || q.includes(norm(a.name))) && !places.some((p) => norm(p.name) === norm(a.name)));
  const exact = named.filter((a) => norm(a.name).startsWith(q));
  const others = named.filter((a) => !exact.includes(a));
  return [...exact, ...places, ...others].slice(0, 8);
}

export function searchPlaces(query, signal) {
  return KEY ? searchMapTiler(query, signal) : searchWikipedia(query, signal);
}
