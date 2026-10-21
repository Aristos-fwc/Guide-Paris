// Data layer. Uses Supabase when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
// are set; otherwise falls back to localStorage (storage.js) so `npm run dev`
// works with no setup. Every function is async either way.
import { createClient } from '@supabase/supabase-js';
import * as local from './storage.js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const BUCKET = 'place-images';

export const usingSupabase = Boolean(URL && KEY);
const sb = usingSupabase ? createClient(URL, KEY) : null;

// A place can have several photos (table place_photos); the site shows the cover,
// the one with the lowest position.
const PLACE_COLUMNS = '*, place_photos(id, url, credit, credit_url, position)';

const fromRow = (r) => {
  const cover = [...(r.place_photos || [])].sort((a, b) => a.position - b.position)[0];
  return {
    id: r.id, name: r.name, cat: r.cat, note: r.note, lat: r.lat, lng: r.lng,
    address: r.address || null,
    ownerId: r.owner_id ?? null, // who created it (null: the site owner's older places)
    image: cover?.url || null,
    imageCredit: cover?.credit || null,
    imageCreditUrl: cover?.credit_url || null,
  };
};

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Could not read the image.'));
    r.readAsDataURL(blob);
  });
}

// Best effort: a leftover file in the bucket is harmless, so never throw.
async function removeFile(url) {
  if (!url) return;
  const marker = `/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return;
  const path = decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
  try { await sb.storage.from(BUCKET).remove([path]); } catch { /* ignore */ }
}

export async function listPlaces() {
  // A photo the owner uploaded (stored separately) wins over one found automatically.
  if (!usingSupabase) return local.loadPlaces().map((p) => ({ ...p, image: local.loadImage(p.id) || p.image || null }));
  const { data, error } = await sb.from('places').select(PLACE_COLUMNS).order('created_at', { ascending: true });
  if (error) throw error;
  return data.map(fromRow);
}

// The saved categories plus any a place uses that isn't listed.
export const withUsedCategories = (cats, places) => [...cats, ...new Set(places.map((p) => p.cat).filter((c) => !cats.includes(c)))];

export async function listCategories(places = []) {
  if (!usingSupabase) return local.loadCats(places);
  const { data, error } = await sb.from('categories').select('name').order('created_at', { ascending: true });
  if (error) throw error;
  const base = data.length ? data.map((r) => r.name) : local.DEFAULT_CATS;
  return withUsedCategories(base, places);
}

// `allCats` is the full list including the new one (the local backend stores
// the whole list; Supabase only needs the new name).
export async function addCategory(name, allCats) {
  if (!usingSupabase) return local.saveCats(allCats);
  const { error } = await sb.from('categories').upsert({ name }, { onConflict: 'name', ignoreDuplicates: true });
  if (error) throw error;
}

// image / imageCredit / imageCreditUrl: an automatically found photo (an
// external URL, credited), or null.
export async function createPlace({ name, cat, note, lat, lng, address = null, image = null, imageCredit = null, imageCreditUrl = null }) {
  if (!usingSupabase) {
    const p = { id: 'n' + Date.now(), name, cat, note, lat, lng, address, image, imageCredit, imageCreditUrl };
    local.savePlaces([...local.loadPlaces(), p]);
    return p;
  }
  const { data, error } = await sb.from('places').insert({ name, cat, note, lat, lng, address }).select().single();
  if (error) throw error;
  let photos = [];
  if (image) {
    const photo = { place_id: data.id, url: image, credit: imageCredit, credit_url: imageCreditUrl, source: imageCredit ? 'wikimedia' : 'upload', position: 1 };
    const res = await sb.from('place_photos').insert(photo).select('id, url, credit, credit_url, position');
    // A photo is a nicety: if it fails the place is still saved, and one can be added later.
    if (!res.error) photos = res.data;
  }
  return fromRow({ ...data, place_photos: photos });
}

// patch: any of { name, cat, note }.
export async function updatePlace(place, patch) {
  if (!usingSupabase) {
    local.savePlaces(local.loadPlaces().map((p) => (p.id === place.id ? { ...p, ...patch } : p)));
    return;
  }
  const { error } = await sb.from('places').update(patch).eq('id', place.id);
  if (error) throw error;
}

export async function removePlace(place) {
  if (!usingSupabase) {
    local.savePlaces(local.loadPlaces().filter((p) => p.id !== place.id));
    local.saveGuidePlaces(local.loadGuidePlaces().filter((l) => l.placeId !== place.id));
    local.saveImage(place.id, null);
    return;
  }
  const { error } = await sb.from('places').delete().eq('id', place.id);
  if (error) throw error;
  await removeFile(place.image);
}

// blob = new JPEG, or null to clear. Resolves to the new image URL (or null).
export async function setPlaceImage(place, blob) {
  if (!usingSupabase) {
    const dataUrl = blob ? await blobToDataUrl(blob) : null;
    if (!local.saveImage(place.id, dataUrl)) throw new Error('Browser storage is full.');
    // Replacing or clearing the photo also drops the automatic one and its credit.
    local.savePlaces(local.loadPlaces().map((p) => (p.id === place.id ? { ...p, image: null, imageCredit: null, imageCreditUrl: null } : p)));
    return dataUrl;
  }
  let url = null;
  let path = null;
  if (blob) {
    // Fresh name each time so browsers and the CDN never serve a stale photo.
    // Inside the user's own folder: that is the only place a non-admin may write (see the migration).
    const { data: { session } } = await sb.auth.getSession();
    path = `${session?.user?.id}/${place.id}-${Date.now()}.jpg`;
    const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
    if (error) throw error;
    url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }
  // Add the new photo first and drop the old ones after, so a failure never leaves the place with none.
  let newId = null;
  if (url) {
    const res = await sb.from('place_photos').insert({ place_id: place.id, url, source: 'upload', position: 1 }).select('id').single();
    if (res.error) { await removeFile(url); throw res.error; }
    newId = res.data.id;
  }
  let del = sb.from('place_photos').delete().eq('place_id', place.id);
  if (newId) del = del.neq('id', newId);
  const { error } = await del;
  if (error) throw error;
  await removeFile(place.image);
  return url;
}

const commentFromRow = (r) => ({ id: r.id, author: r.author, body: r.body, createdAt: r.created_at });

// Newest first, capped at 100.
export async function listComments() {
  if (!usingSupabase) return local.loadComments();
  const { data, error } = await sb.from('comments').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return data.map(commentFromRow);
}

export async function addComment({ author, body }) {
  if (!usingSupabase) {
    const c = { id: 'c' + Date.now(), author, body, createdAt: new Date().toISOString() };
    local.saveComments([c, ...local.loadComments()]);
    return c;
  }
  const { data, error } = await sb.from('comments').insert({ author, body }).select().single();
  if (error) throw error;
  return commentFromRow(data);
}

// ── Guides ──────────────────────────────────────────────────────────────────
const guideFromRow = (g) => ({ id: g.id, title: g.title, summary: g.summary || '', author: g.author_name || '', ownerId: g.owner_id ?? null });

// The site says "author", the table says author_name.
const guideColumns = ({ author, ...rest }) => (author === undefined ? rest : { ...rest, author_name: author || null });

export async function listGuides() {
  if (!usingSupabase) return local.loadGuides();
  const { data, error } = await sb.from('guides').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return data.map(guideFromRow);
}

export async function createGuide(title, author = '') {
  if (!usingSupabase) {
    const g = { id: 'g' + Date.now(), title, summary: '', author };
    local.saveGuides([...local.loadGuides(), g]);
    return g;
  }
  const { data, error } = await sb.from('guides').insert(guideColumns({ title, author })).select().single();
  if (error) throw error;
  return guideFromRow(data);
}

// patch: any of { title, summary, author }.
export async function updateGuide(id, patch) {
  if (!usingSupabase) {
    local.saveGuides(local.loadGuides().map((g) => (g.id === id ? { ...g, ...patch } : g)));
    return;
  }
  const { error } = await sb.from('guides').update(guideColumns(patch)).eq('id', id);
  if (error) throw error;
}

export async function removeGuide(id) {
  if (!usingSupabase) {
    local.saveGuides(local.loadGuides().filter((g) => g.id !== id));
    local.saveGuidePlaces(local.loadGuidePlaces().filter((l) => l.guideId !== id));
    return;
  }
  const { error } = await sb.from('guides').delete().eq('id', id);
  if (error) throw error;
}

// ── Editable text pages ("About us") ────────────────────────────────────────
// Resolves to { title, body }, or null when the page was never written (or the
// table does not exist yet): the site then shows its default text.
export async function getPage(slug) {
  if (!usingSupabase) return local.loadPage(slug);
  const { data, error } = await sb.from('site_pages').select('title,body').eq('slug', slug).maybeSingle();
  if (error) return null;
  return data;
}

export async function savePage(slug, { title, body }) {
  if (!usingSupabase) {
    local.savePage(slug, { title, body });
    return;
  }
  const { error } = await sb.from('site_pages').upsert({ slug, title, body }, { onConflict: 'slug' });
  if (error) throw error;
}

// ── Owner login (Supabase Auth). Only used when Supabase is configured. ────
export async function getSession() {
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}

export function onAuthChange(callback) {
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function signIn(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

// Resolves to { needsConfirmation }: true when the project asks for the email to be confirmed first.
export async function signUp(email, password) {
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw error;
  return { needsConfirmation: !data.session };
}

export async function signOut() {
  if (sb) await sb.auth.signOut();
}

// True only when the logged-in user's email is in the site_owners table (the admin).
export async function checkOwner() {
  const { data, error } = await sb.rpc('is_owner');
  return !error && data === true;
}

// ── Which places are in which guide ─────────────────────────────────────────
// A link is { guideId, placeId, position }; position orders a guide's places.
export async function listGuidePlaces() {
  if (!usingSupabase) return local.loadGuidePlaces();
  const { data, error } = await sb.from('guide_places').select('guide_id,place_id,position').order('position', { ascending: true });
  if (error) throw error;
  return data.map((r) => ({ guideId: r.guide_id, placeId: r.place_id, position: r.position }));
}

export async function addPlaceToGuide(guideId, placeId, position) {
  if (!usingSupabase) {
    local.saveGuidePlaces([...local.loadGuidePlaces(), { guideId, placeId, position }]);
    return;
  }
  const { error } = await sb.from('guide_places').insert({ guide_id: guideId, place_id: placeId, position });
  if (error) throw error;
}

export async function removePlaceFromGuide(guideId, placeId) {
  if (!usingSupabase) {
    local.saveGuidePlaces(local.loadGuidePlaces().filter((l) => !(l.guideId === guideId && l.placeId === placeId)));
    return;
  }
  const { error } = await sb.from('guide_places').delete().eq('guide_id', guideId).eq('place_id', placeId);
  if (error) throw error;
}

// placeIds: the guide's places in their new order (positions become 1, 2, 3...).
export async function reorderGuidePlaces(guideId, placeIds) {
  if (!usingSupabase) {
    const others = local.loadGuidePlaces().filter((l) => l.guideId !== guideId);
    local.saveGuidePlaces([...others, ...placeIds.map((placeId, i) => ({ guideId, placeId, position: i + 1 }))]);
    return;
  }
  const rows = placeIds.map((placeId, i) => ({ guide_id: guideId, place_id: placeId, position: i + 1 }));
  const { error } = await sb.from('guide_places').upsert(rows, { onConflict: 'guide_id,place_id' });
  if (error) throw error;
}
