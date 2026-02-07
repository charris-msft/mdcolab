import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should redirect unauthenticated users from dashboard to login', async ({ page }) => {
    await page.goto('/dashboard');
    // Should redirect to login or show login prompt
    await page.waitForURL(/\/(login|api\/auth|$)/, { timeout: 10000 });
    // Verify we're not on the dashboard
    const url = page.url();
    expect(url).not.toContain('/dashboard');
  });

  test('should redirect unauthenticated users from repos to login', async ({ page }) => {
    await page.goto('/repos');
    await page.waitForURL(/\/(login|api\/auth|$)/, { timeout: 10000 });
    const url = page.url();
    expect(url).not.toContain('/repos');
  });

  test('landing page should have GitHub sign-in option', async ({ page }) => {
    await page.goto('/');
    // Look for GitHub login button on landing page (no dedicated /login route exists)
    const githubButton = page.getByRole('button', { name: /github|sign in/i }).first();
    await expect(githubButton).toBeVisible({ timeout: 10000 });
  });
});
