import { Page, expect } from '@playwright/test';

export const USERS = [
  { email: 'admin@crm.local', password: 'changeme123', role: 'admin' },
  { email: 'manager@crm.local', password: 'changeme123', role: 'manager' },
  { email: 'qa@crm.local', password: 'changeme123', role: 'qa' },
  { email: 'leader@crm.local', password: 'changeme123', role: 'leader' },
  { email: 'agent.ts@crm.local', password: 'changeme123', role: 'agent_telesale' },
  { email: 'agent.col@crm.local', password: 'changeme123', role: 'agent_collection' },
];

export async function login(page: Page, email: string, password: string, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    await page.goto('/login');
    await page.fill('input[type="email"], input[id="email"]', email);
    await page.fill('input[type="password"], input[id="password"]', password);
    await page.click('button[type="submit"]');

    try {
      await page.waitForURL('/', { timeout: 8000 });
      return; // Success
    } catch {
      // Rate limited — wait and retry
      if (attempt < retries - 1) {
        await page.waitForTimeout(5000);
      }
    }
  }

  // Final attempt — let it throw
  await expect(page).not.toHaveURL(/login/);
}

export async function logout(page: Page) {
  const avatarBtn = page.locator('button:has(span[data-slot="avatar-fallback"]), [data-slot="dropdown-menu-trigger"]').last();
  if (await avatarBtn.isVisible()) {
    await avatarBtn.click();
    const logoutItem = page.getByText('Đăng xuất');
    if (await logoutItem.isVisible({ timeout: 2000 })) {
      await logoutItem.click();
      await page.waitForURL(/login/, { timeout: 5000 });
    }
  }
}
