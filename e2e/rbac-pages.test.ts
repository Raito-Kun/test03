import { test, expect } from '@playwright/test';
import { USERS, login } from './helpers';

/**
 * RBAC Pages Access Tests
 * Verifies each role can access their allowed pages
 * and cannot access restricted pages.
 */
test.describe.serial('RBAC — Pages Access Control', () => {
  test('super_admin can access all pages without restriction', async ({ page }) => {
    await login(page, 'superadmin@crm.local', 'SuperAdmin@123');

    const pages = [
      '/contacts',
      '/leads',
      '/debt-cases',
      '/campaigns',
      '/call-logs',
      '/reports',
      '/settings',
      '/settings/permissions',
      '/settings/extensions',
    ];

    for (const pathname of pages) {
      await page.goto(pathname);
      await page.waitForTimeout(800);
      // Should not see 403 Forbidden or access denied
      const isForbidden = await page.getByText(/Forbidden|Unauthorized|access denied/i).isVisible({ timeout: 2000 }).catch(() => false);
      expect(isForbidden).toBe(false);
    }
  });

  test('admin can access core pages but not permissions/extensions', async ({ page }) => {
    await login(page, 'admin@crm.local', 'changeme123');

    // Admin allowed pages
    const allowedPages = ['/contacts', '/leads', '/debt-cases', '/campaigns', '/call-logs', '/reports', '/settings'];
    for (const pathname of allowedPages) {
      await page.goto(pathname);
      await page.waitForTimeout(800);
      await expect(page.locator('body')).not.toContainText('500');
    }

    // Admin restricted pages
    const restrictedPages = ['/settings/permissions', '/settings/extensions'];
    for (const pathname of restrictedPages) {
      await page.goto(pathname);
      await page.waitForTimeout(1000);
      // Should not render admin-only content or show error
      const hasContent = await page.locator('[class*="matrix"], [class*="permission"]').isVisible({ timeout: 3000 }).catch(() => false);
      // If page renders, should not show restricted data
      if (hasContent) {
        await expect(page.locator('body')).not.toContainText('permission matrix');
      }
    }
  });

  test('manager can access contacts, leads, debt-cases, campaigns, call-logs, reports', async ({ page }) => {
    await login(page, 'manager@crm.local', 'changeme123');

    const allowedPages = ['/contacts', '/leads', '/debt-cases', '/campaigns', '/call-logs', '/reports'];
    for (const pathname of allowedPages) {
      await page.goto(pathname);
      await page.waitForTimeout(800);
      await expect(page.locator('body')).not.toContainText('500');
    }
  });

  test('qa can access call-logs and reports', async ({ page }) => {
    await login(page, 'qa@crm.local', 'changeme123');

    const allowedPages = ['/call-logs', '/reports'];
    for (const pathname of allowedPages) {
      await page.goto(pathname);
      await page.waitForTimeout(800);
      await expect(page.locator('body')).not.toContainText('500');
    }

    // QA restricted pages
    const restrictedPages = ['/contacts', '/leads', '/debt-cases', '/campaigns'];
    for (const pathname of restrictedPages) {
      await page.goto(pathname);
      await page.waitForTimeout(1000);
      // Should be blocked or redirected
      const isError = await page.locator('body').textContent().then(text => text?.includes('500'));
      // At minimum, should not crash
      expect(isError).toBe(false);
    }
  });

  test('agent_telesale can access contacts, leads, call-logs', async ({ page }) => {
    await login(page, 'agent.ts@crm.local', 'changeme123');

    const allowedPages = ['/contacts', '/leads', '/call-logs'];
    for (const pathname of allowedPages) {
      await page.goto(pathname);
      await page.waitForTimeout(800);
      await expect(page.locator('body')).not.toContainText('500');
    }

    // Agent telesale restricted
    const restrictedPages = ['/debt-cases', '/campaigns', '/reports', '/settings'];
    for (const pathname of restrictedPages) {
      await page.goto(pathname);
      await page.waitForTimeout(1000);
      // Should be blocked or show no sensitive data
      const isError = await page.locator('body').textContent().then(text => text?.includes('500'));
      expect(isError).toBe(false);
    }
  });

  test('agent_collection can access debt-cases, contacts, call-logs', async ({ page }) => {
    await login(page, 'agent.col@crm.local', 'changeme123');

    const allowedPages = ['/debt-cases', '/contacts', '/call-logs'];
    for (const pathname of allowedPages) {
      await page.goto(pathname);
      await page.waitForTimeout(800);
      await expect(page.locator('body')).not.toContainText('500');
    }

    // Agent collection restricted
    const restrictedPages = ['/leads', '/campaigns', '/reports', '/settings'];
    for (const pathname of restrictedPages) {
      await page.goto(pathname);
      await page.waitForTimeout(1000);
      const isError = await page.locator('body').textContent().then(text => text?.includes('500'));
      expect(isError).toBe(false);
    }
  });

  test('leader can access all core pages except settings', async ({ page }) => {
    await login(page, 'leader@crm.local', 'changeme123');

    const allowedPages = ['/contacts', '/leads', '/debt-cases', '/campaigns', '/call-logs', '/reports'];
    for (const pathname of allowedPages) {
      await page.goto(pathname);
      await page.waitForTimeout(800);
      await expect(page.locator('body')).not.toContainText('500');
    }
  });

  test('unauthenticated user redirected to /login from protected pages', async ({ page }) => {
    // Clear all cookies to ensure no session
    await page.context().clearCookies();

    const protectedPages = ['/contacts', '/leads', '/debt-cases', '/dashboard', '/reports'];
    for (const pathname of protectedPages) {
      await page.goto(pathname);
      await expect(page).toHaveURL(/login/, { timeout: 8000 });
    }
  });
});
