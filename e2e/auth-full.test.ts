import { test, expect } from '@playwright/test';
import { USERS, login, logout } from './helpers';

// Auth tests bypass shared storage state
test.use({ storageState: undefined });

test.describe.serial('Auth — full coverage', () => {
  test.setTimeout(60000); // Extra time for multiple login/logout cycles
  test('super_admin can log in and see dashboard', async ({ page }) => {
    await login(page, 'superadmin@crm.local', 'SuperAdmin@123');
    await expect(page.locator('h1').first()).toContainText('Tổng quan', { timeout: 8000 });
    await page.goto('/login');
    await page.waitForTimeout(1500);
  });

  test('all roles can log in and see dashboard', async ({ page }) => {
    // Test first 3 roles to avoid rate limiting; remaining roles tested individually
    const subset = USERS.slice(1, 4); // Skip superadmin (already tested)
    for (const user of subset) {
      await login(page, user.email, user.password);
      await expect(page.locator('h1').first()).toContainText('Tổng quan', { timeout: 8000 });
      // Navigate to login directly instead of using logout (avoids dropdown timing issues)
      await page.goto('/login');
      await page.waitForTimeout(1500);
    }
  });

  test('remaining roles can log in', async ({ page }) => {
    const subset = USERS.slice(4); // Skip superadmin and first 3
    for (const user of subset) {
      await login(page, user.email, user.password);
      await expect(page.locator('h1').first()).toContainText('Tổng quan', { timeout: 8000 });
      await page.goto('/login');
      await page.waitForTimeout(1500);
    }
  });

  test('wrong password stays on /login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"], input[id="email"]', 'admin@crm.local');
    await page.fill('input[type="password"], input[id="password"]', 'wrongpassword!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2500);
    await expect(page).toHaveURL(/login/);
  });

  test('empty fields show validation or stay on /login', async ({ page }) => {
    await page.goto('/login');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);
    // Either native HTML5 validation prevents submit or the page stays on /login
    await expect(page).toHaveURL(/login/);
  });

  test('logout redirects to /login', async ({ page }) => {
    await login(page, 'admin@crm.local', 'changeme123');
    await expect(page.locator('h1').first()).toContainText('Tổng quan');
    await logout(page);
    await expect(page).toHaveURL(/login/);
  });

  test('accessing protected page without auth redirects to /login', async ({ page }) => {
    // Clear all cookies/storage to ensure unauthenticated state
    await page.context().clearCookies();
    await page.goto('/contacts');
    await expect(page).toHaveURL(/login/, { timeout: 8000 });
  });
});
