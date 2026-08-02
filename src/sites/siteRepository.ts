import { z } from 'zod';
import type { SiteDocument } from '../editor/model/siteDocument';
import { getSupabaseClient } from '../lib/supabase/client';

const siteRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  public_url: z.string().nullable(),
  updated_at: z.string(),
});

const createdSiteRowSchema = siteRowSchema.extend({
  page_id: z.string().uuid(),
});

export interface TreshSiteSummary {
  id: string;
  slug: string;
  name: string;
  publicUrl: string | null;
  updatedAt: number;
}

export interface CreatedTreshSite extends TreshSiteSummary {
  pageId: string;
}

export interface CreateTreshSiteInput {
  name: string;
  slug: string;
  document: SiteDocument;
}

function mapSite(row: z.infer<typeof siteRowSchema>): TreshSiteSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    publicUrl: row.public_url,
    updatedAt: Date.parse(row.updated_at),
  };
}

export function normalizeSiteSlug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

export async function listAccountSites(): Promise<TreshSiteSummary[]> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase n’est pas configuré.');

  const { data, error } = await client
    .from('sites')
    .select('id, slug, name, public_url, updated_at')
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);

  return z.array(siteRowSchema).parse(data ?? []).map(mapSite);
}

export async function createAccountSite(
  input: CreateTreshSiteInput,
): Promise<CreatedTreshSite> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase n’est pas configuré.');

  const name = input.name.trim();
  const slug = normalizeSiteSlug(input.slug);

  if (name.length < 2 || name.length > 120) {
    throw new Error('Le nom du site doit contenir entre 2 et 120 caractères.');
  }

  if (!slug) {
    throw new Error('Choisis une adresse interne valide pour le site.');
  }

  const { data, error } = await client.rpc('create_tresh_site', {
    p_name: name,
    p_slug: slug,
    p_document: input.document,
    p_schema_version: input.document.schemaVersion,
  });

  if (error) {
    if (
      error.code === '23505' ||
      error.message.toLowerCase().includes('duplicate')
    ) {
      throw new Error(`L’adresse « ${slug} » est déjà utilisée.`);
    }

    throw new Error(error.message);
  }

  const first = Array.isArray(data) ? data[0] : data;
  const row = createdSiteRowSchema.parse(first);

  return {
    ...mapSite(row),
    pageId: row.page_id,
  };
}
