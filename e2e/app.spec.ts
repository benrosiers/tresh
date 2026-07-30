import { expect, test } from '@playwright/test';

test('renders the visual editor shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Atelier Expression')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publier' })).toBeVisible();
  await expect(page.getByText('Pas performer. Pas survivre.')).toBeVisible();
});

test('adds and deletes a section with confirmation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Section' }).click();
  await expect(page.getByText('Nouvelle section', { exact: true })).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Supprimer la section Nouvelle section' }).click();
  await expect(page.getByText('Nouvelle section', { exact: true })).toHaveCount(0);
});
