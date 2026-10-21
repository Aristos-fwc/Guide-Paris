import { useState } from 'react';
import PlaceSearch from './PlaceSearch.jsx';

// Everyone gets the category filters. Signed-in users also get the place search
// (how places are added); only the admin can add categories.
export default function Toolbar({ cats, filter, onFilter, canAdd, isAdmin, onAddCategory, onPickPlace }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');

  function save() {
    onAddCategory(text);
    setEditing(false);
    setText('');
  }

  return (
    <div className="toolbar">
      {['All', ...cats].map((c) => (
        <button key={c} className={'btn chip' + (c === filter ? ' on' : '')} onClick={() => onFilter(c)}>
          {c}
        </button>
      ))}
      {isAdmin && (
        <>
          {editing ? (
            <>
              <input
                className="input"
                style={{ width: 160 }}
                placeholder="New category"
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') save();
                  if (e.key === 'Escape') { setEditing(false); setText(''); }
                }}
              />
              <button className="btn btn-secondary" onClick={save}>Save</button>
            </>
          ) : (
            <button className="btn chip-add" onClick={() => setEditing(true)}>+ Add</button>
          )}
        </>
      )}
      {canAdd && <PlaceSearch onPick={onPickPlace} />}
    </div>
  );
}
