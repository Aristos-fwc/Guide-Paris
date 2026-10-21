import { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { preloadRoute } from './pages/lazy.js';

// Cartoon "iris" page transition. Three flat paint-coloured discs (ink, green,
// cream) burst outward from the click, each a beat behind the last, until the
// screen is covered. The logo mark pops in with the destination's name, the
// route changes under the cover, then the discs retract the same way to reveal
// the new page. Skipped for visitors who prefer reduced motion.
const COLORS = ['#0e2a2e', '#2f8f74', '#f3ead3']; // outer ring first, inner fill last
const DUR = 320;     // each disc
const STAGGER = 60;  // delay between discs
const HOLD = 90;     // minimum time spent fully covered
const EMBLEM_LEAD = 150; // the logo pops in this long after the first disc starts
const PRELOAD_MAX = 1500; // never keep the screen covered longer than this waiting for code

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
const circle = (r, x, y) => `circle(${r}px at ${x}px ${y}px)`;
const MARK = 'translate(-50%, -50%)';

const TransitionContext = createContext({ go: () => {} });
export const useTransition = () => useContext(TransitionContext);

function originOf(event) {
  const el = event?.currentTarget;
  // Keyboard activation reports 0,0: start from the element instead.
  if (el && (event.detail === 0 || (!event.clientX && !event.clientY))) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  if (event && typeof event.clientX === 'number') return { x: event.clientX, y: event.clientY };
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

export function TransitionProvider({ children }) {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const layerRefs = useRef([]);
  const emblemRef = useRef(null);
  const labelRef = useRef(null);
  const busy = useRef(false);

  const sweep = (dir, x, y, R) => {
    const closing = dir === 'in';
    const n = COLORS.length;
    return Promise.all(layerRefs.current.map((el, i) => el.animate(
      closing
        ? [{ clipPath: circle(0, x, y) }, { clipPath: circle(R, x, y) }]
        : [{ clipPath: circle(R, x, y) }, { clipPath: circle(0, x, y) }],
      {
        duration: DUR,
        delay: (closing ? i : n - 1 - i) * STAGGER,
        // Opening overshoots a little (springy); closing never goes below 0 px.
        easing: closing ? 'cubic-bezier(.3, .9, .4, 1.12)' : 'cubic-bezier(.65, 0, .35, 1)',
        fill: 'both',
      },
    ).finished));
  };

  const emblem = (dir) => emblemRef.current.animate(
    dir === 'in'
      ? [
          { transform: `${MARK} scale(0) rotate(-120deg)` },
          { transform: `${MARK} scale(1.18) rotate(10deg)`, offset: 0.65 },
          { transform: `${MARK} scale(1) rotate(0deg)` },
        ]
      : [{ transform: `${MARK} scale(1) rotate(0deg)` }, { transform: `${MARK} scale(0) rotate(100deg)` }],
    { duration: dir === 'in' ? 300 : 200, delay: dir === 'in' ? EMBLEM_LEAD : 0, easing: 'ease-out', fill: 'both' },
  ).finished;

  const go = useCallback(async (to, event, label = '') => {
    if (busy.current) return;
    const root = rootRef.current;
    if (!root || !root.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      navigate(to);
      window.scrollTo(0, 0);
      return;
    }
    busy.current = true;
    const { x, y } = originOf(event);
    const R = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) + 40;
    labelRef.current.textContent = label;
    root.style.pointerEvents = 'auto'; // block clicks while animating
    try {
      // Cover the screen while fetching the destination's code in parallel.
      const preload = Promise.race([preloadRoute(to).catch(() => {}), wait(PRELOAD_MAX)]);
      await Promise.all([sweep('in', x, y, R), emblem('in'), preload]);
      navigate(to);
      window.scrollTo(0, 0);
      // Let React commit and paint the new page before uncovering it.
      await Promise.all([frame().then(frame), wait(HOLD)]);
      // Logo shrinks while the discs retract, instead of one after the other.
      await Promise.all([emblem('out'), sweep('out', x, y, R)]);
    } finally {
      // Whatever happened, never leave the page covered.
      [...layerRefs.current, emblemRef.current].forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
      root.style.pointerEvents = 'none';
      busy.current = false;
    }
  }, [navigate]);

  const value = useMemo(() => ({ go }), [go]);

  return (
    <TransitionContext.Provider value={value}>
      {children}
      <div ref={rootRef} className="wipe-root" aria-hidden="true">
        {COLORS.map((c, i) => (
          <div key={c} ref={(el) => { layerRefs.current[i] = el; }} className="wipe-layer" style={{ background: c }} />
        ))}
        <div ref={emblemRef} className="wipe-emblem">
          <div className="wipe-mark"><div /></div>
          <div ref={labelRef} className="wipe-label" />
        </div>
      </div>
    </TransitionContext.Provider>
  );
}
