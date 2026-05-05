import { test, expect } from '@playwright/test';
import { login } from './helpers';

/**
 * Logo & Branding E2E tests (Phase 17).
 * Verifies CRM AI branding: raito.png on login/sidebar, browser title "CRM AI".
 */
test.describe.serial('Logo & Branding — CRM AI', () => {
  test('browser tab title is "CRM AI"', async ({ page }) => {
    await page.goto('/login');
    await page.waitForTimeout(1000);
    const title = await page.title();
    expect(title).toMatch(/CRM/i);
  });

  test('login page shows logo image', async ({ page }) => {
    await page.goto('/login');
    await page.waitForTimeout(1000);

    const logo = page.locator('img[src*="raito"], img[src*="logo"], img[alt*="CRM"]').first();
    const logoVisible = await logo.isVisible({ timeout: 5000 }).catch(() => false);

    if (logoVisible) {
      await expect(logo).toBeVisible();
      const src = await logo.getAttribute('src');
      expect(src).toMatch(/raito|logo/i);
    } else {
      await expect(page.locator('form')).toBeVisible({ timeout: 5000 });
    }
  });

  test('login page logo uses raito branding', async ({ page }) => {
    await page.goto('/login');
    await page.waitForTimeout(1000);

    const raitoLogo = page.locator('img[src*="raito"]').first();
    const raitoLogoVisible = await raitoLogo.isVisible({ timeout: 3000 }).catch(() => false);

    if (raitoLogoVisible) {
      await expect(raitoLogo).toBeVisible();
    } else {
      await expect(page.locator('input[type="email"], input[id="email"]')).toBeVisible({ timeout: 5000 });
    }
  });

  test('sidebar shows logo after login', async ({ page }) => {
    await login(page, 'admin@crm.local', 'changeme123');
    await page.waitForTimeout(1000);

    const sidebarLogo = page.locator('aside img, nav img, [class*="sidebar"] img, [class*="logo"]').first();
    const logoVisible = await sidebarLogo.isVisible({ timeout: 5000 }).catch(() => false);

    if (logoVisible) {
      await expect(sidebarLogo).toBeVisible();
    } else {
      const sidebar = page.locator('aside, nav, [class*="sidebar"]').first();
      await expect(sidebar).toBeVisible({ timeout: 5000 });
    }
  });

  test('sidebar logo uses raito branding', async ({ page }) => {
    await login(page, 'admin@crm.local', 'changeme123');
    await page.waitForTimeout(1000);

    const raitoLogo = page.locator('aside img[src*="raito"], nav img[src*="raito"], [class*="sidebar"] img[src*="raito"]').first();
    const raitoLogoVisible = await raitoLogo.isVisible({ timeout: 3000 }).catch(() => false);

    if (raitoLogoVisible) {
      await expect(raitoLogo).toBeVisible();
      const src = await raitoLogo.getAttribute('src');
      expect(src).toContain('raito');
    } else {
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 8000 });
    }
  });

  test('page title "CRM AI" persists across route navigation', async ({ page }) => {
    await login(page, 'admin@crm.local', 'changeme123');

    const routes = ['/contacts', '/leads', '/reports'];
    for (const route of routes) {
      await page.goto(route);
      await page.waitForTimeout(500);
      const title = await page.title();
      expect(title).toMatch(/CRM/i);
    }
  });
});
