import { getSupabaseClient } from '../lib/supabase/client';

const SITE_MEDIA_BUCKET = 'site-media';
const MAX_SITE_MEDIA_BYTES = 15 * 1024 * 1024;

const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export interface UploadedSiteMedia {
  publicUrl: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
  aspectRatio: number;
}

async function readImageSize(file: File): Promise<{
  width: number;
  height: number;
}> {
  if ('createImageBitmap' in window) {
    const bitmap = await createImageBitmap(file);

    try {
      return {
        width: bitmap.width,
        height: bitmap.height,
      };
    } finally {
      bitmap.close();
    }
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => {
        resolve({
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
      };

      image.onerror = () => {
        reject(new Error('Impossible de lire les dimensions de cette image.'));
      };

      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function uploadSiteMedia(
  file: File,
): Promise<UploadedSiteMedia> {
  const extension = MIME_EXTENSIONS[file.type];

  if (!extension) {
    throw new Error('Utilise une image PNG, JPEG ou WebP.');
  }

  if (file.size <= 0) {
    throw new Error('Le fichier sélectionné est vide.');
  }

  if (file.size > MAX_SITE_MEDIA_BYTES) {
    throw new Error('L’image dépasse la limite de 15 Mo.');
  }

  const client = getSupabaseClient();

  if (!client) {
    throw new Error('Supabase n’est pas configuré.');
  }

  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError) {
    throw new Error(authError.message);
  }

  if (!user) {
    throw new Error('Connecte-toi à Tresh pour importer une image.');
  }

  const { width, height } = await readImageSize(file);

  if (width <= 0 || height <= 0) {
    throw new Error('Les dimensions de l’image sont invalides.');
  }

  const storagePath =
    `${user.id}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await client.storage
    .from(SITE_MEDIA_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '31536000',
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = client.storage
    .from(SITE_MEDIA_BUCKET)
    .getPublicUrl(storagePath);

  return {
    publicUrl: data.publicUrl,
    storagePath,
    fileName: file.name,
    mimeType: file.type,
    width,
    height,
    aspectRatio: width / height,
  };
}
