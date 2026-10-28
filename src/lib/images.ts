import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Private buckets (0010, 0014): pictures are read through short-lived signed URLs.
export function useSignedUrl(bucket: string, path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return setUrl(null);
    let cancelled = false;
    supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [bucket, path]);
  return url;
}

// Shrinks a picture to at most 800px on its long side as JPEG, so it fits the 2 MB bucket limit.
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('image'))), 'image/jpeg', 0.85),
  );
}

// Uploads under <folder>/<new name>.jpg and returns the stored path.
export async function uploadImage(bucket: string, folder: string, file: File): Promise<string> {
  const path = `${folder}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, await shrink(file), { contentType: 'image/jpeg' });
  if (error) throw error;
  return path;
}
