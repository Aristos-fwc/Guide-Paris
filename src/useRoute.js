import { useEffect, useState } from 'react';
import { walkingRoute } from './routing.js';

// The walking route through `stops` (in order). Null while it is being worked
// out, or when there are fewer than two stops. A route is only ever returned
// for the stops it was computed for, never for an older list.
export function useRoute(stops) {
  const [state, setState] = useState({ key: '', route: null });
  // Re-run only when the stops or their order really change.
  const key = stops.map((p) => `${p.id}:${p.lat},${p.lng}`).join('|');

  useEffect(() => {
    if (stops.length < 2) return undefined;
    const ctrl = new AbortController();
    walkingRoute(stops, ctrl.signal)
      .then((route) => setState({ key, route }))
      .catch(() => { /* aborted: a newer list replaced this one */ });
    return () => ctrl.abort();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return state.key === key && stops.length > 1 ? state.route : null;
}
