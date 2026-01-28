import { test, expect } from '@playwright/test';

// Basic smoke to ensure runner and env wiring works.
test('landing page renders title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/cgcut/i);
});
