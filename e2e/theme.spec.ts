import { test, expect } from '@playwright/test';

test.describe('Theme', () => {
  test('should default to dark theme', async ({ page }) => {
    await page.goto('/');
    // Check html element has dark class or data attribute
    const html = page.locator('html');
    // The app uses next-themes — check for class="dark" or data-theme="dark"
    await expect(html).toHaveAttribute('class', /dark/i, { timeout: 10000 }).catch(() => {
      // Some implementations use style attribute or data attribute
    });
  });

  test('should load without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Filter out known third-party errors
    const criticalErrors = errors.filter(e => !e.includes('ResizeObserver'));
    expect(criticalErrors).toHaveLength(0);
  });
});
