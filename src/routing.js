// Walking time, distance and simple directions between the stops of a guide.
//
// Uses the public OpenStreetMap routing server (OSRM, "foot" profile): free, no
// key, calls allowed from the browser. It is meant for light use; for a busy
// site, host your own OSRM or use a paid routing API and change ROUTER below.
// If the server cannot be reached, a rough estimate is shown instead (straight
// line plus a detour allowance, at walking pace), and marked as an estimate.
import { metresBetween } from './geo.js';

const ROUTER = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/';
const DETOUR = 1.3;      // streets are longer than the straight line
const WALK_SPEED = 1.3;  // metres per second, about 4.7 km/h
const MAX_LINES = 5;     // directions per leg, before the arrival line

const cache = new Map(); // "lng,lat;lng,lat" -> result

// ── Simple directions ──────────────────────────────────────────────────────
// In Paris, OpenStreetMap maps pavements and crossings as separate paths, so the
// server's own turn-by-turn list has dozens of "turn left onto the walkway". We
// ignore it and rebuild the walk from its shape: the path is simplified into a
// few long straight stretches, each described by a compass direction, a length
// and the main streets it follows. Good for orientation, not for navigation.
const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const compass = (deg) => COMPASS[Math.round(deg / 45) % 8];

// [lng, lat] points -> [x, y] metres from the first point (x east, y north).
function toMetres(coords) {
  const [lng0, lat0] = coords[0];
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  return coords.map(([lng, lat]) => [(lng - lng0) * kx, (lat - lat0) * 110540]);
}

function distToSegment(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

// Douglas-Peucker: the indices of the points that matter, wiggles under `tol` metres dropped.
function simplify(pts, tol) {
  const keep = new Set([0, pts.length - 1]);
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let far = 0;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = distToSegment(pts[i], pts[a], pts[b]);
      if (d > far) { far = d; at = i; }
    }
    if (far > tol) { keep.add(at); stack.push([a, at], [at, b]); }
  }
  return [...keep].sort((x, y) => x - y);
}

const bearing = (a, b) => ((Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI + 360) % 360;

function turnWord(from, to) {
  const d = ((to - from + 540) % 360) - 180; // -180..180, positive = to the right
  const a = Math.abs(d);
  if (a < 25) return 'Continue';
  if (a < 65) return d > 0 ? 'Bear right' : 'Bear left';
  if (a < 135) return d > 0 ? 'Turn right' : 'Turn left';
  return 'Turn around';
}

// rawSteps: the server's steps for one leg (with geometry); legMetres: its length.
// Returns { steps: [{ text, metres, via }], via }.
function directions(rawSteps, legMetres, destination) {
  const coords = [];
  rawSteps.forEach((s) => (s.geometry?.coordinates || []).forEach((c) => {
    const last = coords[coords.length - 1];
    if (!last || last[0] !== c[0] || last[1] !== c[1]) coords.push(c);
  }));
  if (coords.length < 2) return null;

  const pts = toMetres(coords);
  const along = [0]; // distance walked at each point
  for (let i = 1; i < pts.length; i++) along.push(along[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));

  // Coarser and coarser, until the walk fits in a few stretches.
  let keep = [0, pts.length - 1];
  for (const tol of [40, 70, 110, 170, 260, 400, 600, 900]) {
    keep = simplify(pts, tol);
    if (keep.length - 1 <= MAX_LINES) break;
  }
  let segs = [];
  for (let k = 0; k < keep.length - 1; k++) {
    segs.push({ a: keep[k], b: keep[k + 1], bearing: bearing(pts[keep[k]], pts[keep[k + 1]]) });
  }
  // Two stretches almost in line are one.
  segs = segs.reduce((out, s) => {
    const prev = out[out.length - 1];
    if (prev && turnWord(prev.bearing, s.bearing) === 'Continue') {
      prev.b = s.b;
      prev.bearing = bearing(pts[prev.a], pts[prev.b]);
    } else {
      out.push({ ...s });
    }
    return out;
  }, []);
  segs.forEach((s) => { s.from = along[s.a]; s.to = along[s.b]; s.streets = new Map(); });

  // Which streets each stretch follows, from the server's named steps.
  const scale = legMetres ? along[along.length - 1] / legMetres : 1;
  const overall = new Map();
  let walked = 0;
  rawSteps.forEach((s) => {
    const mid = (walked + s.distance / 2) * scale;
    walked += s.distance;
    if (!s.name) return;
    const seg = segs.find((x) => mid <= x.to) || segs[segs.length - 1];
    seg.streets.set(s.name, (seg.streets.get(s.name) || 0) + s.distance);
    overall.set(s.name, (overall.get(s.name) || 0) + s.distance);
  });
  const top = (map, min) => [...map.entries()].filter(([, d]) => d >= min).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([n]) => n);

  const steps = segs.map((s, i) => {
    const dir = compass(s.bearing);
    const verb = i === 0 ? 'Head' : turnWord(segs[i - 1].bearing, s.bearing);
    return {
      text: i === 0 ? `Head ${dir}` : verb === 'Continue' ? `Continue ${dir}` : `${verb}, heading ${dir}`,
      metres: (s.to - s.from) / (scale || 1),
      via: top(s.streets, 50).join(', '),
    };
  });
  steps.push({ text: 'Arrive at ' + destination, metres: 0, via: '' });
  return { steps, via: top(overall, 100).join(', ') };
}

// points: [{ lat, lng, name? }] in visiting order (at least 2).
// Resolves to { legs: [{ metres, seconds, via?, steps? }], metres, seconds, line: [[lat, lng]], estimated }.
export async function walkingRoute(points, signal) {
  const key = points.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
  if (cache.has(key)) return cache.get(key);
  let result;
  try {
    const res = await fetch(`${ROUTER}${key}?overview=full&geometries=geojson&steps=true`, { signal });
    if (!res.ok) throw new Error('Routing failed (' + res.status + ').');
    const json = await res.json();
    const route = json.routes?.[0];
    if (json.code !== 'Ok' || !route || route.legs.length !== points.length - 1) throw new Error('No route.');
    result = {
      legs: route.legs.map((l, i) => {
        const leg = { metres: l.distance, seconds: l.duration };
        // Directions are a bonus: if building them fails, the times are still shown.
        try { Object.assign(leg, directions(l.steps, l.distance, points[i + 1].name || 'the next stop')); } catch { /* no directions */ }
        return leg;
      }),
      metres: route.distance,
      seconds: route.duration,
      line: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      estimated: false,
    };
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    result = estimate(points);
  }
  cache.set(key, result);
  return result;
}

function estimate(points) {
  const legs = [];
  for (let i = 1; i < points.length; i++) {
    const metres = metresBetween(points[i - 1], points[i]) * DETOUR;
    legs.push({ metres, seconds: metres / WALK_SPEED });
  }
  return {
    legs,
    metres: legs.reduce((a, l) => a + l.metres, 0),
    seconds: legs.reduce((a, l) => a + l.seconds, 0),
    line: null, // the map then joins the stops with straight lines
    estimated: true,
  };
}

// 42 -> "42 min", 3900 s -> "1 h 05"
export function formatDuration(seconds) {
  const min = Math.max(1, Math.round(seconds / 60));
  if (min < 60) return min + ' min';
  return Math.floor(min / 60) + ' h ' + String(min % 60).padStart(2, '0');
}

export function formatDistance(metres) {
  return metres < 1000 ? Math.round(metres / 10) * 10 + ' m' : (metres / 1000).toFixed(1) + ' km';
}
