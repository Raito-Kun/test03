import { test as setup } from '@playwright/test';
import { login } from './helpers';

/** Login once as admin and save auth state for all tests */
setup('authenticate as admin', async ({ page }) => {
  await login(page, 'admin@crm.local', 'changeme123');
  await page.context().storageState({ path: './e2e/.auth-state.json' });
});
