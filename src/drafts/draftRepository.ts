import { z } from 'zod';
import { getSupabaseClient } from '../lib/supabase/client';
import { parseSiteDocument, type SiteDocument } from '../editor/model/siteDocument';

const siteSlug = import.meta.env.VITE_TRESH_SITE_SLUG?.trim() || 'atelier-expression';
const pageSlug = import.meta.env.VITE_TRESH_PAGE_SLUG?.trim() || 'home';

export const LOCAL_DRAFT_KEY = `tresh.local-draft.${siteSlug}.${pageSlug}.v2`;
const LEGACY_LOCAL_DRAFT_KEY = 'tresh.local-draft.atelierexpression.v1';

const localEnvelopeSchema = z.object({
  document: z.unknown(),
  savedAt: z.number().int().nonnegative(),
});

const uuidRowSchema = z.object({ id: z.string().uuid() });
const draftRowSchema = z.object({
  document: z.unknown(),
  schema_version: z.number().int(),
  lock_version: z.number().int().nonnegative(),
  updated_at: z.string(),
});

const savedDraftRowSchema = z.object({
  lock_version: z.number().int().positive(),
  updated_at: z.string(),
});

export interface LocalDraftEnvelope {
  document: SiteDocument;
  savedAt: number;
}

export interface CloudDraft {
  pageId: string;
  document: SiteDocument | null;
  lockVersion: number;
  updatedAt: number | null;
}

export interface SavedCloudDraft {
  lockVersion: number;
  updatedAt: number;
}

export class DraftConflictError extends Error {
  constructor() {
    super('Le brouillon a été modifié ailleurs. Recharge la page avant de continuer.');
    this.name = 'DraftConflictError';
  }
}

export function loadLocalDraft(): LocalDraftEnvelope | null {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(LOCAL_DRAFT_KEY);
  if (raw) {
    try {
      const envelope = localEnvelopeSchema.parse(JSON.parse(raw));
      return { document: parseSiteDocument(envelope.document), savedAt: envelope.savedAt };
    } catch {
      window.localStorage.removeItem(LOCAL_DRAFT_KEY);
    }
  }

  const legacy = window.localStorage.getItem(LEGACY_LOCAL_DRAFT_KEY);
  if (!legacy) return null;
  try {
    const document = parseSiteDocument(JSON.parse(legacy));
    const migrated = { document, savedAt: Date.now() };
    saveLocalDraft(migrated);
    window.localStorage.removeItem(LEGACY_LOCAL_DRAFT_KEY);
    return migrated;
  } catch {
    window.localStorage.removeItem(LEGACY_LOCAL_DRAFT_KEY);
    return null;
  }
}

export function saveLocalDraft(envelope: LocalDraftEnvelope): void {
  window.localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(envelope));
}

export function clearLocalDraft(): void {
  window.localStorage.removeItem(LOCAL_DRAFT_KEY);
  window.localStorage.removeItem(LEGACY_LOCAL_DRAFT_KEY);
}

export async function loadCloudDraft(): Promise<CloudDraft> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase n’est pas configuré.');

  const { data: siteData, error: siteError } = await client
    .from('sites')
    .select('id')
    .eq('slug', siteSlug)
    .maybeSingle();
  if (siteError) throw siteError;
  const site = uuidRowSchema.safeParse(siteData);
  if (!site.success) throw new Error(`Le site « ${siteSlug} » n’existe pas ou n’est pas accessible.`);

  const { data: pageData, error: pageError } = await client
    .from('pages')
    .select('id')
    .eq('site_id', site.data.id)
    .eq('slug', pageSlug)
    .maybeSingle();
  if (pageError) throw pageError;
  const page = uuidRowSchema.safeParse(pageData);
  if (!page.success) throw new Error(`La page « ${pageSlug} » n’existe pas ou n’est pas accessible.`);

  const { data: draftData, error: draftError } = await client
    .from('page_drafts')
    .select('document, schema_version, lock_version, updated_at')
    .eq('page_id', page.data.id)
    .maybeSingle();
  if (draftError) throw draftError;
  if (!draftData) {
    return { pageId: page.data.id, document: null, lockVersion: 0, updatedAt: null };
  }

  const draft = draftRowSchema.parse(draftData);
  if (draft.schema_version !== 1) {
    throw new Error(`Version de document non prise en charge: ${draft.schema_version}.`);
  }

  return {
    pageId: page.data.id,
    document: parseSiteDocument(draft.document),
    lockVersion: draft.lock_version,
    updatedAt: Date.parse(draft.updated_at),
  };
}

export async function saveCloudDraft(
  pageId: string,
  document: SiteDocument,
  expectedLockVersion: number,
): Promise<SavedCloudDraft> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase n’est pas configuré.');

  const { data, error } = await client.rpc('save_page_draft', {
    p_page_id: pageId,
    p_document: document,
    p_schema_version: document.schemaVersion,
    p_expected_lock_version: expectedLockVersion,
  });

  if (error) {
    if (error.code === '40001' || error.message.toLowerCase().includes('draft conflict')) {
      throw new DraftConflictError();
    }
    throw error;
  }

  const first = Array.isArray(data) ? data[0] : data;
  const saved = savedDraftRowSchema.parse(first);
  return { lockVersion: saved.lock_version, updatedAt: Date.parse(saved.updated_at) };
}
