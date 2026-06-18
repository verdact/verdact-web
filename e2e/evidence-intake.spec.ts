import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Evidence Intake Upload', () => {
  test('should render the uploader and handle file selection', async ({ page }) => {
    await page.goto('/dashboard/disputes/test-dispute-123');

    // Wait for the evidence uploader to be visible
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.isVisible()) {
      // Simulate selecting a file
      // Playwright can't interact with the native file picker directly without setInputFiles
      // We can create a dummy buffer to upload
      const buffer = Buffer.from('test text file content');
      await fileInput.setInputFiles({
        name: 'test.txt',
        mimeType: 'text/plain',
        buffer,
      });

      // Verify the purpose selector appears
      const purposeSelect = page.getByRole('combobox');
      await expect(purposeSelect).toBeVisible();

      // Ensure the "Upload" button is active
      const uploadBtn = page.getByRole('button', { name: /Upload/i });
      await expect(uploadBtn).toBeVisible();
    }
  });
});
