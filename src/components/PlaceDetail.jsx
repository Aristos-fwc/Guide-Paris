import { useState } from 'react';
import { Link } from 'react-router-dom';
import ImageSlot from './ImageSlot.jsx';

// canEdit: this person made the place (or is the admin): photo, Edit, Remove.
// canGuide: signed in: can put the place in their own guides (myGuides).
export default function PlaceDetail({ place, loading, canEdit, canGuide, cats, guides = [], myGuides = [], guideIds = [], onToggleGuide, imageBusy, onImage, onError, onRemove, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', cat: '', note: '' });
  const [saving, setSaving] = useState(false);

  if (!place) {
    return (
      <div className="detail">
        <div className="detail-note">
          {loading ? 'Loading places…' : canGuide ? 'No places yet. Search a place above to add the first one.' : 'No places yet.'}
        </div>
      </div>
    );
  }

  function startEdit() {
    setForm({ name: place.name, cat: place.cat, note: place.note || '' });
    setEditing(true);
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    const done = await onUpdate({ name: form.name.trim() || place.name, cat: form.cat, note: form.note });
    setSaving(false);
    if (done) setEditing(false);
  }

  // Guides that contain the place, other than the signed-in person's own (those are the toggles above).
  const featuredIn = guides.filter((g) => guideIds.includes(g.id) && !(canGuide && myGuides.some((m) => m.id === g.id)));

  const photo = canEdit ? (
    <div className="detail-photo grayscale">
      <ImageSlot key={place.id} src={place.image} busy={imageBusy} onChange={onImage} onError={onError} placeholder="Add photo" />
    </div>
  ) : place.image ? (
    <div className="detail-photo grayscale"><img src={place.image} alt={place.name} /></div>
  ) : null;

  return (
    <div className="detail">
      {editing ? (
        <form className="detail new-place" onSubmit={submit}>
          <div className="field">
            <label htmlFor="ed-name">Name</label>
            <input id="ed-name" className="input" maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field">
            <label>Category</label>
            <div className="chip-row">
              {cats.map((c) => (
                <button key={c} type="button" className={'btn chip' + (c === form.cat ? ' on' : '')} onClick={() => setForm({ ...form, cat: c })}>{c}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="ed-note">Your description <span className="text-muted">(written by you)</span></label>
            <textarea id="ed-note" className="input" maxLength={1000} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <div className="dialog-actions" style={{ justifyContent: 'flex-start' }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            <button className="btn btn-secondary" type="button" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
          </div>
        </form>
      ) : (
        <>
          <div className="detail-cat">{place.cat}</div>
          <h2 className="detail-name">{place.name}</h2>
          {place.address && <div className="text-muted new-place-address">{place.address}</div>}
          {photo}
          {place.imageCredit && (
            <div className="photo-credit">
              Photo: <a href={place.imageCreditUrl || undefined} target="_blank" rel="noopener noreferrer">{place.imageCredit}</a>
            </div>
          )}
          {canEdit && (
            <div className="guide-actions">
              <button className="btn btn-ghost" style={{ paddingInline: 0 }} onClick={startEdit}>Edit</button>
              <button className="btn btn-ghost" onClick={onRemove}>Remove</button>
            </div>
          )}
          <div className="detail-note">{place.note || (canEdit ? <span className="text-muted">No description yet.</span> : null)}</div>
          {canGuide && (
            <div className="detail-guides">
              <div className="field-label">In my guides</div>
              {myGuides.length ? (
                <div className="chip-row">
                  {myGuides.map((g) => {
                    const on = guideIds.includes(g.id);
                    return (
                      <button key={g.id} type="button" aria-pressed={on} className={'btn chip' + (on ? ' on' : '')} onClick={() => onToggleGuide(g.id)}>
                        {on ? '✓ ' : '+ '}{g.title}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <span className="text-muted">You have no guide yet. <Link to="/guides">Create one</Link>.</span>
              )}
            </div>
          )}
          {featuredIn.length > 0 && (
            <div className="detail-guides">
              <div className="field-label">Featured in</div>
              <div className="chip-row">
                {featuredIn.map((g) => (
                  <Link key={g.id} className="btn chip" to={'/guides/' + g.id}>{g.title}</Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
