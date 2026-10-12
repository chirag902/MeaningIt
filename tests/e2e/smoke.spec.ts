import { expect, test } from '@playwright/test';

test('home page loads and shows the translator', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const response = await page.goto('/');

  expect(response?.status()).toBe(200);

  // The main heading renders (the intro splash only covers it briefly).
  await expect(page.getByRole('heading', { level: 1, name: 'MeaningIt' })).toBeVisible();

  // The text tab and its input exist.
  await expect(page.getByRole('tab', { name: 'Text' })).toBeVisible();
  await expect(page.getByLabel('Text to translate')).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test('health endpoint reports ok', async ({ request }) => {
  const response = await request.get('/api/health');

  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ status: 'ok' });
});