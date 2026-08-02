import { invoke, isTauri } from '@tauri-apps/api/core';
import { z } from 'zod';
import {
  parseSiteDocument,
  type SiteDocument,
} from '../editor/model/siteDocument';

const vaultEnvelopeSchema = z.object({
  document: z.unknown(),
  savedAt: z.number().int().nonnegative(),
});

const vaultStatusSchema = z.object({
  available: z.boolean(),
  path: z.string(),
  savedAt: z.number().int().nonnegative().nullable(),
  backupCount: z.number().int().nonnegative(),
});

const vaultLoadResultSchema = z.object({
  envelope: vaultEnvelopeSchema.nullable(),
  status: vaultStatusSchema,
});

export interface DesktopVaultScope {
  accountId: string;
  siteId: string;
}

export interface DesktopVaultEnvelope {
  document: SiteDocument;
  savedAt: number;
}

export interface DesktopVaultStatus {
  available: boolean;
  path: string;
  savedAt: number | null;
  backupCount: number;
}

export interface DesktopVaultLoadResult {
  envelope: DesktopVaultEnvelope | null;
  status: DesktopVaultStatus;
}

export function isDesktopVaultAvailable(): boolean {
  return isTauri();
}

export async function loadDesktopVault(
  scope: DesktopVaultScope,
): Promise<DesktopVaultLoadResult> {
  if (!isDesktopVaultAvailable()) {
    return {
      envelope: null,
      status: {
        available: false,
        path: '',
        savedAt: null,
        backupCount: 0,
      },
    };
  }

  const raw = await invoke<unknown>('vault_load', {
    request: {
      accountId: scope.accountId,
      siteId: scope.siteId,
    },
  });
  const parsed = vaultLoadResultSchema.parse(raw);

  return {
    envelope: parsed.envelope
      ? {
          document: parseSiteDocument(parsed.envelope.document),
          savedAt: parsed.envelope.savedAt,
        }
      : null,
    status: parsed.status,
  };
}

export async function saveDesktopVault(
  scope: DesktopVaultScope,
  envelope: DesktopVaultEnvelope,
): Promise<DesktopVaultStatus> {
  if (!isDesktopVaultAvailable()) {
    return {
      available: false,
      path: '',
      savedAt: null,
      backupCount: 0,
    };
  }

  const raw = await invoke<unknown>('vault_save', {
    request: {
      accountId: scope.accountId,
      siteId: scope.siteId,
      document: envelope.document,
      savedAt: envelope.savedAt,
    },
  });

  return vaultStatusSchema.parse(raw);
}
