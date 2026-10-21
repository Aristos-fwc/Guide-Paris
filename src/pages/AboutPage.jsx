import { useEffect, useState } from 'react';
import Hero from '../components/Hero.jsx';
import TransitionLink from '../components/TransitionLink.jsx';
import * as api from '../api.js';
import { useAuth } from '../auth.jsx';
import { friendly } from '../errors.js';
import { useTitle } from '../useTitle.js';

const SLUG = 'about';

// Shown until the admin writes the page.
const DEFAULT_PAGE = {
  title: 'About us',
  body: [
    'City Guide: Paris is an illustrated map of the places we love in the city: museums, bars, parks, shops and the corners in between.',
    'Every place is picked and described by a real person. Anyone can sign up, build a guide around a theme and put its places in the order of a walk.',
    'Write to us, or leave a note in the guestbook on the map page.',
  ].join('\n\n'),
};

// Blank lines separate paragraphs; single line breaks are kept.
const paragraphs = (text) => text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

// A text page that the admin can edit in place. Everyone else only reads it.
export default function AboutPage() {
  const { canManage } = useAuth();
  const canEdit = canManage(null); // true for the admin (and in local mode), false for everyone else
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(DEFAULT_PAGE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const shown = page || DEFAULT_PAGE;
  useTitle(shown.title || DEFAULT_PAGE.title);

  useEffect(() => {
    let alive = true;
    api.getPage(SLUG)
      .then((p) => { if (alive) setPage(p); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // The edit form vanishes if the admin logs out while it is open.
  useEffect(() => {
    if (!canEdit) setEditing(false);
  }, [canEdit]);

  function startEdit() {
    setForm({ title: shown.title, body: shown.body });
    setError(null);
    setEditing(true);
  }

  async function save(e) {
    e.preventDefault();
    const next = { title: form.title.trim() || DEFAULT_PAGE.title, body: form.body.trim() };
    setSaving(true);
    setError(null);
    try {
      await api.savePage(SLUG, next);
      setPage(next);
      setEditing(false);
    } catch (err) {
      setError('Could not save the page. ' + friendly(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: '#fff', color: 'var(--color-text)' }}>
      <Hero short lines={[shown.title || DEFAULT_PAGE.title, ': Paris']}>
        <TransitionLink to="/map" label="The map" className="back-link">
          <span aria-hidden="true">←</span> Back to the map
        </TransitionLink>
      </Hero>

      <main className="about">
        {loading ? (
          <p className="comments-empty">Loading…</p>
        ) : editing ? (
          <form className="about-form" onSubmit={save}>
            <div className="field">
              <label htmlFor="about-title">Title</label>
              <input id="about-title" className="input" maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="about-body">Text <span className="text-muted">(leave a blank line between paragraphs)</span></label>
              <textarea id="about-body" className="input about-textarea" maxLength={20000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            </div>
            {error && <div className="notice" role="alert"><span>{error}</span></div>}
            <div className="guide-actions">
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
            </div>
          </form>
        ) : (
          <>
            {paragraphs(shown.body).map((p, i) => <p key={i} className="about-text">{p}</p>)}
            {canEdit && (
              <div className="guide-actions">
                <button className="btn btn-secondary" onClick={startEdit}>Edit this page</button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
