// Front-end only for now: places and categories persist in localStorage.
// Swap these functions for API calls when a backend exists.

export const DEFAULT_CATS = ['Restaurants', 'Bars', 'Museums', 'Shops', 'Parks'];

export const DEFAULT_PLACES = [
  { id: 'd1', name: 'Musée Rodin', cat: 'Museums', note: 'Sculpture garden, quiet.', lat: 48.8553, lng: 2.3158 },
  { id: 'd2', name: 'Buttes-Chaumont', cat: 'Parks', note: 'Sunset from the belvedere.', lat: 48.8809, lng: 2.3828 },
  { id: 'd3', name: 'Le Syndicat', cat: 'Bars', note: 'French spirits only.', lat: 48.8725, lng: 2.3532 },
];

const PLACES_KEY = 'parisguide.places';
const CATS_KEY = 'parisguide.cats';

function read(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

export function loadPlaces() {
  const saved = read(PLACES_KEY);
  return Array.isArray(saved) && saved.length ? saved : DEFAULT_PLACES;
}

export function savePlaces(places) {
  write(PLACES_KEY, places.length ? places : DEFAULT_PLACES);
}

// Saved categories, plus any category a saved place uses that isn't listed.
export function loadCats(places) {
  const saved = read(CATS_KEY);
  const base = Array.isArray(saved) ? saved : DEFAULT_CATS;
  const extra = places.map((p) => p.cat).filter((c) => !base.includes(c));
  return [...base, ...new Set(extra)];
}

export function saveCats(cats) {
  write(CATS_KEY, cats);
}

export function loadImage(id) {
  try { return localStorage.getItem('parisguide.img.' + id); } catch { return null; }
}

export function saveImage(id, dataUrl) {
  try {
    if (dataUrl) localStorage.setItem('parisguide.img.' + id, dataUrl);
    else localStorage.removeItem('parisguide.img.' + id);
    return true;
  } catch {
    return false;
  }
}

// Comments, newest first.
export function loadComments() {
  const saved = read('parisguide.comments');
  return Array.isArray(saved) ? saved : [];
}

export function saveComments(comments) {
  write('parisguide.comments', comments);
}

// Editable text pages ("About us"): { title, body } by slug, or null.
export function loadPage(slug) {
  const saved = read('parisguide.page.' + slug);
  return saved && typeof saved === 'object' ? saved : null;
}

export function savePage(slug, page) {
  write('parisguide.page.' + slug, page);
}

// Placeholder guides (titles only), used until the owner edits them.
export const DEFAULT_GUIDES = [
  { id: 'g1', title: 'Best Bakeries' },
  { id: 'g2', title: 'Hidden Gardens' },
  { id: 'g3', title: 'Jazz & Late Nights' },
  { id: 'g4', title: 'Rainy-Day Museums' },
  { id: 'g5', title: 'Vintage Shopping' },
  { id: 'g6', title: 'Cheap Eats' },
];

export function loadGuides() {
  const saved = read('parisguide.guides');
  return Array.isArray(saved) ? saved : DEFAULT_GUIDES;
}

export function saveGuides(guides) {
  write('parisguide.guides', guides);
}

// Which places are in which guide: [{ guideId, placeId, position }]. A couple
// of starter links so the guide pages are not empty in local mode.
const DEFAULT_GUIDE_PLACES = [
  { guideId: 'g2', placeId: 'd2', position: 1 },
  { guideId: 'g4', placeId: 'd1', position: 1 },
];

export function loadGuidePlaces() {
  const saved = read('parisguide.guideplaces');
  return Array.isArray(saved) ? saved : DEFAULT_GUIDE_PLACES;
}

export function saveGuidePlaces(rows) {
  write('parisguide.guideplaces', rows);
}
