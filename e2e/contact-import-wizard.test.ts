import { test, expect, request } from '@playwright/test';
import * as XLSX from 'xlsx';

/**
 * 3-step contact import wizard — API-level e2e against the live server.
 * (UI smoke is separate; this file proves the endpoints + workflow work.)
 */
test.use({ storageState: undefined });

const BASE = process.env.E2E_BASE_URL || 'https://10.10.101.207';

function xlsxBuffer(rows: Record<string, string>[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Danh bạ');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

async function login(ctx: ReturnType<typeof request.newContext> extends Promise<infer T> ? T : never,
  email: string, password: string) {
  const r = await ctx.post('/api/v1/auth/login', { data: { email, password } });
  expect(r.status(), `login ${email}`).toBe(200);
  const body = await r.json();
  return body.data.accessToken as string;
}

// Unique prefix per run so repeated runs don't collide in the DB.
const RUN_ID = Date.now().toString().slice(-7);

test.describe.serial('Contact import 3-step wizard', () => {
  test('happy path: upload → dedup → assign → commit', async () => {
    const ctx = await request.newContext({ baseURL: BASE, ignoreHTTPSErrors: true });
    const token = await login(ctx, 'admin@crm.local', 'changeme123');
    const auth = { Authorization: `Bearer ${token}` };

    // Build a 5-row XLSX — 3 uniques + 2 that we'll mark as duplicates by
    // first committing them then re-uploading.
    const rows = Array.from({ length: 5 }).map((_, i) => ({
      'Họ tên': `Test User ${RUN_ID}-${i}`,
      'Số điện thoại': `097${RUN_ID}${i}`,
      'Email': `t${RUN_ID}${i}@example.com`,
      'Nguồn': 'wizard-e2e',
    }));
    const buf = xlsxBuffer(rows);

    // Step 1 — preview
    const prev = await ctx.post('/api/v1/contacts/import/preview', {
      headers: auth,
      multipart: { file: { name: 'data.xlsx', mimeType: 'application/vnd.ms-excel', buffer: buf } },
    });
    expect(prev.status()).toBe(200);
    const previewBody = await prev.json();
    expect(previewBody.data.validCount).toBe(5);
    expect(previewBody.data.rows).toHaveLength(5);

    // Step 2 — dedup (first run: everyone should be unique)
    const dedup1 = await ctx.post('/api/v1/contacts/import/check-dedup', {
      headers: auth, data: { rows: previewBody.data.rows },
    });
    expect(dedup1.status()).toBe(200);
    const dedup1Body = await dedup1.json();
    expect(dedup1Body.data.uniques.length + dedup1Body.data.duplicates.length).toBe(5);
    const firstRunUniques = dedup1Body.data.uniques as Array<{ rowNumber: number }>;
    const firstRunDups = dedup1Body.data.duplicates as Array<{ rowNumber: number; new: unknown; existing: { id: string } }>;

    // Step 3 — commit — create all uniques; for any "duplicate" (shouldn't exist yet), merge
    const commit1Rows = [
      ...firstRunUniques.map((r) => ({ row: r, action: 'create', assignToUserId: null })),
      ...firstRunDups.map((d) => ({ row: d.new, action: 'merge', existingId: d.existing.id, assignToUserId: null })),
    ];
    const commit1 = await ctx.post('/api/v1/contacts/import/commit', {
      headers: auth, data: { rows: commit1Rows },
    });
    expect(commit1.status()).toBe(200);
    const commit1Body = await commit1.json();
    expect(commit1Body.data.created + commit1Body.data.updated).toBe(5);

    // Re-upload the same file — now all 5 should be duplicates.
    const dedup2 = await ctx.post('/api/v1/contacts/import/check-dedup', {
      headers: auth, data: { rows: previewBody.data.rows },
    });
    const dedup2Body = await dedup2.json();
    expect(dedup2Body.data.duplicates.length).toBe(5);
    expect(dedup2Body.data.uniques.length).toBe(0);

    // Commit with "skip" on 2 + "overwrite" on 3
    const dups = dedup2Body.data.duplicates as Array<{ rowNumber: number; new: Record<string, unknown>; existing: { id: string } }>;
    const rebuiltRows = dups.map((d, i) => ({
      row: d.new,
      action: i < 2 ? 'skip' : 'overwrite',
      existingId: d.existing.id,
      assignToUserId: null,
    }));
    const commit2 = await ctx.post('/api/v1/contacts/import/commit', {
      headers: auth, data: { rows: rebuiltRows },
    });
    const commit2Body = await commit2.json();
    expect(commit2Body.data.skipped).toBe(2);
    expect(commit2Body.data.updated).toBe(3);

    await ctx.dispose();
  });

  test('role guard: agent cannot hit wizard endpoints', async () => {
    const ctx = await request.newContext({ baseURL: BASE, ignoreHTTPSErrors: true });
    const token = await login(ctx, 'agent.ts@crm.local', 'changeme123');
    const auth = { Authorization: `Bearer ${token}` };

    const buf = xlsxBuffer([{ 'Họ tên': 'x', 'Số điện thoại': '0999999999' }]);
    const prev = await ctx.post('/api/v1/contacts/import/preview', {
      headers: auth,
      multipart: { file: { name: 'x.xlsx', mimeType: 'application/vnd.ms-excel', buffer: buf } },
    });
    expect(prev.status(), 'agent should be forbidden from preview').toBe(403);

    const dedup = await ctx.post('/api/v1/contacts/import/check-dedup', { headers: auth, data: { rows: [] } });
    expect(dedup.status()).toBe(403);

    const commit = await ctx.post('/api/v1/contacts/import/commit', { headers: auth, data: { rows: [] } });
    expect(commit.status()).toBe(403);

    await ctx.dispose();
  });

  test('online-only filter is honored by /data-allocation/agents', async () => {
    const ctx = await request.newContext({ baseURL: BASE, ignoreHTTPSErrors: true });
    const token = await login(ctx, 'admin@crm.local', 'changeme123');
    const auth = { Authorization: `Bearer ${token}` };

    const all = await ctx.get('/api/v1/data-allocation/agents', { headers: auth });
    expect(all.status()).toBe(200);
    const allBody = await all.json();

    const online = await ctx.get('/api/v1/data-allocation/agents?onlineOnly=true', { headers: auth });
    expect(online.status()).toBe(200);
    const onlineBody = await online.json();

    // Online list must be a subset of the full list (count-wise).
    expect(onlineBody.data.length).toBeLessThanOrEqual(allBody.data.length);
    // Every returned online agent carries the agentStatus field.
    for (const a of onlineBody.data) {
      expect(a.agentStatus).toBe('ready');
    }

    await ctx.dispose();
  });
});
