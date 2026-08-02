import type { ImageElement } from './siteDocument';

export interface ImageSourceDetails {
  previewUrl: string | null;
  fileName: string;
  storagePath: string | null;
  publicUrl: string | null;
  copyValue: string | null;
  sourceLabel: string;
}

const PUBLIC_STORAGE_MARKER =
  '/storage/v1/object/public/site-media/';

function decodePathPart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function fileNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const lastPart = parsed.pathname
      .split('/')
      .filter(Boolean)
      .at(-1);

    return lastPart
      ? decodePathPart(lastPart)
      : 'Image distante';
  } catch {
    return 'Image distante';
  }
}

export function storagePathFromPublicUrl(
  url: string,
): string | null {
  try {
    const parsed = new URL(url);
    const markerIndex = parsed.pathname.indexOf(
      PUBLIC_STORAGE_MARKER,
    );

    if (markerIndex < 0) return null;

    const encodedPath = parsed.pathname.slice(
      markerIndex + PUBLIC_STORAGE_MARKER.length,
    );

    return encodedPath
      ? decodePathPart(encodedPath)
      : null;
  } catch {
    return null;
  }
}

export function getImageSourceDetails(
  element: ImageElement,
): ImageSourceDetails {
  if (element.source.kind === 'placeholder') {
    return {
      previewUrl: null,
      fileName: element.source.label,
      storagePath: null,
      publicUrl: null,
      copyValue: null,
      sourceLabel: 'Emplacement vide',
    };
  }

  if (element.source.kind === 'media') {
    return {
      previewUrl: null,
      fileName: 'Média Tresh',
      storagePath: element.source.mediaAssetId,
      publicUrl: null,
      copyValue: element.source.mediaAssetId,
      sourceLabel: 'Identifiant média',
    };
  }

  const storagePath =
    element.source.storagePath ??
    storagePathFromPublicUrl(element.source.url);

  return {
    previewUrl: element.source.url,
    fileName:
      element.source.fileName ??
      fileNameFromUrl(element.source.url),
    storagePath,
    publicUrl: element.source.url,
    copyValue: storagePath ?? element.source.url,
    sourceLabel: storagePath
      ? 'Stockage Supabase'
      : 'URL publique',
  };
}
