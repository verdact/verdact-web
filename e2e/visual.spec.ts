import { test } from '@playwright/test';

test('capture auth pages for visual inspection', async ({ page }) => {
  await page.goto('/login');
  await page.screenshot({ path: 'login-screenshot.png', fullPage: true });

  await page.goto('/signup');
  await page.screenshot({ path: 'signup-screenshot.png', fullPage: true });
});
