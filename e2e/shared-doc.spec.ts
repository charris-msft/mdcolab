import { test, expect } from '@playwright/test';

test.describe('Shared Document URL', () => {
  test('should handle invalid document path gracefully', async ({ page }) => {
    await page.goto('/d/nonexistent/repo/main/file.md');
    // Should either redirect to login or show error
    await page.waitForLoadState('networkidle');
    // The page should not crash
    const title = await page.title();
    expect(title).toBeTruthy();
  });
});
