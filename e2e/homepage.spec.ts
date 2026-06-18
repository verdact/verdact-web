import { test, expect } from '@playwright/test';

test.describe('Homepage E2E', () => {
  test('should load the homepage and display core headline', async ({ page }) => {
    // Navigate to the homepage
    await page.goto('/');

    // Verify the page title
    await expect(page).toHaveTitle(/Verdact/);

    // Verify the current approved hero headline is visible
    const headline = page.getByRole('heading', { name: /Win the Stripe disputes everyone else marks unwinnable/i });
    await expect(headline).toBeVisible();
  });

  test('should have a visible VAMP checker section', async ({ page }) => {
    await page.goto('/');
    
    const checkerLink = page.getByRole('link', { name: /Dispute rate checker/i }).first();
    await expect(checkerLink).toBeVisible();
    await expect(checkerLink).toHaveAttribute('href', '/tools/vamp-check');
  });

  test('navigation links work correctly', async ({ page }) => {
    await page.goto('/');

    // Verify Sign In link is present and points to /login
    const signInLink = page.getByRole('link', { name: /Sign in/i }).first();
    await expect(signInLink).toHaveAttribute('href', '/login');

    // Verify main CTA link is present and points to /signup
    const signupLink = page.getByRole('link', { name: /Connect Stripe, see your winnable cases/i }).first();
    await expect(signupLink).toHaveAttribute('href', '/signup');
  });
});
