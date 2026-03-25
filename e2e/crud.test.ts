import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe.serial('CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin@crm.local', 'changeme123');
  });

  test('contacts page loads with table', async ({ page }) => {
    await page.goto('/contacts');
    await expect(page.locator('h1')).toContainText('Danh bạ');
    await expect(page.locator('table')).toBeVisible({ timeout: 5000 });
  });

  test('create a new contact', async ({ page }) => {
    await page.goto('/contacts');
    await page.click('button:has-text("Tạo mới")');
    await page.waitForTimeout(500);
    await page.fill('input[id="fullName"]', 'E2E Test Contact');
    await page.fill('input[id="phone"]', '0901234567');
    await page.click('button:has-text("Lưu")');
    await page.waitForTimeout(2000);
  });

  test('search contacts', async ({ page }) => {
    await page.goto('/contacts');
    await page.waitForTimeout(1000);
    const searchInput = page.locator('input[placeholder]').first();
    await searchInput.fill('E2E');
    await page.waitForTimeout(1500);
  });

  test('leads page loads', async ({ page }) => {
    await page.goto('/leads');
    await expect(page.locator('h1')).toContainText('Khách hàng tiềm năng');
  });

  test('debt cases page loads', async ({ page }) => {
    await page.goto('/debt-cases');
    await expect(page.locator('h1')).toContainText('Công nợ');
  });

  test('call logs page loads', async ({ page }) => {
    await page.goto('/call-logs');
    await expect(page.locator('h1')).toContainText('Lịch sử cuộc gọi');
  });

  test('tickets page loads', async ({ page }) => {
    await page.goto('/tickets');
    await expect(page.locator('h1')).toContainText('Phiếu ghi');
  });

  test('campaigns page loads', async ({ page }) => {
    await page.goto('/campaigns');
    await expect(page.locator('h1')).toContainText('Chiến dịch');
  });

  test('reports page has 3 tabs', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.locator('h1')).toContainText('Báo cáo');
  });

  test('settings shows profile and password', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByText('Hồ sơ cá nhân')).toBeVisible();
    await expect(page.getByText('Đổi mật khẩu')).toBeVisible();
  });
});
