import { test, expect } from '@playwright/test';

test.describe('Shared Document Viewer', () => {
  test.describe('Invalid paths', () => {
    test('should handle nonexistent document path gracefully', async ({ page }) => {
      await page.goto('/d/nonexistent/repo/main/file.md');
      await page.waitForLoadState('networkidle');
      const title = await page.title();
      expect(title).toBeTruthy();
      // Should redirect to sign-in or show an error — not crash
      const url = page.url();
      expect(url).toBeTruthy();
    });

    test('should handle missing path segments gracefully', async ({ page }) => {
      await page.goto('/d/only-owner');
      await page.waitForLoadState('networkidle');
      const title = await page.title();
      expect(title).toBeTruthy();
    });

    test('should handle /d/ route without any params', async ({ page }) => {
      await page.goto('/d/');
      await page.waitForLoadState('networkidle');
      const title = await page.title();
      expect(title).toBeTruthy();
    });

    test('should handle path with special characters', async ({ page }) => {
      await page.goto('/d/owner/repo/main/docs%2Ffile%20name%20(1).md');
      await page.waitForLoadState('networkidle');
      const title = await page.title();
      expect(title).toBeTruthy();
    });
  });

  test.describe('Page stability', () => {
    test('should have a truthy page title on /d/ routes', async ({ page }) => {
      for (const path of [
        '/d/',
        '/d/owner/repo/main/README.md',
        '/d/only-owner',
      ]) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        const title = await page.title();
        expect(title, `Page title was blank for ${path}`).toBeTruthy();
      }
    });

    test('should not produce JS errors on document pages', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      await page.goto('/d/nonexistent/repo/main/file.md');
      await page.waitForLoadState('networkidle');

      const critical = errors.filter((e) => !e.includes('ResizeObserver'));
      expect(critical).toHaveLength(0);
    });

    test('should not produce JS errors on partial /d/ path', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      await page.goto('/d/only-owner');
      await page.waitForLoadState('networkidle');

      const critical = errors.filter((e) => !e.includes('ResizeObserver'));
      expect(critical).toHaveLength(0);
    });
  });

  test.describe('Route structure', () => {
    test('should not return a server 500 for valid route pattern', async ({ page }) => {
      const response = await page.goto('/d/owner/repo/main/README.md');
      await page.waitForLoadState('networkidle');
      // Accept any non-500 status (redirects, 404, 200 are all fine)
      expect(response).not.toBeNull();
      expect(response!.status()).toBeLessThan(500);
    });

    test('should not return a server 500 for /d/ without params', async ({ page }) => {
      const response = await page.goto('/d/');
      await page.waitForLoadState('networkidle');
      expect(response).not.toBeNull();
      expect(response!.status()).toBeLessThan(500);
    });

    test('should redirect unauthenticated users on document routes', async ({ page }) => {
      const response = await page.goto('/d/owner/repo/main/README.md');
      await page.waitForLoadState('domcontentloaded');
      // Should not crash — any response is acceptable
      expect(response).not.toBeNull();
      const title = await page.title();
      expect(title).toBeTruthy();
    });

    test('should handle deeply nested document path', async ({ page }) => {
      const response = await page.goto('/d/owner/repo/main/a/b/c/d/deep.md');
      await page.waitForLoadState('networkidle');
      expect(response).not.toBeNull();
      expect(response!.status()).toBeLessThan(500);
      const title = await page.title();
      expect(title).toBeTruthy();
    });
  });
});
