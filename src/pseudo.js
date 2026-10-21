// The pseudo a visitor signs their guides with, remembered in this browser so it
// is pre-filled next time.
const KEY = 'parisguide.pseudo';

export function loadPseudo() {
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
}

export function savePseudo(name) {
  try { if (name) localStorage.setItem(KEY, name); } catch { /* storage unavailable */ }
}
