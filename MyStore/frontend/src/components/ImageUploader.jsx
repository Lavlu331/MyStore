import { useState } from 'react';
import { upload } from '../api';

// Choose a file -> it is uploaded -> onUploaded(url) is called with the saved image address
export default function ImageUploader({ onUploaded }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true); setError('');
    try { const { url } = await upload(file); onUploaded(url); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); e.target.value = ''; }
  };

  return (
    <div className="text-sm">
      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={pick} disabled={busy} />
      {busy && <span className="ml-2 text-slate-500">Uploading…</span>}
      {error && <p className="mt-1 text-red-600">{error}</p>}
      <p className="mt-1 text-xs text-slate-500">JPG, PNG, WEBP or GIF, up to 2 MB.</p>
    </div>
  );
}
