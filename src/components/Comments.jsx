import { useEffect, useState } from 'react';
import * as api from '../api.js';

const formatDate = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

export default function Comments() {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [author, setAuthor] = useState('');
  const [body, setBody] = useState('');
  const [website, setWebsite] = useState(''); // honeypot: real visitors never see or fill it
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.listComments()
      .then((c) => { if (!cancelled) setComments(c); })
      .catch((e) => { if (!cancelled) setError('Could not load the comments. ' + (e.message || '')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function submit(e) {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    if (website) { setBody(''); return; } // a bot filled the honeypot: pretend it worked
    setSending(true);
    setError(null);
    try {
      const c = await api.addComment({ author: author.trim() || 'Anonymous', body: text });
      setComments((cs) => [c, ...cs]);
      setBody('');
    } catch (err) {
      setError('Could not post your comment. ' + (err.message || ''));
    } finally {
      setSending(false);
    }
  }

  return (
    <section id="comments" className="comments" aria-labelledby="comments-title">
      <h2 id="comments-title" className="comments-title">
        Comments{comments.length > 0 && <span className="comments-count">{comments.length}</span>}
      </h2>

      <form className="comments-form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="comment-author">Name <span className="text-muted">(optional)</span></label>
          <input id="comment-author" className="input" maxLength={40} value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Anonymous" autoComplete="nickname" />
        </div>
        <div className="field">
          <label htmlFor="comment-body">Message</label>
          <textarea id="comment-body" className="input" maxLength={1000} required value={body} onChange={(e) => setBody(e.target.value)} placeholder="A tip, a favourite address, a thank-you…" />
        </div>
        <input className="hp" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} />
        <div>
          <button className="btn btn-primary" type="submit" disabled={sending || !body.trim()}>{sending ? 'Posting…' : 'Post comment'}</button>
        </div>
      </form>

      {error && (
        <div className="notice" role="alert">
          <span>{error}</span>
          <button className="btn btn-ghost" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {loading ? (
        <p className="comments-empty">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="comments-empty">No comments yet. Be the first.</p>
      ) : (
        <ul className="comments-list">
          {comments.map((c) => (
            <li key={c.id} className="comment">
              <div className="comment-head">
                <strong>{c.author}</strong>
                <time dateTime={c.createdAt}>{formatDate(c.createdAt)}</time>
              </div>
              <p className="comment-body">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
