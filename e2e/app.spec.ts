import { expect, test } from '@playwright/test';

test('renders the visual editor shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Atelier Expression')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publier' })).toBeVisible();
  await expect(page.getByText('Pas performer. Pas survivre.')).toBeVisible();
});
