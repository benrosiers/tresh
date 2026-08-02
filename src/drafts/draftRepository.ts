import { z } from 'zod';
import {
  parseSiteDocument,
  type SiteDocument,
} from '../editor/model/siteDocument';
import { getSupabaseClient } from '../lib/supabase/client';

const configuredSiteSlug =
  import.meta.env.VITE_TRESH_SITE_SLUG?.trim() ||
  'atelier-expression';

const currentLegacyLocalKey =
  `tresh.local-draft.${configuredSiteSlug}.home.v2`;

const originalLegacyLocalKey =
  'tresh.local-draft.atelierexpression.v1';

const localEnvelopeSchema = z.object({
  document: z.unknown(),
  savedAt: z.number().int().nonnegative(),
});

const uuidRowSchema = z.object({
  id: z.string().uuid(),
});

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

export interface DraftScope {
  accountId: string;
  siteId: string;
  siteSlug: string;
}

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
    super(
      'Le brouillon a été modifié ailleurs. Recharge la page avant de continuer.',
    );
    this.name = 'DraftConflictError';
  }
}

function safeKeyPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'local';
}

export function getLocalDraftKey(
  scope: DraftScope,
): string {
  return [
    'tresh.local-draft',
    safeKeyPart(scope.accountId),
    safeKeyPart(scope.siteId),
    'v3',
  ].join('.');
}

function parseLocalEnvelope(
  raw: string,
): LocalDraftEnvelope | null {
  try {
    const envelope = localEnvelopeSchema.parse(
      JSON.parse(raw),
    );

    return {
      document: parseSiteDocument(envelope.document),
      savedAt: envelope.savedAt,
    };
  } catch {
    return null;
  }
}

function migrateLegacyDraft(
  scope: DraftScope,
): LocalDraftEnvelope | null {
  if (scope.siteSlug !== configuredSiteSlug) {
    return null;
  }

  const keys = [
    currentLegacyLocalKey,
    originalLegacyLocalKey,
  ];

  for (const key of keys) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;

    let migrated: LocalDraftEnvelope | null = null;

    if (key === originalLegacyLocalKey) {
      try {
        migrated = {
          document: parseSiteDocument(JSON.parse(raw)),
          savedAt: Date.now(),
        };
      } catch {
        migrated = null;
      }
    } else {
      migrated = parseLocalEnvelope(raw);
    }

    window.localStorage.removeItem(key);

    if (migrated) {
      saveLocalDraft(scope, migrated);
      return migrated;
    }
  }

  return null;
}

export function loadLocalDraft(
  scope: DraftScope,
): LocalDraftEnvelope | null {
  if (typeof window === 'undefined') return null;

  const key = getLocalDraftKey(scope);
  const raw = window.localStorage.getItem(key);

  if (raw) {
    const envelope = parseLocalEnvelope(raw);

    if (envelope) return envelope;

    window.localStorage.removeItem(key);
  }

  return migrateLegacyDraft(scope);
}

export function saveLocalDraft(
  scope: DraftScope,
  envelope: LocalDraftEnvelope,
): void {
  window.localStorage.setItem(
    getLocalDraftKey(scope),
    JSON.stringify(envelope),
  );
}

export function clearLocalDraft(
  scope: DraftScope,
): void {
  window.localStorage.removeItem(
    getLocalDraftKey(scope),
  );
}

export async function loadCloudDraft(
  siteId: string,
): Promise<CloudDraft> {
  const client = getSupabaseClient();

  if (!client) {
    throw new Error('Supabase n’est pas configuré.');
  }

  const { data: pageData, error: pageError } =
    await client
      .from('pages')
      .select('id')
      .eq('site_id', siteId)
      .eq('slug', 'home')
      .maybeSingle();

  if (pageError) throw new Error(pageError.message);

  const page = uuidRowSchema.safeParse(pageData);

  if (!page.success) {
    throw new Error(
      'La page racine de ce site n’existe pas ou n’est pas accessible.',
    );
  }

  const { data: draftData, error: draftError } =
    await client
      .from('page_drafts')
      .select(
        'document, schema_version, lock_version, updated_at',
      )
      .eq('page_id', page.data.id)
      .maybeSingle();

  if (draftError) {
    throw new Error(draftError.message);
  }

  if (!draftData) {
    return {
      pageId: page.data.id,
      document: null,
      lockVersion: 0,
      updatedAt: null,
    };
  }

  const draft = draftRowSchema.parse(draftData);

  if (draft.schema_version !== 1) {
    throw new Error(
      `Version de document non prise en charge: ${draft.schema_version}.`,
    );
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

  if (!client) {
    throw new Error('Supabase n’est pas configuré.');
  }

  const { data, error } = await client.rpc(
    'save_page_draft',
    {
      p_page_id: pageId,
      p_document: document,
      p_schema_version: document.schemaVersion,
      p_expected_lock_version:
        expectedLockVersion,
    },
  );

  if (error) {
    if (
      error.code === '40001' ||
      error.message
        .toLowerCase()
        .includes('draft conflict')
    ) {
      throw new DraftConflictError();
    }

    throw new Error(error.message);
  }

  const first = Array.isArray(data)
    ? data[0]
    : data;
  const saved = savedDraftRowSchema.parse(first);

  return {
    lockVersion: saved.lock_version,
    updatedAt: Date.parse(saved.updated_at),
  };
}
