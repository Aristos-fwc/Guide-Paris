// Wikipedia / Wikidata / Wikimedia Commons helpers. No API key needed, and the
// services allow browser calls (origin=*). Used for the no-key place search and
// for finding a free-licensed photo of a place.
const WIKI = 'https://fr.wikipedia.org/w/api.php';
export const COMMONS = 'https://commons.wikimedia.org/w/api.php';
export const WIKIDATA = 'https://www.wikidata.org/w/api.php';
export const PARIS = { lat: 48.8566, lng: 2.3522 };

export async function api(base, params, signal) {
  const url = base + '?' + new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params });
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Request failed (' + res.status + ')');
  return res.json();
}

// ── Name matching, so we never attach the photo of a neighbouring building ──
const STOP = new Set(['le', 'la', 'les', 'l', 'de', 'du', 'des', 'd', 'et', 'the', 'of', 'a', 'au', 'aux', 'en', 'sur', 'sous']);
const normalise = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = (s) => normalise(s).split(' ').filter((t) => t && !STOP.has(t));

// True when at least 75% of the words of the shorter name appear in the other.
export function similar(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.length || !B.length) return false;
  const [small, big] = A.length <= B.length ? [A, B] : [B, A];
  return small.filter((t) => big.includes(t)).length / small.length >= 0.75;
}

// Wikipedia's lead image is sometimes a logo, a map or a flag: not a photo of the place.
export function isUsablePhoto(file) {
  if (!file) return false;
  if (/\.(svg|gif|tiff?|pdf|ogv|webm)$/i.test(file)) return false;
  return !/(logo|pictogram|icon|plan[ _]|carte|map[ _]|blason|armoiries|coat[ _]of|flag|drapeau|sch[eé]ma|diagram|signal)/i.test(file);
}

// ── Only places ─────────────────────────────────────────────────────────────
// Wikipedia also has articles about events, wars, attacks, exhibitions and
// organisations, some with coordinates. We want somewhere you can go to.
const EVENT_WORDS = /(\bévénements?\b|\bévènements?\b|\bbataille|\bsiège\b|\bmassacre|\battentat|\binsurrection|\brévolution|\brévolte|\bjournée|\bexposition (universelle|internationale|coloniale)|\bexécution|\bmanifestation|\brafle|\bémeute|\bfusillade|\bcombats?\b|\bguerre|\btraité|\bconférence|\baffaire|\bprocès|\bélection|\bgrève|\bsemaine sanglante|\blibération de|\bcoup d'état|\bsalon (international|de l)|\bfestival|\bchampionnat|\btournoi|\bcourse\b|\bépidémie|\bcrue\b|\binondation|\bcatastrophe|\baccident|\bassassinat|\brépression|\bpillage|\bprise de|\bmutinerie|\bbombardement|\bévasion|\bcommune de paris|\bcongrès|\bmort de|\bdécès)/i;
const ORG_WORDS = /(organisation|association|syndicat|fédération|société|entreprise|parti politique|\bfilm\b|\balbum|\bsérie|émission|chaîne|journal|magazine|hebdomadaire|groupe de|fondation|institut)/i;
const PLACE_WORDS = /\b(rue|place|pont|avenue|boulevard|square|allée|quai|passage|jardin|parc|musée|église|stade|cimetière|palais|château)\b/i;

export function isPlaceLike(title, description = '') {
  if (EVENT_WORDS.test(title) || EVENT_WORDS.test(description)) return false;
  if (ORG_WORDS.test(description)) return false;
  // "Exposition de 1889", "Journée du 10 août 1792": a year in the title, unless it names a street or a square
  if (/\b(1[0-9]{3}|20[0-2][0-9])\b/.test(title) && !PLACE_WORDS.test(title)) return false;
  return true;
}

// Landmark search near Paris. Returns [{ id, name, label, lat, lng, photoFile }].
export async function searchWikipedia(query, signal) {
  const q = query
    .replace(/[^\p{L}\p{N}\s'’-]/gu, ' ')
    .replace(/(^|\s)-+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (q.length < 2) return [];
  const json = await api(WIKI, {
    action: 'query',
    generator: 'search',
    // trailing * = match words that merely start with what was typed
    gsrsearch: `${q}* nearcoord:25km,${PARIS.lat},${PARIS.lng}`,
    gsrlimit: '10',
    prop: 'coordinates|pageimages|description',
    piprop: 'name',
    colimit: '20',
  }, signal);
  const pages = (json.query?.pages || []).filter((p) => p.coordinates?.length).sort((a, b) => a.index - b.index);
  return pages
    .filter((p) => isPlaceLike(p.title, p.description))
    .slice(0, 6)
    .map((p) => ({
      id: 'wp:' + p.pageid,
      name: p.title,
      label: p.description || '',
      lat: p.coordinates[0].lat,
      lng: p.coordinates[0].lon,
      photoFile: p.pageimage || null,
    }));
}
