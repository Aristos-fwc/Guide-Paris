import { useRef, useState } from 'react';

const MAX_SIDE = 640; // downscale before upload: keeps photos light (well under the 1 MB bucket limit)

function resize(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process the image.'))), 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be read as an image.')); };
    img.src = url;
  });
}

// Click or drop an image to fill the slot. The parent owns the image: this
// component only reports a resized JPEG Blob (or null to clear) via onChange.
export default function ImageSlot({ src, onChange, onError, busy = false, placeholder = 'Drop an image' }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  async function fill(file) {
    if (!file || busy) return;
    if (!file.type.startsWith('image/')) { onError?.('Please choose an image file.'); return; }
    try { onChange(await resize(file)); } catch (e) { onError?.(e.message); }
  }

  function clear(e) {
    e.stopPropagation();
    if (!busy) onChange(null);
  }

  return (
    <div
      className={'image-slot' + (drag ? ' drag' : '')}
      role="button"
      tabIndex={0}
      aria-busy={busy}
      aria-label={src ? 'Replace photo' : placeholder}
      onClick={() => !busy && inputRef.current.click()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!busy) inputRef.current.click(); } }}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); fill(e.dataTransfer.files[0]); }}
    >
      {src ? <img src={src} alt="" /> : <span>{placeholder}</span>}
      {src && !busy && <button className="image-slot-clear" onClick={clear} aria-label="Remove photo">×</button>}
      {busy && <span className="image-slot-busy">Saving…</span>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => { fill(e.target.files[0]); e.target.value = ''; }}
      />
    </div>
  );
}
