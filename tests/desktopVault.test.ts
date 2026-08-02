import { describe, expect, it } from 'vitest';
import {
  isDesktopVaultAvailable,
  loadDesktopVault,
} from '../src/desktop';

describe('desktop vault boundary', () => {
  it('stays disabled in the normal web editor', async () => {
    expect(isDesktopVaultAvailable()).toBe(false);

    const result = await loadDesktopVault({
      accountId: 'account-test',
      siteId: 'site-test',
    });

    expect(result.envelope).toBeNull();
    expect(result.status.available).toBe(false);
    expect(result.status.path).toBe('');
  });
});
