import { test, expect, request } from '@playwright/test';

/**
 * Regression — cross-tab refresh race must not log losing tabs out.
 *
 * Pre-fix: backend used GETDEL on the refresh token id; concurrent /refresh
 * calls forced N-1 callers to fail with REFRESH_TOKEN_INVALID, which the
 * frontend turned into a hard logout.
 *
 * Fix: server caches the freshly-issued pair under `refresh:replay:{id}` for
 * a short grace window so concurrent siblings replay the same pair.
 */
test.use({ storageState: undefined });

const BASE = process.env.E2E_BASE_URL || 'https://10.10.101.207';
const CONCURRENT = 5;

test.describe.serial('Auth — refresh token race', () => {
  test('concurrent /refresh with the same cookie all succeed', async () => {
    const ctx = await request.newContext({ baseURL: BASE, ignoreHTTPSErrors: true });

    // 1. Login to get a refresh-token cookie.
    const loginRes = await ctx.post('/api/v1/auth/login', {
      data: { email: 'admin@crm.local', password: 'changeme123' },
    });
    expect(loginRes.status(), 'login should succeed').toBe(200);

    const cookies = await ctx.storageState();
    const refreshCookie = cookies.cookies.find((c) => c.name === 'crm_refresh_token');
    expect(refreshCookie, 'refresh cookie should exist').toBeTruthy();

    // 2. Fire N concurrent /refresh calls reusing the same cookie context.
    const results = await Promise.all(
      Array.from({ length: CONCURRENT }).map(() =>
        ctx.post('/api/v1/auth/refresh').then(async (r) => ({
          status: r.status(),
          body: await r.json().catch(() => null),
        })),
      ),
    );

    // 3. All N must succeed (winner generates, losers replay from cache).
    const successes = results.filter((r) => r.status === 200 && r.body?.success === true);
    const failures = results.filter((r) => r.status !== 200);
    console.log(`refresh race: ${successes.length}/${CONCURRENT} OK, ${failures.length} fail`);
    if (failures.length) console.log('failures:', JSON.stringify(failures, null, 2));

    expect(successes.length).toBe(CONCURRENT);

    // 4. All replayed access tokens should be identical (single issuance).
    const accessTokens = new Set(successes.map((r) => r.body?.data?.accessToken));
    expect(accessTokens.size, 'siblings should receive the same access token').toBe(1);

    await ctx.dispose();
  });

  test('login rate limiter is keyed per-email, not per-IP', async () => {
    // 30 wrong-password attempts for one email — should rate-limit before 30.
    // Meanwhile a different email from the same IP must still be able to login.
    const ctx = await request.newContext({ baseURL: BASE, ignoreHTTPSErrors: true });

    const burnEmail = 'burn-target@crm.local'; // intentionally non-existent
    let bannedAt = -1;
    for (let i = 0; i < 35; i++) {
      const r = await ctx.post('/api/v1/auth/login', {
        data: { email: burnEmail, password: 'nope' },
      });
      if (r.status() === 429) { bannedAt = i; break; }
    }
    console.log('burn email rate-limited at attempt', bannedAt);
    expect(bannedAt, 'burn email should hit RATE_LIMITED').toBeGreaterThan(-1);

    // Different email from same IP — should still log in (per-email keying).
    const goodLogin = await ctx.post('/api/v1/auth/login', {
      data: { email: 'admin@crm.local', password: 'changeme123' },
    });
    expect(goodLogin.status(), 'unrelated email must NOT be rate-limited').toBe(200);

    await ctx.dispose();
  });
});
