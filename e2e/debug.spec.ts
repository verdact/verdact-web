import { test, expect } from '@playwright/test';

test('debug signup page CSS', async ({ page }) => {
  await page.goto('/signup');
  
  // Wait for animations to finish
  await page.waitForTimeout(1000);
  
  const formCard = page.locator('.surface-card').first();
  const opacity = await formCard.evaluate((node) => window.getComputedStyle(node).opacity);
  const color = await formCard.evaluate((node) => window.getComputedStyle(node).color);
  const bg = await formCard.evaluate((node) => window.getComputedStyle(node).backgroundColor);
  
  const googleBtn = page.locator('.btn-secondary').first();
  const btnOpacity = await googleBtn.evaluate((node) => window.getComputedStyle(node).opacity);
  const btnColor = await googleBtn.evaluate((node) => window.getComputedStyle(node).color);
  
  console.log('--- Form Card ---');
  console.log('Opacity:', opacity);
  console.log('Color:', color);
  console.log('Background:', bg);
  
  console.log('--- Google Btn ---');
  console.log('Opacity:', btnOpacity);
  console.log('Color:', btnColor);
  
  await page.screenshot({ path: 'signup-debug.png' });
});
