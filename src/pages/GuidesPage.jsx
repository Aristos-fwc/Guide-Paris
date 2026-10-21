import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Hero from '../components/Hero.jsx';
import TransitionLink from '../components/TransitionLink.jsx';
import { useAuth } from '../auth.jsx';
import { useGuides } from '../guides.jsx';
import { friendly } from '../errors.js';
import { useTitle } from '../useTitle.js';
import { loadPseudo, savePseudo } from '../pseudo.js';

export default function GuidesPage() {
  useTitle('Guides');
  const { canContribute, canManage, user } = useAuth();
  const { guides, links, loading, error: loadError, createGuide, updateGuide, removeGuide } = useGuides();
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState(loadPseudo);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ title: '', summary: '', author: '' });
  const [busy, setBusy] = useState(false);

  // Editing controls vanish if the user logs out while a form is open.
  useEffect(() => {
    if (!canContribute) { setCreating(false); setEditId(null); }
  }, [canContribute]);

  const countOf = (id) => links.filter((l) => l.guideId === id).length;

  async function create(e) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      const author = newAuthor.trim();
      await createGuide(title, author);
      savePseudo(author);
      setNewTitle('');
      setCreating(false);
    } catch (err) {
      setError('Could not add the guide. ' + friendly(err));
    } finally {
      setBusy(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    const title = form.title.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      const author = form.author.trim();
      await updateGuide(editId, { title, summary: form.summary.trim(), author });
      savePseudo(author);
      setEditId(null);
    } catch (err) {
      setError('Could not save the guide. ' + friendly(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(g) {
    if (!window.confirm(`Delete the guide “${g.title}”? Its places stay on the map.`)) return;
    try {
      await removeGuide(g.id);
    } catch (err) {
      setError('Could not delete the guide. ' + friendly(err));
    }
  }

  const shownError = error || (loadError && 'Could not load the guides. ' + friendly(loadError));

  return (
    <div style={{ background: '#fff', color: 'var(--color-text)' }}>
      <Hero short lines={['Guides', ': by theme']}>
        <TransitionLink to="/map" label="The map" className="back-link">
          <span aria-hidden="true">←</span> Back to the map
        </TransitionLink>
      </Hero>

      <main className="guides">
        <div className="guides-head">
          <p className="guides-intro">Guides to Paris, one theme at a time, made by the community.</p>
          {canContribute && !creating && (
            <button className="btn btn-primary" onClick={() => setCreating(true)}>+ New guide</button>
          )}
          {!canContribute && (
            <TransitionLink to="/login" label="Log in" className="btn btn-secondary">Log in to create your own guide</TransitionLink>
          )}
        </div>

        {shownError && (
          <div className="notice" role="alert">
            <span>{shownError}</span>
            <button className="btn btn-ghost" onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {loading ? (
          <p className="comments-empty">Loading guides…</p>
        ) : (
          <ul className="guide-grid">
            {creating && (
              <li className="guide-card guide-card--form">
                <form onSubmit={create}>
                  <label htmlFor="new-guide" className="guide-form-label">New guide</label>
                  <input id="new-guide" className="input" autoFocus maxLength={120} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Title" />
                  <label htmlFor="new-guide-author" className="guide-form-label">Your pseudo <span className="text-muted">(shown as the author)</span></label>
                  <input id="new-guide-author" className="input" maxLength={40} value={newAuthor} onChange={(e) => setNewAuthor(e.target.value)} placeholder="Anonymous" autoComplete="nickname" />
                  <div className="guide-actions">
                    <button className="btn btn-primary" type="submit" disabled={busy || !newTitle.trim()}>{busy ? 'Saving…' : 'Add guide'}</button>
                    <button className="btn btn-secondary" type="button" onClick={() => { setCreating(false); setNewTitle(''); }}>Cancel</button>
                  </div>
                </form>
              </li>
            )}
            {guides.map((g, i) => (
              <li key={g.id} className="guide-card">
                <span className="guide-num">{String(i + 1).padStart(2, '0')}</span>
                {editId === g.id ? (
                  <form onSubmit={save}>
                    <label htmlFor={'rename-' + g.id} className="guide-form-label">Title</label>
                    <input id={'rename-' + g.id} className="input" autoFocus maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                    <label htmlFor={'author-' + g.id} className="guide-form-label">Your pseudo</label>
                    <input id={'author-' + g.id} className="input" maxLength={40} value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder="Anonymous" />
                    <label htmlFor={'summary-' + g.id} className="guide-form-label">Short introduction</label>
                    <textarea id={'summary-' + g.id} className="input" maxLength={500} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="What is this guide about?" />
                    <div className="guide-actions">
                      <button className="btn btn-primary" type="submit" disabled={busy || !form.title.trim()}>{busy ? 'Saving…' : 'Save'}</button>
                      <button className="btn btn-secondary" type="button" onClick={() => setEditId(null)}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
                    {user && g.ownerId === user.id && <span className="guide-mine">Yours</span>}
                    <h2 className="guide-title"><Link className="guide-link" to={'/guides/' + g.id}>{g.title}</Link></h2>
                    {(g.author || g.ownerId) && <p className="guide-by">by {g.author || 'Anonymous'}</p>}
                    {g.summary && <p className="guide-summary">{g.summary}</p>}
                    <div className="guide-foot">
                      <span className="guide-soon">{countOf(g.id)} {countOf(g.id) === 1 ? 'place' : 'places'}</span>
                      {canManage(g.ownerId) && (
                        <span className="guide-actions guide-owner">
                          <button className="btn btn-ghost" onClick={() => { setEditId(g.id); setForm({ title: g.title, summary: g.summary || '', author: g.author || '' }); }}>Edit</button>
                          <button className="btn btn-ghost" onClick={() => remove(g)}>Delete</button>
                        </span>
                      )}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {!loading && guides.length === 0 && !creating && (
          <p className="comments-empty">No guides yet.{canContribute ? ' Use “New guide” to add the first one.' : ''}</p>
        )}
      </main>
    </div>
  );
}
