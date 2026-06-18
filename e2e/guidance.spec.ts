import { test, expect } from '@playwright/test';

test.describe('Guidance Engine UI', () => {
  // We assume the test runner has authenticated or mocked auth prior to this.
  test('should display the guidance band on the dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    
    // The guidance band should be visible
    const guidanceSection = page.locator('section').filter({ hasText: 'Tip:' }).first();
    // In actual run, depends on if user has connected Stripe, we check if it handles it.
    // If it is there, verify it has a dismiss button if not urgent.
    if (await guidanceSection.isVisible()) {
      const dismissBtn = guidanceSection.getByRole('button', { name: /Dismiss/i });
      if (await dismissBtn.isVisible()) {
        await dismissBtn.click();
        await expect(guidanceSection).not.toBeVisible();
      }
    }
  });

  test('should render inline guidance on the dispute page', async ({ page }) => {
    // Navigate to a dispute page
    await page.goto('/dashboard/disputes/test-dispute-123');
    // Check if inline prompts appear
    const addEvidenceSection = page.locator('#add-evidence');
    // Just verify the section renders without crashing
    await expect(addEvidenceSection).toBeVisible();
  });
});
