import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('should load the landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/mdcolab/i);
  });

  test('should display the hero section', async ({ page }) => {
    await page.goto('/');
    // Look for key marketing copy or heading
    await expect(page.locator('text=markdown').first()).toBeVisible({ timeout: 10000 });
  });

  test('should have a sign-in / get started button', async ({ page }) => {
    await page.goto('/');
    const ctaButton = page.getByRole('button', { name: /get started|sign in|log in/i }).first();
    await expect(ctaButton).toBeVisible({ timeout: 10000 });
  });

  test('should have navigation links', async ({ page }) => {
    await page.goto('/');
    // Check for nav elements
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 10000 });
  });

  test('should be responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await expect(page).toHaveTitle(/mdcolab/i);
  });
});
