// Finds a free-licensed photo of a place on Wikimedia Commons, plus the credit
// its licence requires. Never throws (a photo is optional) except on abort.
import { api, COMMONS, WIKIDATA, isUsablePhoto, similar } from './wikipedia.js';

const WIKI = 'https://fr.wikipedia.org/w/api.php';

const decode = (s) => s
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'");
const plain = (html) => decode((html || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

// 1. Wikidata's "image" property (P18), when we know the Wikidata id.
async function fileFromWikidata(id, signal) {
  const json = await api(WIKIDATA, { action: 'wbgetclaims', entity: id, property: 'P18' }, signal);
  return json.claims?.P18?.[0]?.mainsnak?.datavalue?.value || null;
}

// 2. Wikipedia articles within 150 m whose title matches the place's name.
async function fileFromNearbyArticle({ name, lat, lng }, signal) {
  const json = await api(WIKI, {
    action: 'query', generator: 'geosearch', ggscoord: `${lat}|${lng}`, ggsradius: '150', ggslimit: '10',
    prop: 'pageimages', piprop: 'name',
  }, signal);
  const pages = (json.query?.pages || []).sort((a, b) => a.index - b.index);
  const hit = pages.find((p) => p.pageimage && isUsablePhoto(p.pageimage) && similar(name, p.title));
  return hit ? hit.pageimage : null;
}

// Thumbnail URL + attribution for a Commons file.
async function commonsInfo(file, signal) {
  const json = await api(COMMONS, {
    action: 'query', titles: 'File:' + file.replace(/_/g, ' '), prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '640',
  }, signal);
  const page = json.query?.pages?.[0];
  const info = page && !page.missing ? page.imageinfo?.[0] : null;
  if (!info) return null; // not on Commons (e.g. a non-free local file): don't use it
  const meta = info.extmetadata || {};
  const author = plain(meta.Artist?.value).slice(0, 80);
  const license = plain(meta.LicenseShortName?.value);
  return {
    url: (info.thumburl || info.url).split('?')[0],
    credit: [author || 'Wikimedia Commons', license].filter(Boolean).join(' · '),
    creditUrl: info.descriptionurl || null,
  };
}

// place: { name, lat, lng, photoFile?, wikidata? } -> { url, credit, creditUrl } | null
export async function findPhoto(place, signal) {
  try {
    let file = null;
    if (place.photoFile) {
      file = isUsablePhoto(place.photoFile) ? place.photoFile : null; // search already picked the article
    } else {
      if (place.wikidata) file = await fileFromWikidata(place.wikidata, signal).catch((e) => { if (e.name === 'AbortError') throw e; return null; });
      if (!isUsablePhoto(file)) file = await fileFromNearbyArticle(place, signal);
    }
    return file ? await commonsInfo(file, signal) : null;
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    return null;
  }
}
