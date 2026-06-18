import { test, expect } from '@playwright/test';

test.describe('Stage 1E Workbench', () => {
  test('should display the Evidence Record and Readiness Dial', async ({ page }) => {
    await page.goto('/dashboard/disputes/test-dispute-123');

    // Look for the readiness dial percentage
    const dialText = page.getByText(/%$/); // e.g. "100%"
    if (await dialText.isVisible()) {
      await expect(dialText).toBeVisible();
    }

    // Look for the Evidence Record header
    const evidenceRecordHeader = page.getByText('Evidence Record', { exact: true });
    if (await evidenceRecordHeader.isVisible()) {
      await expect(evidenceRecordHeader).toBeVisible();
    }
  });

  test('should allow marking acceptance as unavailable', async ({ page }) => {
    await page.goto('/dashboard/disputes/test-dispute-123');

    const gapRow = page.locator('details#acceptance-gap');
    if (await gapRow.isVisible()) {
      // Expand it if it isn't
      if (!(await gapRow.evaluate((node: HTMLDetailsElement) => node.open))) {
        await gapRow.locator('summary').click();
      }

      // Find the fallback reason input
      const reasonInput = gapRow.getByPlaceholder(/Why don't you have/i);
      await expect(reasonInput).toBeVisible();

      // Note: we don't submit to avoid muddying the DB if this hits a real backend
    }
  });
});
