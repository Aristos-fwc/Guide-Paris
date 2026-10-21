// Turns MapTiler "poi" results into suggestions, keeping only real places a
// visitor could go to. Pure functions (no network, no env) so they can be tested.
//
// MapTiler POIs carry OpenStreetMap tags (properties.feature_tags): a museum is
// tourism=museum, a bar is amenity=bar, a bus stop is highway=bus_stop...

const KEEP_TOURISM = new Set(['attraction', 'museum', 'gallery', 'viewpoint', 'artwork', 'aquarium', 'zoo', 'theme_park', 'hotel']);
const KEEP_LEISURE = new Set(['park', 'garden', 'nature_reserve', 'stadium', 'square', 'water_park']);
const KEEP_MAN_MADE = new Set(['bridge', 'tower', 'obelisk', 'lighthouse', 'windmill', 'observatory']);
const KEEP_AMENITY = new Set([
  'restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'food_court', 'ice_cream', 'biergarten', 'nightclub',
  'theatre', 'cinema', 'arts_centre', 'events_venue', 'library', 'marketplace', 'place_of_worship', 'fountain', 'planetarium',
]);
// shop=* is kept, minus services that are not somewhere you "go to"
const SKIP_SHOP = new Set([
  'hairdresser', 'beauty', 'dry_cleaning', 'laundry', 'medical_supply', 'mobile_phone', 'telecommunication',
  'copyshop', 'travel_agency', 'locksmith', 'tailor', 'car', 'car_repair', 'car_parts', 'motorcycle',
]);
// For places with no tags at all, fall back on MapTiler's own categories
const KEEP_CATEGORIES = new Set([
  'cemetery', 'park', 'garden', 'museum', 'gallery', 'church', 'cathedral', 'chapel', 'mosque', 'synagogue',
  'temple', 'monument', 'castle', 'square', 'market', 'zoo', 'attraction',
]);

// A real train / metro station (Châtelet - Les Halles, Gare du Nord...), as opposed
// to a bus stop, a metro entrance or a platform.
const isStation = (t, categories) =>
  !t.highway && (t.railway === 'station' || t.public_transport === 'station' || categories.some((c) => c === 'railway station' || c === 'train station'));

export function isVisitorPlace(props = {}) {
  const t = props.feature_tags || {};
  if (isStation(t, props.categories || [])) return true;
  if (t.highway || t.public_transport || t.railway) return false; // bus stops, metro entrances, platforms
  if (t.tourism) return KEEP_TOURISM.has(t.tourism); // not information boards, apartments...
  if (t.historic) return true;
  if (t.leisure && KEEP_LEISURE.has(t.leisure)) return true;
  if (t.natural) return true;
  if (t.place === 'square') return true;
  if (t.man_made && KEEP_MAN_MADE.has(t.man_made)) return true;
  if (t.amenity) return KEEP_AMENITY.has(t.amenity); // not parking, banks, driving schools...
  if (t.shop) return !SKIP_SHOP.has(t.shop);
  return (props.categories || []).some((c) => KEEP_CATEGORIES.has(c));
}

// OpenStreetMap has many unnamed objects labelled just "Jardin" or "Musée"
const GENERIC = new Set(['jardin', 'jardins', 'musee', 'le musee', 'parc', 'square', 'eglise', 'chapelle', 'cafe', 'bar', 'restaurant', 'boulangerie', 'hotel', 'theatre', 'cinema', 'cimetiere']);

export const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function metres(a, b) {
  const rad = Math.PI / 180;
  const dx = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const dy = (b.lat - a.lat) * rad;
  return 6371000 * Math.hypot(dx, dy);
}

// features: MapTiler geocoding features -> [{ id, name, label, lat, lng, wikidata }]
export function normaliseMapTiler(features, max = 8) {
  const out = [];
  for (const f of features || []) {
    if (!(f.place_type || []).includes('poi')) continue;
    if (!isVisitorPlace(f.properties)) continue;
    const [lng, lat] = f.center || f.geometry?.coordinates || [];
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;
    const name = f.text || '';
    if (GENERIC.has(norm(name))) continue;
    const full = f.place_name || '';
    const r = {
      id: f.id,
      name,
      // the address part only: the name is already shown above it
      label: full.startsWith(name + ', ') ? full.slice(name.length + 2) : full,
      lat,
      lng,
      wikidata: f.properties?.wikidata || null,
    };
    // MapTiler often lists the same place twice (building + point): keep the first
    if (out.some((o) => norm(o.name) === norm(r.name) && metres(o, r) < 80)) continue;
    out.push(r);
    if (out.length >= max) break;
  }
  return out;
}

// Neighbourhoods and named areas of Paris ("Les Halles", "Montmartre", "République"),
// which are not points of interest in OpenStreetMap but are places people look for.
const AREA_TYPES = new Set(['place', 'locality', 'neighbourhood', 'suburb', 'quarter']);

export function normaliseAreas(features, max = 2) {
  const out = [];
  for (const f of features || []) {
    if (!(f.place_type || []).some((t) => AREA_TYPES.has(t))) continue;
    const full = f.place_name || '';
    if (!/(^|, )Paris, France$/.test(full)) continue; // Paris itself, not the suburbs
    const [lng, lat] = f.center || f.geometry?.coordinates || [];
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;
    const name = f.text || '';
    if (!name || GENERIC.has(norm(name))) continue;
    const r = { id: f.id, name, label: 'Quartier, Paris', lat, lng, wikidata: f.properties?.wikidata || null };
    if (out.some((o) => norm(o.name) === norm(r.name))) continue;
    out.push(r);
    if (out.length >= max) break;
  }
  return out;
}
