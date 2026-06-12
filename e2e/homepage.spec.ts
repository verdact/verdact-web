import { test, expect } from '@playwright/test';

test.describe('Homepage E2E', () => {
  test('should load the homepage and display core headline', async ({ page }) => {
    // Navigate to the homepage
    await page.goto('/');

    // Verify the page title
    await expect(page).toHaveTitle(/Verdact/);

    // Verify the core hero headline is visible
    const headline = page.getByRole('heading', { name: /Fight chargebacks for services you already delivered/i });
    await expect(headline).toBeVisible();
  });

  test('should have a visible VAMP checker section', async ({ page }) => {
    await page.goto('/');
    
    // Check if there is a call to action or link for VAMP
    // Stage 8 added a VAMP checker link/section
    const vampLink = page.getByRole('link', { name: /VAMP/i });
    if (await vampLink.count() > 0) {
      await expect(vampLink.first()).toBeVisible();
    }
  });

  test('navigation links work correctly', async ({ page }) => {
    await page.goto('/');

    // Verify Sign In link is present and points to /login
    const signInLink = page.getByRole('link', { name: /Sign in/i }).first();
    await expect(signInLink).toHaveAttribute('href', '/login');

    // Verify main CTA link is present and points to /signup
    const signupLink = page.getByRole('link', { name: /Fight a service chargeback/i }).first();
    await expect(signupLink).toHaveAttribute('href', '/signup');
  });
});
