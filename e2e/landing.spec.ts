import { test, expect, type Page } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Page Load', () => {
    test('should load with correct title', async ({ page }) => {
      await expect(page).toHaveTitle(/mdcolab/i, { timeout: 10000 });
    });
  });

  test.describe('Hero Section', () => {
    test('should display the hero heading', async ({ page }) => {
      await expect(
        page.getByRole('heading', { name: /AI-powered markdown collaboration, reimagined/i }),
      ).toBeVisible({ timeout: 10000 });
    });

    test('should display the hero subtext', async ({ page }) => {
      await expect(
        page.getByText(/Write with a rich WYSIWYG editor and built-in Copilot AI/i),
      ).toBeVisible({ timeout: 10000 });
    });

    test('should display a sign-in CTA button', async ({ page }) => {
      const ctaButton = page
        .getByRole('button', { name: /sign in/i })
        .or(page.getByRole('link', { name: /sign in/i }));
      await expect(ctaButton.first()).toBeVisible({ timeout: 10000 });
    });

    test('should display "Free to use" text', async ({ page }) => {
      await expect(
        page.getByText(/Free to use · No credit card required/i),
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('How It Works Section', () => {
    test('should display the section heading', async ({ page }) => {
      await expect(
        page.getByRole('heading', { name: /How it works/i }),
      ).toBeVisible({ timeout: 10000 });
    });

    const steps = [
      'Write in Markdown',
      'Share via URL',
      'Comment like Word',
      'Everything in GitHub',
    ];

    for (const step of steps) {
      test(`should display step: "${step}"`, async ({ page }) => {
        await expect(
          page.getByRole('heading', { name: step }).first(),
        ).toBeVisible({ timeout: 10000 });
      });
    }
  });

  test.describe('Features Section', () => {
    test('should display the section heading', async ({ page }) => {
      await expect(
        page.getByRole('heading', {
          name: /Everything you need to collaborate on markdown/i,
        }),
      ).toBeVisible({ timeout: 10000 });
    });

    const features = [
      'GitHub Copilot Built-in',
      'WYSIWYG Editor',
      'Word-Style Comments',
      'Share via URL',
      'Suggested Edits',
      'Version Controlled',
      'Dark Mode First',
    ];

    for (const feature of features) {
      test(`should display feature card: "${feature}"`, async ({ page }) => {
        await expect(
          page.getByRole('heading', { name: feature }).first(),
        ).toBeVisible({ timeout: 10000 });
      });
    }
  });

  test.describe('Navigation', () => {
    test('should display the nav bar', async ({ page }) => {
      await expect(page.locator('nav').first()).toBeVisible({ timeout: 10000 });
    });

    test('should display the logo', async ({ page }) => {
      const logo = page.locator('nav').first().locator('img, svg, a').first();
      await expect(logo).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Footer', () => {
    test('should display the footer', async ({ page }) => {
      await expect(page.locator('footer').first()).toBeVisible({
        timeout: 10000,
      });
    });
  });

  test.describe('Responsive Layout', () => {
    const viewports = [
      { name: 'mobile', width: 375, height: 812 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1280, height: 800 },
    ];

    for (const vp of viewports) {
      test(`should render without errors on ${vp.name} (${vp.width}x${vp.height})`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto('/');
        await expect(page).toHaveTitle(/mdcolab/i, { timeout: 10000 });
        await expect(
          page.getByRole('heading', {
            name: /AI-powered markdown collaboration, reimagined/i,
          }),
        ).toBeVisible({ timeout: 10000 });
      });
    }
  });

  test.describe('Console Errors', () => {
    test('should have no console errors on page load', async ({ page }) => {
      const errors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          // Filter out benign warnings
          if (!text.includes('ResizeObserver') && !text.includes('CLIENT_FETCH_ERROR')) {
            errors.push(text);
          }
        }
      });

      await page.goto('/');
      // Wait for page to settle
      await page.waitForLoadState('networkidle', { timeout: 10000 });

      expect(errors).toEqual([]);
    });
  });
});
