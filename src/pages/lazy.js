import { lazy } from 'react';

// Pages that aren't needed on first load are fetched on demand. The Guides
// loader is exported so the tab can warm it up before the user clicks.
export const loadGuidesPage = () => import('./GuidesPage.jsx');
export const GuidesPage = lazy(loadGuidesPage);
export const loadGuidePage = () => import('./GuidePage.jsx');
export const GuidePage = lazy(loadGuidePage);
export const LoginPage = lazy(() => import('./LoginPage.jsx'));
export const loadAboutPage = () => import('./AboutPage.jsx');
export const AboutPage = lazy(loadAboutPage);

// Lets the page transition wait for the destination's code while the screen is
// covered, so the reveal never lands on the "Loading…" fallback.
export function preloadRoute(path) {
  if (path === '/guides') return loadGuidesPage();
  if (path === '/about') return loadAboutPage();
  if (path.startsWith('/guides/')) return loadGuidePage();
  return Promise.resolve();
}
