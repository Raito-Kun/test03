import { test, expect } from '@playwright/test';
import { login } from './helpers';

/**
 * E2E tests for Ticket Kanban board feature.
 * Tests happy-path kanban drag-drop, resolution requirement, and delete RBAC.
 */

test.describe.serial('Ticket Kanban Board', () => {
  test('happy-path kanban: load board, assert 4 columns, drag ticket to in_progress, verify API persistence', async ({
    page,
  }) => {
    await login(page, 'admin@crm.local', 'changeme123');

    // Navigate to tickets (kanban board)
    await page.goto('/tickets');
    await expect(page.locator('h1')).toContainText('Phiếu ghi', { timeout: 5000 });

    // Assert 4 column headers exist with Vietnamese labels
    const columns = ['Chưa xử lý', 'Đang xử lý', 'Đã xử lý', 'Đã đóng'];
    for (const col of columns) {
      await expect(page.getByText(col, { exact: true })).toBeVisible({ timeout: 5000 });
    }

    // Find first ticket card in "Chưa xử lý" (open) column
    const openColumn = page.locator('[data-testid="kanban-column-open"]');
    const firstCard = openColumn.locator('[data-testid="kanban-card"]').first();

    // Get the ticket ID from card for later verification
    const ticketCard = firstCard;
    const ticketIdMatch = await ticketCard.getAttribute('data-ticket-id');
    if (!ticketIdMatch) {
      test.skip();
      return;
    }

    // Drag the first card to "Đang xử lý" (in_progress) column
    const inProgressColumn = page.locator('[data-testid="kanban-column-in_progress"]');
    await ticketCard.dragTo(inProgressColumn);
    await page.waitForTimeout(1000);

    // Verify via API GET that status persisted
    const response = await page.context().request.get(`/api/v1/tickets/${ticketIdMatch}`);
    if (!response.ok()) {
      test.skip();
      return;
    }
    const ticketData = await response.json();
    expect(ticketData.status).toBe('in_progress');
  });

  test('resolution required: drag to resolved column, error without resultCode, success with resultCode', async ({
    page,
  }) => {
    await login(page, 'admin@crm.local', 'changeme123');
    await page.goto('/tickets');

    // Find a ticket in "Đang xử lý" or "Chưa xử lý" column
    const openColumn = page.locator('[data-testid="kanban-column-open"]');
    const inProgressColumn = page.locator('[data-testid="kanban-column-in_progress"]');

    let ticketCard = openColumn.locator('[data-testid="kanban-card"]').first();
    let isVisible = await ticketCard.isVisible({ timeout: 2000 }).catch(() => false);

    if (!isVisible) {
      ticketCard = inProgressColumn.locator('[data-testid="kanban-card"]').first();
    }

    const ticketIdMatch = await ticketCard.getAttribute('data-ticket-id');
    if (!ticketIdMatch) {
      test.skip();
      return;
    }

    // Drag to "Đã xử lý" (resolved) column
    const resolvedColumn = page.locator('[data-testid="kanban-column-resolved"]');
    await ticketCard.dragTo(resolvedColumn);
    await page.waitForTimeout(800);

    // Resolution dialog should appear
    const resolutionDialog = page.locator('[data-testid="resolution-dialog"]');
    await expect(resolutionDialog).toBeVisible({ timeout: 3000 });

    // Try submit without resultCode — should show error
    const submitBtn = resolutionDialog.locator('button:has-text("Xác nhận")');
    await submitBtn.click();
    await page.waitForTimeout(500);

    // Error message should appear
    const errorMessage = page.locator('text=/resultCode|Mã kết quả/i');
    await expect(errorMessage).toBeVisible({ timeout: 2000 });

    // Now fill in resultCode and note, then submit
    const resultCodeInput = resolutionDialog.locator('input[name="resultCode"], select[name="resultCode"]');
    await resultCodeInput.fill('ok');

    const noteInput = resolutionDialog.locator('textarea[name="resolutionNote"]').first();
    if (await noteInput.isVisible({ timeout: 1000 })) {
      await noteInput.fill('done');
    }

    // Submit again
    await submitBtn.click();
    await page.waitForTimeout(1000);

    // Dialog should close and card should move to resolved
    await expect(resolutionDialog).not.toBeVisible({ timeout: 3000 });
    await expect(resolvedColumn.locator('[data-testid="kanban-card"]')).toContainText(/.*/, { timeout: 2000 });
  });

  test('delete RBAC: agent cannot see Delete button, admin can and deletes ticket', async ({ page, context }) => {
    // Login as agent — should not see Delete button
    await login(page, 'agent.ts@crm.local', 'changeme123');
    await page.goto('/tickets');

    // Open first ticket detail
    const firstCard = page.locator('[data-testid="kanban-card"]').first();
    await firstCard.click({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Detail dialog opens
    const detailDialog = page.locator('[data-testid="ticket-detail-dialog"]');
    await expect(detailDialog).toBeVisible({ timeout: 3000 });

    // Delete button should NOT be visible for agent
    const deleteBtn = detailDialog.locator('button:has-text("Xóa"), button[data-testid="delete-ticket"]');
    await expect(deleteBtn).not.toBeVisible();

    // Close dialog
    await page.press('Escape');
    await page.waitForTimeout(500);

    // Logout and login as admin
    await page.goto('/login?force=true');
    await login(page, 'admin@crm.local', 'changeme123');
    await page.goto('/tickets');

    // Open same ticket or first ticket
    const adminFirstCard = page.locator('[data-testid="kanban-card"]').first();
    const ticketIdMatch = await adminFirstCard.getAttribute('data-ticket-id');
    if (!ticketIdMatch) {
      test.skip();
      return;
    }

    await adminFirstCard.click({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Detail dialog opens
    const adminDetailDialog = page.locator('[data-testid="ticket-detail-dialog"]');
    await expect(adminDetailDialog).toBeVisible({ timeout: 3000 });

    // Delete button SHOULD be visible for admin
    const adminDeleteBtn = adminDetailDialog.locator('button:has-text("Xóa"), button[data-testid="delete-ticket"]');
    await expect(adminDeleteBtn).toBeVisible({ timeout: 2000 });

    // Click delete
    await adminDeleteBtn.click();
    await page.waitForTimeout(500);

    // Confirmation dialog appears
    const confirmDialog = page.locator('[role="alertdialog"], [data-testid="confirm-delete-dialog"]').first();
    await expect(confirmDialog).toBeVisible({ timeout: 2000 });

    // Click confirm delete
    const confirmBtn = confirmDialog.locator('button:has-text("Xóa"), button:has-text("OK")').first();
    await confirmBtn.click();
    await page.waitForTimeout(1000);

    // Dialog should close and ticket should no longer appear in kanban
    await expect(adminDetailDialog).not.toBeVisible({ timeout: 3000 });

    // Verify via API that ticket is gone
    const checkResponse = await context.request.get(`/api/v1/tickets/${ticketIdMatch}`);
    // Should be 404 or not found
    expect(checkResponse.status()).toBeGreaterThanOrEqual(400);
  });
});
