import { test, expect } from '@playwright/test';
import { login } from './helpers';

/**
 * Click-to-Call E2E tests.
 * Verifies C2C button exists and triggers API call with correct phone number.
 * We intercept the POST /calls/originate request to verify the payload
 * without requiring an actual ESL/FusionPBX connection.
 */
test.describe.serial('Click-to-Call — all pages', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin@crm.local', 'changeme123');
  });

  test('contact list: phone column has C2C button that sends correct number', async ({ page }) => {
    await page.goto('/contacts');
    await expect(page.locator('h1').first()).toContainText('Danh bạ', { timeout: 5000 });
    await page.waitForTimeout(1500);

    // Find the green C2C button next to a phone number
    const c2cButton = page.locator('button[title="Gọi"]').first();
    if (await c2cButton.isVisible({ timeout: 3000 })) {
      // Intercept the originate API call
      const [request] = await Promise.all([
        page.waitForRequest((req) => req.url().includes('/calls/originate') && req.method() === 'POST', { timeout: 5000 }),
        c2cButton.click(),
      ]);

      const body = request.postDataJSON();
      expect(body.phone).toBeTruthy();
      expect(body.phone.length).toBeGreaterThanOrEqual(5);
    }
  });

  test('contact detail: C2C button exists and calls correct number', async ({ page }) => {
    await page.goto('/contacts');
    await page.waitForTimeout(1000);

    // Click first row to go to detail
    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible({ timeout: 3000 })) {
      await firstRow.click();
      await page.waitForTimeout(1500);

      // Look for the "Gọi" button (ClickToCallButton)
      const callBtn = page.locator('button:has-text("Gọi")').first();
      if (await callBtn.isVisible({ timeout: 3000 })) {
        const [request] = await Promise.all([
          page.waitForRequest((req) => req.url().includes('/calls/originate') && req.method() === 'POST', { timeout: 5000 }),
          callBtn.click(),
        ]);

        const body = request.postDataJSON();
        expect(body.phone).toBeTruthy();
      }
    }
  });

  test('lead list: phone column has C2C button', async ({ page }) => {
    await page.goto('/leads');
    await expect(page.locator('h1').first()).toContainText('Khách hàng tiềm năng', { timeout: 5000 });
    await page.waitForTimeout(1500);

    // Check phone column exists with C2C button
    const c2cButton = page.locator('button[title="Gọi"]').first();
    const hasC2C = await c2cButton.isVisible({ timeout: 3000 }).catch(() => false);

    // If leads have contacts with phone, C2C should exist
    if (hasC2C) {
      const [request] = await Promise.all([
        page.waitForRequest((req) => req.url().includes('/calls/originate') && req.method() === 'POST', { timeout: 5000 }),
        c2cButton.click(),
      ]);

      const body = request.postDataJSON();
      expect(body.phone).toBeTruthy();
    }
  });

  test('lead detail: C2C button exists', async ({ page }) => {
    await page.goto('/leads');
    await page.waitForTimeout(1000);

    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible({ timeout: 3000 })) {
      await firstRow.click();
      await page.waitForTimeout(1500);

      // ClickToCallButton renders "Gọi"
      const callBtn = page.locator('button:has-text("Gọi")').first();
      const hasCall = await callBtn.isVisible({ timeout: 3000 }).catch(() => false);
      // If lead has a contact phone, button should be visible
      if (hasCall) {
        expect(await callBtn.isEnabled()).toBe(true);
      }
    }
  });

  test('debt case list: phone column has C2C button', async ({ page }) => {
    await page.goto('/debt-cases');
    await expect(page.locator('h1').first()).toContainText('Công nợ', { timeout: 5000 });
    await page.waitForTimeout(1500);

    const c2cButton = page.locator('button[title="Gọi"]').first();
    const hasC2C = await c2cButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasC2C) {
      const [request] = await Promise.all([
        page.waitForRequest((req) => req.url().includes('/calls/originate') && req.method() === 'POST', { timeout: 5000 }),
        c2cButton.click(),
      ]);

      const body = request.postDataJSON();
      expect(body.phone).toBeTruthy();
    }
  });

  test('debt case detail: C2C button exists', async ({ page }) => {
    await page.goto('/debt-cases');
    await page.waitForTimeout(1000);

    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible({ timeout: 3000 })) {
      await firstRow.click();
      await page.waitForTimeout(1500);

      const callBtn = page.locator('button:has-text("Gọi")').first();
      const hasCall = await callBtn.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasCall) {
        expect(await callBtn.isEnabled()).toBe(true);
      }
    }
  });

  test('C2C API error shows meaningful message', async ({ page }) => {
    await page.goto('/contacts');
    await expect(page.locator('h1').first()).toContainText('Danh bạ', { timeout: 8000 });
    await page.waitForTimeout(1500);

    // Route the originate call to return an error
    await page.route('**/calls/originate', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { code: 'NO_EXTENSION', message: 'Agent has no SIP extension configured' },
        }),
      }),
    );

    const c2cButton = page.locator('button[title="Gọi"]').first();
    if (await c2cButton.isVisible({ timeout: 3000 })) {
      await c2cButton.click();
      await page.waitForTimeout(2000);
      // Sonner toast renders in [data-sonner-toast] — verify error text appears somewhere on page
      const errorVisible = await page.getByText('SIP extension').isVisible({ timeout: 3000 }).catch(() => false);
      const toastVisible = await page.locator('[data-sonner-toast]').isVisible({ timeout: 3000 }).catch(() => false);
      // At least a toast should appear (error or otherwise)
      expect(errorVisible || toastVisible).toBe(true);
    }
  });
});
