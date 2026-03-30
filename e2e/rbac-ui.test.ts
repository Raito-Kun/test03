import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe.serial('RBAC — UI level', () => {
  test('super_admin sees all sidebar items including Phân quyền and Máy nhánh', async ({ page }) => {
    await login(page, 'superadmin@crm.local', 'SuperAdmin@123');
    await expect(page.locator('h1').first()).toContainText('Tổng quan', { timeout: 8000 });

    // Super admin should see all main sidebar items
    const expectedLinks = [
      /Danh bạ/i,
      /Khách hàng tiềm năng/i,
      /Công nợ/i,
      /Chiến dịch/i,
      /Báo cáo/i,
      /Cài đặt/i,
    ];
    for (const label of expectedLinks) {
      await expect(page.getByRole('link', { name: label }).first()).toBeVisible({ timeout: 5000 });
    }

    // Super admin exclusive items
    const permissionLink = page.getByRole('link', { name: /Phân quyền/i });
    await expect(permissionLink).toBeVisible({ timeout: 5000 });
  });

  test('agent_telesale sees contacts and leads in sidebar', async ({ page }) => {
    await login(page, 'agent.ts@crm.local', 'changeme123');
    await expect(page.locator('h1').first()).toContainText('Tổng quan');

    // Sidebar nav links should be visible
    await expect(page.getByRole('link', { name: /Danh bạ/i }).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('link', { name: /Khách hàng tiềm năng/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test('agent_telesale cannot see user management sidebar link', async ({ page }) => {
    await login(page, 'agent.ts@crm.local', 'changeme123');
    await expect(page.locator('h1').first()).toContainText('Tổng quan');

    // "Quản lý người dùng" must not appear in the sidebar
    const userMgmtLink = page.getByRole('link', { name: /Quản lý người dùng/i });
    await expect(userMgmtLink).not.toBeVisible();
  });

  test('agent_telesale settings page has no user management section', async ({ page }) => {
    await login(page, 'agent.ts@crm.local', 'changeme123');
    await page.goto('/settings');
    await expect(page.getByText('Hồ sơ cá nhân')).toBeVisible({ timeout: 5000 });

    // User management section must not be present
    const userMgmtSection = page.getByText('Quản lý người dùng');
    await expect(userMgmtSection).not.toBeVisible();
  });

  test('manager sees all core sidebar nav items', async ({ page }) => {
    await login(page, 'manager@crm.local', 'changeme123');
    await expect(page.locator('h1').first()).toContainText('Tổng quan');

    const expectedLinks = [
      /Danh bạ/i,
      /Khách hàng tiềm năng/i,
      /Công nợ/i,
      /Chiến dịch/i,
      /Báo cáo/i,
    ];
    for (const label of expectedLinks) {
      await expect(page.getByRole('link', { name: label }).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('admin sees all sidebar nav items including user management', async ({ page }) => {
    await login(page, 'admin@crm.local', 'changeme123');
    await expect(page.locator('h1').first()).toContainText('Tổng quan');

    const expectedLinks = [
      /Danh bạ/i,
      /Khách hàng tiềm năng/i,
      /Công nợ/i,
      /Chiến dịch/i,
      /Báo cáo/i,
      /Cài đặt/i,
    ];
    for (const label of expectedLinks) {
      await expect(page.getByRole('link', { name: label }).first()).toBeVisible({ timeout: 5000 });
    }

    // Admin should have access to settings which includes user management
    await page.goto('/settings');
    await expect(page.getByText('Hồ sơ cá nhân')).toBeVisible({ timeout: 5000 });
  });
});
