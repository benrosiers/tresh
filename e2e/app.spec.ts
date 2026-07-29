import { expect, test } from '@playwright/test';

test('foundation shell is explicit about unavailable functionality', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Fondation du véritable éditeur' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('aucune fausse publication');
});
