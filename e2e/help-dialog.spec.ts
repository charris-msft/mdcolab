import { test, expect } from '@playwright/test';

test.describe('Help Dialog', () => {
  // Navigate and trigger the help dialog via custom event (since HelpButton is only in authenticated views)
  async function openHelpDialog(page: import('@playwright/test').Page) {
    await page.goto('/');
    // Set onboarded to prevent auto-open interference
    await page.evaluate(() => localStorage.setItem('mdcolab-onboarded', 'true'));
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    // Trigger the help dialog via custom event (same as HelpButton does)
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('mdcolab:show-help')));
  }

  test('dialog auto-opens for first-time visitors', async ({ page }) => {
    await page.goto('/');
    // Clear onboarded flag to simulate first visit
    await page.evaluate(() => localStorage.removeItem('mdcolab-onboarded'));
    await page.reload();
    // The dialog auto-opens after 600ms delay
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Welcome to mdcolab')).toBeVisible({ timeout: 5000 });
  });

  test('dialog does not auto-open for returning visitors', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('mdcolab-onboarded', 'true'));
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    // Wait a bit and confirm no dialog
    await page.waitForTimeout(1000);
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('dialog opens via custom event', async ({ page }) => {
    await openHelpDialog(page);
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 });
  });

  test('first step shows "Welcome to mdcolab"', async ({ page }) => {
    await openHelpDialog(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await expect(dialog.getByText('Welcome to mdcolab')).toBeVisible({ timeout: 10000 });
  });

  test('"Get Started" button advances to step 2 ("How It Works")', async ({ page }) => {
    await openHelpDialog(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await dialog.getByRole('button', { name: /get started/i }).click();
    await expect(dialog.getByText('How It Works')).toBeVisible({ timeout: 10000 });
  });

  test('can navigate through all steps with Next', async ({ page }) => {
    await openHelpDialog(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Step 0 → 1
    await dialog.getByRole('button', { name: /get started/i }).click();

    // Step 1 → 2
    await expect(dialog.getByText('How It Works')).toBeVisible({ timeout: 10000 });
    await dialog.getByRole('button', { name: /next/i }).click();

    // Step 2 → 3
    await expect(dialog.getByText('Quick Tips')).toBeVisible({ timeout: 10000 });
    await dialog.getByRole('button', { name: /next/i }).click();

    // Step 3 → 4
    await expect(dialog.getByText('Copilot AI Assistant')).toBeVisible({ timeout: 10000 });
    await dialog.getByRole('button', { name: /next/i }).click();

    // Step 4 (final)
    await expect(dialog.getByText('Security Recommendation')).toBeVisible({ timeout: 10000 });
  });

  test('"Back" button goes to previous step', async ({ page }) => {
    await openHelpDialog(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Advance to step 1
    await dialog.getByRole('button', { name: /get started/i }).click();
    await expect(dialog.getByText('How It Works')).toBeVisible({ timeout: 10000 });

    // Go back to step 0
    await dialog.getByRole('button', { name: /back/i }).click();
    await expect(dialog.getByText('Welcome to mdcolab')).toBeVisible({ timeout: 10000 });
  });

  test('"Skip" button closes the dialog', async ({ page }) => {
    await openHelpDialog(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    await dialog.getByRole('button', { name: /skip/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
  });

  test('final step "Got it" button closes the dialog', async ({ page }) => {
    await openHelpDialog(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Navigate to the final step
    await dialog.getByRole('button', { name: /get started/i }).click();
    for (let i = 0; i < 3; i++) {
      await dialog.getByRole('button', { name: /next/i }).click();
    }
    await expect(dialog.getByText('Security Recommendation')).toBeVisible({ timeout: 10000 });

    // Close with "Got it"
    await dialog.getByRole('button', { name: /got it/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
  });

  test('dialog closes when pressing Escape', async ({ page }) => {
    await openHelpDialog(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
  });
});
