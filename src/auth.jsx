import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from './api.js';

// Who may do what?
//  - Supabase configured: anyone with an account may create places and guides and
//    manage their own; the admin (the owner, listed in site_owners) may manage
//    everything. The database checks all of this too.
//  - No Supabase (local dev): everyone, since the data lives in your own browser.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const live = api.usingSupabase;
  const [session, setSession] = useState(null);
  const [sessionLoaded, setSessionLoaded] = useState(!live);
  const [isOwner, setIsOwner] = useState(false);
  const [ready, setReady] = useState(!live);

  useEffect(() => {
    if (!live) return;
    let alive = true;
    api.getSession().then((s) => { if (alive) { setSession(s); setSessionLoaded(true); } });
    const off = api.onAuthChange((s) => { if (alive) setSession(s); });
    return () => { alive = false; off(); };
  }, [live]);

  const userId = session?.user?.id ?? null;
  useEffect(() => {
    if (!live || !sessionLoaded) return;
    if (!userId) { setIsOwner(false); setReady(true); return; }
    let alive = true;
    setReady(false);
    api.checkOwner().then((v) => { if (alive) { setIsOwner(v); setReady(true); } });
    return () => { alive = false; };
  }, [live, sessionLoaded, userId]);

  const signIn = useCallback((email, password) => api.signIn(email, password), []);
  const signUp = useCallback((email, password) => api.signUp(email, password), []);
  const signOut = useCallback(() => api.signOut(), []);

  // May this person change something created by `ownerId`?
  const canManage = useCallback(
    (ownerId) => !live || isOwner || (userId !== null && ownerId != null && ownerId === userId),
    [live, isOwner, userId],
  );

  const value = useMemo(() => ({
    usingSupabase: live,
    user: session?.user ?? null,
    ready,
    isAdmin: live && isOwner,
    canContribute: !live || userId !== null, // may create places and guides
    canManage,
    signIn,
    signUp,
    signOut,
  }), [live, session, userId, ready, isOwner, canManage, signIn, signUp, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
