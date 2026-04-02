import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe.serial('Reports (Báo cáo) — full coverage', () => {
  test('super admin can access /reports page', async ({ page }) => {
    await login(page, 'superadmin@crm.local', 'SuperAdmin@123');
    await page.goto('/reports');

    await expect(page.getByRole('heading', { name: 'Báo cáo' })).toBeVisible({ timeout: 10000 });

    // 3 top-level tabs
    await expect(page.getByRole('tab', { name: 'Tóm tắt' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Chi tiết' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Biểu đồ' })).toBeVisible();

    // Filter fields
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
    await expect(page.locator('input[type="date"]').nth(1)).toBeVisible();
    // Nhân viên + Team dropdowns
    await expect(page.getByText('Nhân viên')).toBeVisible();
    await expect(page.getByText('Team').first()).toBeVisible();
    // Tìm kiếm button
    await expect(page.getByRole('button', { name: /Tìm kiếm/ })).toBeVisible();

    // Pre-search empty state
    await expect(page.getByText('Nhấn Tìm kiếm để xem báo cáo')).toBeVisible();
  });

  test('Tab 1 Summary — search and data display', async ({ page }) => {
    await login(page, 'superadmin@crm.local', 'SuperAdmin@123');
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Báo cáo' })).toBeVisible({ timeout: 10000 });

    // Set date from to 2026-03-01
    const dateFrom = page.locator('input[type="date"]').first();
    await dateFrom.fill('2026-03-01');

    // Click Tìm kiếm
    await page.getByRole('button', { name: /Tìm kiếm/ }).click();

    // Wait for table to appear (skeleton disappears, table renders)
    await expect(page.locator('table').first()).toBeVisible({ timeout: 15000 });

    // Theo nhân viên sub-tab should be selected by default
    await expect(page.getByRole('tab', { name: 'Theo nhân viên' })).toBeVisible();

    // Agent table headers
    await expect(page.getByRole('columnheader', { name: 'Nhân viên' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Team' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Tổng' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Đã nghe' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Nhỡ' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Hủy' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'TL TB' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Nói TB' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Tỷ lệ nghe' })).toBeVisible();

    // At least one data row (tbody tr)
    const agentRows = page.locator('table tbody tr');
    await expect(agentRows.first()).toBeVisible({ timeout: 10000 });

    // Switch to Theo team sub-tab
    await page.getByRole('tab', { name: 'Theo team' }).click();
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole('columnheader', { name: 'Team' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Số agent' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Tổng' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Đã nghe' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Nhỡ' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Tỷ lệ nghe' })).toBeVisible();

    const teamRows = page.locator('table tbody tr');
    await expect(teamRows.first()).toBeVisible({ timeout: 10000 });

    // Xuất báo cáo button
    await expect(page.getByRole('button', { name: /Xuất báo cáo/i })).toBeVisible();
  });

  test('Tab 2 Detail — data with pagination info', async ({ page }) => {
    await login(page, 'superadmin@crm.local', 'SuperAdmin@123');
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Báo cáo' })).toBeVisible({ timeout: 10000 });

    // Set date range and switch to Chi tiết tab
    await page.locator('input[type="date"]').first().fill('2026-03-01');
    await page.getByRole('tab', { name: 'Chi tiết' }).click();

    // Extra filters visible (Kết quả dropdown, SIP Code input)
    await expect(page.getByText('Kết quả')).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder(/VD: 200/i)).toBeVisible();

    // Click Tìm kiếm
    await page.getByRole('button', { name: /Tìm kiếm/ }).click();

    // Wait for table
    await expect(page.locator('table').first()).toBeVisible({ timeout: 15000 });

    // Detail table headers
    await expect(page.getByRole('columnheader', { name: 'Thời gian', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Nhân viên' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Số gọi' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Số nhận' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Thời lượng', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Thời gian nói' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Kết quả' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'SIP Code' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Ghi âm' })).toBeVisible();

    // Pagination text "Trang 1"
    await expect(page.getByText(/Trang 1/)).toBeVisible({ timeout: 10000 });

    // Xuất báo cáo
    await expect(page.getByRole('button', { name: /Xuất báo cáo/i })).toBeVisible();
  });

  test('Tab 3 Charts — charts render', async ({ page }) => {
    await login(page, 'superadmin@crm.local', 'SuperAdmin@123');
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Báo cáo' })).toBeVisible({ timeout: 10000 });

    await page.locator('input[type="date"]').first().fill('2026-03-01');
    await page.getByRole('tab', { name: 'Biểu đồ' }).click();

    await page.getByRole('button', { name: /Tìm kiếm/ }).click();

    // Wait for chart cards to appear (recharts renders into SVG inside cards)
    await expect(page.locator('.recharts-wrapper, svg.recharts-surface').first())
      .toBeVisible({ timeout: 15000 });

    // 4 chart card titles
    await expect(page.getByText('Tổng cuộc gọi theo ngày')).toBeVisible();
    await expect(page.getByText('So sánh nhân viên')).toBeVisible();
    await expect(page.getByText('Xu hướng cuộc gọi theo tuần')).toBeVisible();
    await expect(page.getByText('Tỷ lệ kết quả cuộc gọi')).toBeVisible();
  });

  test('Export button works on summary tab', async ({ page }) => {
    await login(page, 'superadmin@crm.local', 'SuperAdmin@123');
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Báo cáo' })).toBeVisible({ timeout: 10000 });

    await page.locator('input[type="date"]').first().fill('2026-03-01');
    await page.getByRole('button', { name: /Tìm kiếm/ }).click();

    // Wait for summary table then check export button
    await expect(page.locator('table').first()).toBeVisible({ timeout: 15000 });

    const exportBtn = page.getByRole('button', { name: /Xuất báo cáo/i });
    await expect(exportBtn).toBeVisible();
    await expect(exportBtn).toBeEnabled();

    // Listen for download event triggered by the export button
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }),
      exportBtn.click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/bao-cao/i);
  });
});
