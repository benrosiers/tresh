import { FunctionsHttpError } from '@supabase/supabase-js';
import { z } from 'zod';
import { getSupabaseClient } from '../lib/supabase/client';

const pageSlug = import.meta.env.VITE_TRESH_PAGE_SLUG?.trim() || 'home';

const publishResponseSchema = z.object({
  releaseId: z.string().uuid(),
  revisionId: z.string().uuid(),
  revisionNumber: z.number().int().positive(),
  status: z.enum(['created', 'dispatched']),
});

export interface PublishedRelease {
  releaseId: string;
  revisionId: string;
  revisionNumber: number;
  status: 'created' | 'dispatched';
}

export async function publishSiteRelease(
  siteSlug: string,
  expectedLockVersion: number,
): Promise<PublishedRelease> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase n’est pas configuré.');

  const { data, error } = await client.functions.invoke('publish-site', {
    body: {
      siteSlug,
      pageSlug,
      expectedLockVersion,
    },
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json() as { error?: unknown };
        if (typeof body.error === 'string') throw new Error(body.error);
      } catch (contextError) {
        if (contextError instanceof Error && contextError.message !== 'Unexpected end of JSON input') {
          throw contextError;
        }
      }
    }
    throw new Error(error.message || 'Impossible de démarrer la publication.');
  }

  return publishResponseSchema.parse(data);
}
