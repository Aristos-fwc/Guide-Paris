import L from 'leaflet';

// The map's look: every tile is turned grey, then each grey is remapped along a
// ramp from dark teal (#0e2a2e) through mint (#9fd3bd, water) to cream (#f3ead3,
// land) and off-white (roads). It is done once per tile on a canvas, instead of
// with a CSS/SVG filter over the whole map, which the browser had to recompute
// while panning and zooming. Regenerate the tables to change the palette.
const R = [0.055, 0.063, 0.071, 0.079, 0.088, 0.096, 0.104, 0.112, 0.120, 0.128, 0.137, 0.145, 0.153, 0.161, 0.169, 0.198, 0.241, 0.284, 0.326, 0.369, 0.412, 0.454, 0.497, 0.540, 0.583, 0.626, 0.699, 0.771, 0.844, 0.908, 0.940, 0.971, 1.000];
const G = [0.165, 0.182, 0.200, 0.218, 0.236, 0.253, 0.271, 0.289, 0.306, 0.324, 0.342, 0.359, 0.377, 0.395, 0.413, 0.443, 0.481, 0.520, 0.559, 0.597, 0.636, 0.675, 0.713, 0.752, 0.790, 0.828, 0.837, 0.846, 0.855, 0.870, 0.904, 0.946, 0.992];
const B = [0.180, 0.194, 0.207, 0.220, 0.234, 0.247, 0.260, 0.274, 0.287, 0.300, 0.314, 0.327, 0.341, 0.354, 0.367, 0.393, 0.428, 0.463, 0.498, 0.533, 0.568, 0.603, 0.638, 0.673, 0.708, 0.741, 0.738, 0.735, 0.732, 0.742, 0.803, 0.876, 0.957];

const lookup = (table, v) => {
  const p = v * (table.length - 1);
  const i = Math.min(Math.floor(p), table.length - 2);
  return table[i] + (table[i + 1] - table[i]) * (p - i);
};

// LUT[grey * 3 + channel]: the final colour for each of the 256 greys.
const LUT = new Uint8ClampedArray(256 * 3);
for (let g = 0; g < 256; g++) {
  const v = Math.min(1, Math.max(0, ((g / 255 - 0.5) * 1.05 + 0.5) * 0.99)); // slight contrast boost
  LUT[g * 3] = Math.round(lookup(R, v) * 255);
  LUT[g * 3 + 1] = Math.round(lookup(G, v) * 255);
  LUT[g * 3 + 2] = Math.round(lookup(B, v) * 255);
}

// Used if the tile server does not allow reading its pixels: plain grey tiles.
const FALLBACK_FILTER = 'grayscale(1) contrast(1.05)';

export const DuotoneLayer = L.TileLayer.extend({
  // Download (not draw) the tiles of the zoom levels around the current one for
  // the middle of the view, so that zooming in or out finds them in the browser
  // cache instead of waiting for the network. Called once the map is idle.
  prefetch(map) {
    this._prefetched = this._prefetched || new Set();
    const z = Math.round(map.getZoom());
    [[z + 1, -0.25], [z - 1, 0]].forEach(([zoom, pad]) => {
      if (zoom < (this.options.minZoom || 0) || zoom > this.options.maxZoom) return;
      const b = map.getBounds().pad(pad);
      const from = map.project(b.getNorthWest(), zoom).divideBy(256).floor();
      const to = map.project(b.getSouthEast(), zoom).divideBy(256).floor();
      for (let x = from.x; x <= to.x; x++) {
        for (let y = from.y; y <= to.y; y++) {
          const url = L.Util.template(this._url, { x, y, z: zoom, r: '' });
          if (this._prefetched.has(url)) continue;
          this._prefetched.add(url);
          const img = new Image();
          img.crossOrigin = 'anonymous'; // same mode as the real tiles, or the cache would not match
          img.src = url;
        }
      }
    });
    if (this._prefetched.size > 600) this._prefetched.clear();
  },

  createTile(coords, done) {
    const size = this.getTileSize();
    const tile = document.createElement('canvas');
    tile.width = size.x;
    tile.height = size.y;
    tile.setAttribute('role', 'presentation');

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    // Leaflet cancels a tile that scrolled away by setting its `src`: forward that to the download.
    Object.defineProperty(tile, 'src', { set() { img.onload = img.onerror = null; img.src = ''; } });
    img.onload = () => {
      const ctx = tile.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, size.x, size.y);
      try {
        const frame = ctx.getImageData(0, 0, size.x, size.y);
        const px = frame.data;
        for (let i = 0; i < px.length; i += 4) {
          const g = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) | 0;
          px[i] = LUT[g * 3];
          px[i + 1] = LUT[g * 3 + 1];
          px[i + 2] = LUT[g * 3 + 2];
        }
        ctx.putImageData(frame, 0, 0);
      } catch {
        tile.style.filter = FALLBACK_FILTER;
      }
      done(null, tile);
    };
    img.onerror = (e) => done(e, tile);
    img.src = this.getTileUrl(coords);
    return tile;
  },
});
