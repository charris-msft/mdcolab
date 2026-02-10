import { test, expect } from '@playwright/test';

test.describe('Theme', () => {
  test('should default to dark theme', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/, { timeout: 10000 });
  });

  test('should load landing page without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const critical = errors.filter(e => !e.includes('ResizeObserver'));
    expect(critical).toHaveLength(0);
  });

  test('should load /d/test/path without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/d/test/path');
    await page.waitForLoadState('networkidle');
    const critical = errors.filter(e => !e.includes('ResizeObserver'));
    expect(critical).toHaveLength(0);
  });

  test('should toggle theme via dropdown menu', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/, { timeout: 10000 });

    // ThemeToggle is a dropdown — click to open, then select "Light"
    const toggle = page.getByRole('button', { name: /toggle theme/i });
    await toggle.click();
    await page.getByRole('menuitem', { name: /light/i }).click();
    await expect(html).toHaveClass(/light/, { timeout: 10000 });

    // Click elsewhere to ensure dropdown is fully dismissed, then re-open
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    await page.waitForTimeout(300);

    // Switch back to dark
    await toggle.click();
    await page.getByRole('menuitem', { name: /dark/i }).click();
    await expect(html).toHaveClass(/dark/, { timeout: 10000 });
  });

  test('should load page content within 5 seconds', async ({ page }) => {
    await page.goto('/', { timeout: 5000 });
    await expect(page.locator('body')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('main')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Accessibility', () => {
  test('should have a main landmark', async ({ page }) => {
    await page.goto('/');
    const main = page.getByRole('main');
    await expect(main).toBeVisible({ timeout: 10000 });
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const h1 = page.locator('h1');
    await expect(h1.first()).toBeVisible({ timeout: 10000 });

    const levels = await page.$$eval(
      'h1, h2, h3, h4, h5, h6',
      (headings) => headings.map(h => parseInt(h.tagName[1], 10))
    );
    expect(levels.length).toBeGreaterThan(0);
    for (let i = 1; i < levels.length; i++) {
      // Each heading should not skip more than one level
      expect(levels[i]).toBeLessThanOrEqual(levels[i - 1] + 1);
    }
  });

  test('should have alt text on all images', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const images = page.locator('img');
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      expect(alt, `Image ${i} is missing alt text`).not.toBeNull();
    }
  });

  test('should allow keyboard navigation for interactive elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const nav = page.getByRole('navigation');
    await expect(nav.first()).toBeVisible({ timeout: 10000 });

    const focusable = nav.first().locator('a, button, [tabindex="0"]');
    const count = await focusable.count();
    expect(count).toBeGreaterThan(0);

    // Tab through the first few interactive elements and verify focus
    await page.keyboard.press('Tab');
    for (let i = 0; i < Math.min(count, 5); i++) {
      const focused = page.locator(':focus');
      const tag = await focused.evaluate(el => el.tagName.toLowerCase()).catch(() => '');
      expect(['a', 'button', 'input', 'select', 'textarea']).toContain(tag);
      await page.keyboard.press('Tab');
    }
  });
});
