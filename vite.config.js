import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Link previews (Facebook, WhatsApp, Slack, X...) need absolute URLs, so the
// og:url / og:image tags can only be written once the site's address is known.
// Set VITE_SITE_URL (e.g. https://my-paris-guide.netlify.app) at build time.
function socialTags(siteUrl) {
  return {
    name: 'social-tags',
    transformIndexHtml() {
      if (!siteUrl) return [];
      const base = siteUrl.replace(/\/+$/, '');
      return [
        { property: 'og:url', content: base + '/' },
        { property: 'og:image', content: base + '/og-image.jpg' },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:image', content: base + '/og-image.jpg' },
      ].map((attrs) => ({ tag: 'meta', attrs, injectTo: 'head' }));
    },
  };
}

// Split vendor code into separate files so the browser downloads them in
// parallel and keeps them cached when only the app code changes.
function manualChunks(id) {
  if (!id.includes('node_modules')) return undefined;
  if (id.includes('leaflet')) return 'leaflet';
  if (id.includes('@supabase')) return 'supabase';
  if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler|@remix-run)\//.test(id)) return 'react';
  return undefined;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), socialTags(env.VITE_SITE_URL)],
    build: { rollupOptions: { output: { manualChunks } } },
  };
});
