export const EXTERNAL_MEDIA_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

const EXTERNAL_MEDIA_TYPE_SET = new Set<string>(
  EXTERNAL_MEDIA_MIME_TYPES,
);

export interface ExternalMediaFileLike {
  name: string;
  type: string;
  size: number;
  lastModified?: number;
}

export type ExternalMediaSelection<T extends ExternalMediaFileLike> =
  | { file: T; error: null }
  | { file: null; error: string };

export function hasExternalFileTransfer(
  types: ArrayLike<string>,
): boolean {
  return Array.from(types).includes('Files');
}

export function isSupportedExternalMediaType(
  type: string,
): boolean {
  return EXTERNAL_MEDIA_TYPE_SET.has(type);
}

export function selectExternalMediaFile<
  T extends ExternalMediaFileLike,
>(
  files: ArrayLike<T>,
): ExternalMediaSelection<T> {
  const candidates = Array.from(files);

  if (candidates.length === 0) {
    return {
      file: null,
      error: 'Aucun fichier image n’a été reçu.',
    };
  }

  if (candidates.length > 1) {
    return {
      file: null,
      error: 'Dépose une seule image à la fois.',
    };
  }

  const file = candidates[0];

  if (!file) {
    return {
      file: null,
      error: 'Aucun fichier image n’a été reçu.',
    };
  }

  if (!isSupportedExternalMediaType(file.type)) {
    return {
      file: null,
      error: 'Utilise une image PNG, JPEG ou WebP.',
    };
  }

  return {
    file,
    error: null,
  };
}

export function externalMediaFingerprint(
  file: ExternalMediaFileLike,
): string {
  return [
    file.name,
    file.type,
    file.size,
    file.lastModified ?? 0,
  ].join(':');
}
