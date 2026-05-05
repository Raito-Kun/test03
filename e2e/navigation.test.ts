import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe.serial('Navigation — all pages load', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin@crm.local', 'changeme123');
  });

  const pages = [
    { path: '/', title: 'Tổng quan' },
    { path: '/contacts', title: 'Danh sách khách hàng' },
    { path: '/leads', title: 'Nhóm khách hàng' },
    { path: '/debt-cases', title: 'Công nợ' },
    { path: '/call-logs', title: 'Lịch sử cuộc gọi' },
    { path: '/campaigns', title: 'Chiến dịch' },
    { path: '/tickets', title: 'Phiếu ghi' },
    { path: '/reports', title: 'Báo cáo' },
    { path: '/settings', title: 'Cài đặt' },
  ];

  for (const { path, title } of pages) {
    test(`page ${path} loads with title "${title}"`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('h1').first()).toContainText(title, { timeout: 5000 });
    });
  }
});
