// lib/services/cloudinaryService.ts
// Next.js (client-side) Cloudinary upload service
// Mirrors the original Dart CloudinaryService

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CloudinaryUploadResponse {
  secureUrl: string;
  publicId: string;
  mimeType: string;
  rawData: Record<string, unknown>;
}

export interface UploadFromFileOptions {
  file: File;
  /** Called with percent complete (0–100) during upload */
  onProgress?: (percent: number) => void;
  folder?: string;
}

export interface UploadMultipleFilesOptions {
  files: File[];
  /** Called with (currentFileIndex 1-based, totalFiles) before each upload */
  onProgress?: (current: number, total: number) => void;
  folder?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toResponse(
  data: Record<string, unknown>,
  mimeType: string,
): CloudinaryUploadResponse {
  return {
    secureUrl: (data['secure_url'] as string) ?? '',
    publicId: (data['public_id'] as string) ?? '',
    mimeType,
    rawData: data,
  };
}

function fromJson(json: Record<string, unknown>): CloudinaryUploadResponse {
  return {
    secureUrl:
      (json['secure_url'] as string) ?? (json['secureUrl'] as string) ?? '',
    publicId:
      (json['public_id'] as string) ?? (json['publicId'] as string) ?? '',
    mimeType: (json['mimeType'] as string) ?? 'application/octet-stream',
    rawData: json,
  };
}

// ---------------------------------------------------------------------------
// Core upload — with optional XHR-based progress tracking
// ---------------------------------------------------------------------------

async function uploadFromFile({
  file,
  onProgress,
  folder,
}: UploadFromFileOptions): Promise<CloudinaryUploadResponse> {
  console.log(`Uploading to Cloudinary: ${file.name}`);

  const mimeType = file.type || 'application/octet-stream';

  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('upload_preset', UPLOAD_PRESET);
  if (folder) formData.append('folder', folder);

  // Use XMLHttpRequest when progress tracking is needed (fetch doesn't expose
  // upload progress for request bodies).
  if (onProgress) {
    return new Promise<CloudinaryUploadResponse>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded * 100) / event.total);
          onProgress(percent);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          try {
            const data = JSON.parse(xhr.responseText) as Record<string, unknown>;
            resolve(toResponse(data, mimeType));
          } catch {
            reject(new Error(`Failed to parse Cloudinary response: ${xhr.responseText}`));
          }
        } else {
          reject(
            new Error(
              `Upload failed with status: ${xhr.status}\nResponse: ${xhr.responseText}`,
            ),
          );
        }
      });

      xhr.addEventListener('error', () =>
        reject(new Error('Network error during Cloudinary upload')),
      );
      xhr.addEventListener('abort', () =>
        reject(new Error('Cloudinary upload aborted')),
      );

      xhr.open('POST', CLOUDINARY_URL);
      xhr.send(formData);
    });
  }

  // No progress — plain fetch
  const response = await fetch(CLOUDINARY_URL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Upload failed with status: ${response.status}\nResponse: ${body}`,
    );
  }

  const data = (await response.json()) as Record<string, unknown>;
  return toResponse(data, mimeType);
}

// ---------------------------------------------------------------------------
// Batch upload
// ---------------------------------------------------------------------------

async function uploadMultipleFiles({
  files,
  onProgress,
  folder,
}: UploadMultipleFilesOptions): Promise<CloudinaryUploadResponse[]> {
  const responses: CloudinaryUploadResponse[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`Uploading file ${i + 1}/${files.length}: ${file.name}`);

    onProgress?.(i + 1, files.length);

    const response = await uploadFromFile({ file, folder });
    responses.push(response);
  }

  return responses;
}

// ---------------------------------------------------------------------------
// Public API  (matches the original Dart static class surface)
// ---------------------------------------------------------------------------

export const CloudinaryService = {
  uploadFromFile,
  uploadMultipleFiles,
  fromJson,
} as const;

export default CloudinaryService;