import { test, expect } from '@playwright/test';
import { login } from './helpers';

// Auth tests don't use shared state — they test login directly
test.use({ storageState: undefined });

test.describe.serial('Authentication', () => {
  test('login as admin', async ({ page }) => {
    await login(page, 'admin@crm.local', 'changeme123');
    await expect(page.locator('h1')).toContainText('Tổng quan');
  });

  test('login with wrong password stays on login page', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"], input[id="email"]', 'admin@crm.local');
    await page.fill('input[type="password"], input[id="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/login/);
  });

  test('login as manager', async ({ page }) => {
    await login(page, 'manager@crm.local', 'changeme123');
    await expect(page.locator('h1')).toContainText('Tổng quan');
  });

  test('login as agent_telesale', async ({ page }) => {
    await login(page, 'agent.ts@crm.local', 'changeme123');
    await expect(page.locator('h1')).toContainText('Tổng quan');
  });
});
