// lib/services/r2UploadService.ts
// Client-side R2 upload service.
// Drop-in replacement for CloudinaryService — same call sites, same shape.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// ---------------------------------------------------------------------------
// Auth token (reuse whatever cookie helper your project already has)
// ---------------------------------------------------------------------------

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('church_token');
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface R2UploadResponse {
  /** Permanent public URL — use this everywhere you previously used secureUrl */
  secureUrl: string;
  /** R2 object key — use this everywhere you previously used publicId */
  publicId: string;
  mimeType: string;
}

export interface UploadFromFileOptions {
  file: File;
  /** Called with percent complete (0–100) during the PUT to R2 */
  onProgress?: (percent: number) => void;
  /**
   * Maps to the R2 key prefix / folder.
   * e.g. 'church_portal/profile_photos' → key will be
   *      'church_portal/profile_photos/<originalName>'
   */
  folder?: string;
}

export interface UploadMultipleFilesOptions {
  files: File[];
  /** Called with (currentFileIndex 1-based, totalFiles) before each upload */
  onProgress?: (current: number, total: number) => void;
  folder?: string;
}

// ---------------------------------------------------------------------------
// Internal: ask your backend for a presigned PUT URL
// ---------------------------------------------------------------------------

interface PresignResult {
  /** Short-lived presigned PUT URL pointing straight at R2 */
  url: string;
  /** Permanent public URL the file will live at after upload */
  publicUrl: string;
  /** R2 object key */
  key: string;
}

async function getPresignedUrl(
  name: string,
  type: string,
  folder?: string,
): Promise<PresignResult> {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/r2/presign`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prefix: folder, filename: name, contentType: type }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? 'Presign request failed');
  }

  return res.json() as Promise<PresignResult>;
}

// ---------------------------------------------------------------------------
// Internal: PUT a file directly to R2 via the presigned URL, with progress
// ---------------------------------------------------------------------------

function putToR2(
  presignedUrl: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presignedUrl);
    // Do NOT set Content-Type — it must match what was signed on the server.

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`R2 upload failed (${xhr.status}): ${xhr.responseText}`));
    });
    xhr.addEventListener('error',   () => reject(new Error('Network error during R2 upload')));
    xhr.addEventListener('abort',   () => reject(new Error('R2 upload aborted')));
    xhr.addEventListener('timeout', () => reject(new Error('R2 upload timed out')));
    xhr.timeout = 10 * 60 * 1000; // 10 min — generous for large videos

    xhr.send(file);
  });
}

// ---------------------------------------------------------------------------
// Core upload — presign → PUT to R2 → return public URL
// ---------------------------------------------------------------------------

async function uploadFromFile({
  file,
  onProgress,
  folder,
}: UploadFromFileOptions): Promise<R2UploadResponse> {
  console.log(`Uploading to R2: ${file.name}`);

  const mimeType = file.type || 'application/octet-stream';

  // 1. Get a short-lived presigned URL from your backend
  const { url: presignedUrl, publicUrl, key } = await getPresignedUrl(
    file.name,
    mimeType,
    folder,
  );

  // 2. PUT the file bytes straight to R2 (your server never touches the bytes)
  await putToR2(presignedUrl, file, onProgress);

  // 3. Return the same shape CloudinaryService returned
  return {
    secureUrl: publicUrl, // drop-in for result.secureUrl at every call site
    publicId:  key,       // drop-in for result.publicId  at every call site
    mimeType,
  };
}

// ---------------------------------------------------------------------------
// Batch upload — same sequential pattern as the original
// ---------------------------------------------------------------------------

async function uploadMultipleFiles({
  files,
  onProgress,
  folder,
}: UploadMultipleFilesOptions): Promise<R2UploadResponse[]> {
  const responses: R2UploadResponse[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`Uploading file ${i + 1}/${files.length}: ${file.name}`);
    onProgress?.(i + 1, files.length);
    responses.push(await uploadFromFile({ file, folder }));
  }

  return responses;
}

// ---------------------------------------------------------------------------
// Public API  — matches CloudinaryService's call surface exactly
// ---------------------------------------------------------------------------

export const R2UploadService = {
  uploadFromFile,
  uploadMultipleFiles,
} as const;

export default R2UploadService;