import { useState } from 'react';

// Shown in the side panel after the owner picks a search suggestion. The place
// is already marked on the map; the photo is looked up automatically (and
// credited). The description is always written by the owner, never generated.
export default function NewPlacePanel({ draft, cats, guides = [], defaultCat, onSave, onCancel }) {
  const [name, setName] = useState(draft.name);
  const [cat, setCat] = useState(cats.includes(defaultCat) ? defaultCat : cats[0]);
  const [note, setNote] = useState('');
  const [guideIds, setGuideIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const { photo } = draft;
  const toggleGuide = (id) => setGuideIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    await onSave({ name, cat, note, guideIds }); // the parent closes the panel on success
    setSaving(false);
  }

  return (
    <form className="detail new-place" onSubmit={submit}>
      <div className="detail-cat">New place · not saved yet</div>

      <div className="detail-photo grayscale" aria-live="polite">
        {photo.status === 'found' ? (
          <img src={photo.url} alt="" />
        ) : (
          <span className="photo-status">{photo.status === 'loading' ? 'Looking for a photo…' : 'No photo found'}</span>
        )}
      </div>
      {photo.status === 'found' && photo.credit && (
        <div className="photo-credit">
          Photo: <a href={photo.creditUrl} target="_blank" rel="noopener noreferrer">{photo.credit}</a>
        </div>
      )}
      {photo.status === 'none' && <div className="photo-credit">You can add your own photo after saving.</div>}

      <div className="field">
        <label htmlFor="np-name">Name</label>
        <input id="np-name" className="input" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      {draft.address && <div className="text-muted new-place-address">{draft.address}</div>}

      <div className="field">
        <label>Category</label>
        <div className="chip-row">
          {cats.map((c) => (
            <button key={c} type="button" className={'btn chip' + (c === cat ? ' on' : '')} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="np-note">Your description <span className="text-muted">(written by you)</span></label>
        <textarea id="np-note" className="input" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why go?" />
      </div>

      {guides.length > 0 && (
        <div className="field">
          <label>Add to guides <span className="text-muted">(optional)</span></label>
          <div className="chip-row">
            {guides.map((g) => (
              <button key={g.id} type="button" aria-pressed={guideIds.includes(g.id)} className={'btn chip' + (guideIds.includes(g.id) ? ' on' : '')} onClick={() => toggleGuide(g.id)}>
                {guideIds.includes(g.id) ? '✓ ' : '+ '}{g.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="dialog-actions" style={{ justifyContent: 'flex-start' }}>
        <button className="btn btn-primary" type="submit" disabled={saving || !name.trim()}>{saving ? 'Saving…' : 'Save place'}</button>
        <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  );
}
