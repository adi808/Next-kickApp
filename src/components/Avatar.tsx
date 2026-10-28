import { useRef, useState } from 'react';
import { uploadImage, useSignedUrl } from '../lib/images';

// A round picture from a private bucket, with the name's first letter while there is none.
// With onUpload, tapping it picks a new picture: it is uploaded under folder and the new path is handed back.
export default function Avatar({
  bucket,
  path,
  name,
  size = 48,
  folder,
  onUpload,
}: {
  bucket: string;
  path: string | null | undefined;
  name: string;
  size?: number;
  folder?: string;
  onUpload?: (path: string) => Promise<void>;
}) {
  const url = useSignedUrl(bucket, path);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const face = url ? (
    <img src={url} alt={name} width={size} height={size} />
  ) : (
    <span aria-hidden="true">{name.trim().charAt(0) || '?'}</span>
  );

  if (!onUpload || !folder) {
    return (
      <span className="avatar" style={{ width: size, height: size, fontSize: size / 2.4 }}>
        {face}
      </span>
    );
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(false);
    try {
      await onUpload!(await uploadImage(bucket, folder!, file));
    } catch {
      setError(true);
    }
    setBusy(false);
  }

  return (
    <span className="avatar-edit">
      <button
        type="button"
        className="avatar"
        style={{ width: size, height: size, fontSize: size / 2.4 }}
        disabled={busy}
        onClick={() => input.current?.click()}
        aria-label={`החלפת תמונה של ${name}`}
      >
        {face}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <small>{busy ? 'מעלה…' : error ? 'ההעלאה נכשלה' : 'לחצו להחלפת תמונה'}</small>
    </span>
  );
}
