import { useEffect } from 'react';
import TransitionLink from './TransitionLink.jsx';
import { loadGuidesPage } from '../pages/lazy.js';

// Index tab hanging off the bottom edge of the map; pulls down on hover.
export default function GuidesTab() {
  // Fetch the Guides page code in the background so the click never waits for it.
  useEffect(() => {
    const idle = 'requestIdleCallback' in window;
    const handle = idle ? window.requestIdleCallback(loadGuidesPage) : setTimeout(loadGuidesPage, 1500);
    return () => (idle ? window.cancelIdleCallback(handle) : clearTimeout(handle));
  }, []);

  return (
    <TransitionLink to="/guides" label="Guides" className="guides-tab" onMouseEnter={loadGuidesPage} onFocus={loadGuidesPage}>
      <span className="guides-tab-label">Guides</span>
      <span className="guides-tab-sub">Themed guides to Paris</span>
      <svg className="guides-tab-arrow" width="26" height="14" viewBox="0 0 26 14" fill="none" aria-hidden="true">
        <path d="M1 7h22M17 1l7 6-7 6" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
      </svg>
    </TransitionLink>
  );
}
