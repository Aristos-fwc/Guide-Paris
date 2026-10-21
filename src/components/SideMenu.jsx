import { useEffect, useRef, useState } from 'react';
import TransitionLink from './TransitionLink.jsx';
import { loadAboutPage, loadGuidesPage } from '../pages/lazy.js';
import { useAuth } from '../auth.jsx';

// Three chunky bevelled bars, like carved stone: cream face, darker lower
// facet, hard shadow underneath.
function MenuIcon() {
  const bar = 'M3 0H29L32 4 29 8H3L0 4Z';
  const facet = 'M3 4H32L29 8H3L0 4Z';
  return (
    <svg className="menu-icon" width="36" height="34" viewBox="0 0 36 34" aria-hidden="true">
      {[0, 11, 22].map((y) => (
        <g key={y} transform={`translate(0 ${y})`}>
          <path d={bar} transform="translate(3 3)" fill="#07181b" />
          <path d={bar} fill="#f3ead3" />
          <path d={facet} fill="#d6c99b" />
        </g>
      ))}
    </svg>
  );
}

function scrollToId(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
}

// Menu button in the top-left corner of the main page, opening a panel on the left.
export default function SideMenu() {
  const { usingSupabase, user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); } };
    window.addEventListener('keydown', onKey);
    panelRef.current?.querySelector('a, button:not([disabled])')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function jump(id) {
    setOpen(false);
    // Wait for the panel to start closing so the scroll isn't fighting the layout.
    setTimeout(() => scrollToId(id), 60);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="menu-btn"
        aria-label="Open the menu"
        aria-expanded={open}
        aria-controls="side-menu"
        onClick={() => setOpen(true)}
      >
        <MenuIcon />
      </button>
      <div className={'menu-backdrop' + (open ? ' open' : '')} onClick={() => setOpen(false)} aria-hidden="true" />
      <nav
        id="side-menu"
        ref={panelRef}
        className={'menu-panel' + (open ? ' open' : '')}
        aria-label="Main menu"
        aria-hidden={!open}
        inert={!open ? '' : undefined}
      >
        <div className="menu-head">
          <span className="menu-title">Menu</span>
          <button type="button" className="menu-close" aria-label="Close the menu" onClick={() => setOpen(false)}>×</button>
        </div>
        <ul className="menu-list">
          <li>
            <TransitionLink to="/" label="Home" className="menu-item">
              Home
            </TransitionLink>
          </li>
          <li><button type="button" className="menu-item" onClick={() => jump('map')}>Map</button></li>
          <li>
            <TransitionLink to="/guides" label="Guides" className="menu-item" onMouseEnter={loadGuidesPage} onFocus={loadGuidesPage}>
              Guides
            </TransitionLink>
          </li>
          <li><button type="button" className="menu-item" onClick={() => jump('comments')}>Comments</button></li>
          <li>
            <TransitionLink to="/about" label="About us" className="menu-item" onMouseEnter={loadAboutPage} onFocus={loadAboutPage}>
              About us
            </TransitionLink>
          </li>
          {usingSupabase && (
            <li>
              {user ? (
                <button type="button" className="menu-item" onClick={() => { setOpen(false); signOut(); }}>
                  Log out
                </button>
              ) : (
                <TransitionLink to="/login" label="Account" className="menu-item">
                  Log in
                </TransitionLink>
              )}
            </li>
          )}
        </ul>
      </nav>
    </>
  );
}
