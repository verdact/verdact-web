import { test, expect } from '@playwright/test';

test.describe('Auth Pages E2E', () => {
  test('should load the login page and display core text', async ({ page }) => {
    await page.goto('/login');

    await expect(page).toHaveTitle(/Sign in/);

    const heading = page.getByRole('heading', { name: /Welcome back/i });
    await expect(heading).toBeVisible();

    const form = page.locator('form').first();
    await expect(form).toBeVisible();

    const sampleText = page.getByText('Example workspace');
    await expect(sampleText).toBeVisible();
  });

  test('should load the signup page and display core text', async ({ page }) => {
    await page.goto('/signup');

    await expect(page).toHaveTitle(/Create your workspace/);

    const heading = page.getByRole('heading', { name: /Create your evidence workspace/i });
    await expect(heading).toBeVisible();

    const form = page.locator('form').first();
    await expect(form).toBeVisible();

    const sampleText = page.getByText('Workspace preview');
    await expect(sampleText).toBeVisible();
  });
});
