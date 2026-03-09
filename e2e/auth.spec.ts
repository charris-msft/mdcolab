import { test, expect } from '@playwright/test';

test.describe('Protected route redirects', () => {
  test('unauthenticated /dashboard redirects away', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL((url) => !url.pathname.startsWith('/dashboard'), {
      timeout: 10000,
    });
    expect(page.url()).not.toContain('/dashboard');
  });

  test('unauthenticated /repos redirects away', async ({ page }) => {
    await page.goto('/repos');
    await page.waitForURL((url) => !url.pathname.startsWith('/repos'), {
      timeout: 10000,
    });
    expect(page.url()).not.toContain('/repos');
  });
});

test.describe('Landing page', () => {
  test('has GitHub sign-in button', async ({ page }) => {
    await page.goto('/');
    const signInButton = page.getByRole('button', {
      name: /sign in with github/i,
    }).first();
    await expect(signInButton).toBeVisible({ timeout: 10000 });
  });

  test('has header/navbar', async ({ page }) => {
    await page.goto('/');
    const navbar = page.locator('header, nav').first();
    await expect(navbar).toBeVisible({ timeout: 10000 });
  });

  test('sign-in button initiates GitHub OAuth flow', async ({ page }) => {
    await page.goto('/');
    const signInButton = page.getByRole('button', {
      name: /sign in with github/i,
    }).first();
    await expect(signInButton).toBeVisible({ timeout: 10000 });

    await signInButton.click();
    // NextAuth routes through /api/auth or redirects to github.com
    await page.waitForURL(
      (url) =>
        url.pathname.includes('/api/auth') ||
        url.hostname.includes('github.com'),
      { timeout: 10000 },
    );
    const currentUrl = page.url();
    const hitsAuthFlow =
      currentUrl.includes('/api/auth') ||
      currentUrl.includes('github.com');
    expect(hitsAuthFlow).toBe(true);
  });
});

test.describe('Auth API', () => {
  test('/api/auth/providers returns github provider info', async ({
    request,
    baseURL,
  }) => {
    const response = await request.get(`${baseURL}/api/auth/providers`);
    expect(response.ok()).toBe(true);

    const providers = await response.json();
    expect(providers).toHaveProperty('github');
    expect(providers.github).toMatchObject({
      id: 'github',
      name: 'GitHub',
      type: 'oauth',
    });
  });
});

test.describe('Navigation', () => {
  test('unknown route shows 404 or redirects', async ({ page }) => {
    const response = await page.goto('/nonexistent-page');
    // Next.js returns 404 for unknown routes
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(404);
  });

  test('back/forward browser navigation works on public pages', async ({
    page,
  }) => {
    // Navigate to landing
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveTitle(/mdcolab/i, { timeout: 10000 });

    // Navigate to a second public URL via link click or goto
    await page.goto('/d/test/repo/main/file.md');
    await page.waitForLoadState('domcontentloaded');

    // Go back — should return to a previous page
    await page.goBack({ timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');
    // The page should have loaded without crashing
    const title = await page.title();
    expect(title).toBeTruthy();
  });
});
