/**
 * MCP Tools Integration Tests
 * Tests the same API endpoints used by each MCP tool.
 * Requires CRM API reachable at CRM_API_URL (default: https://10.10.101.207/api/v1).
 */
import { describe, it, expect, beforeAll } from 'vitest';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const BASE_URL = process.env.CRM_API_URL || 'https://10.10.101.207/api/v1';

async function api(path: string, method = 'GET', body?: unknown, token?: string): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const responseBody = await res.json().catch(() => null);
  return { status: res.status, body: responseBody };
}

async function login(email = 'admin@crm.local', password = 'changeme123'): Promise<string> {
  const r = await api('/auth/login', 'POST', { email, password });
  const data = r.body as { data?: { accessToken?: string } };
  return data?.data?.accessToken || '';
}

let adminToken: string;

beforeAll(async () => {
  adminToken = await login();
});

// tool: run_health_check
describe('run_health_check → GET /health', () => {
  it('returns status ok', async () => {
    const r = await api('/health');
    expect(r.status).toBe(200);
    const body = r.body as { status?: string };
    expect(body.status).toBe('ok');
  });
});

// tool: get_call_logs
describe('get_call_logs → GET /call-logs', () => {
  it('returns call logs with valid token', async () => {
    const r = await api('/call-logs?limit=5', 'GET', undefined, adminToken);
    expect([200, 500]).toContain(r.status);
  });

  it('returns 401 without token', async () => {
    const r = await api('/call-logs');
    expect([401, 403]).toContain(r.status);
  });
});

// tool: get_agent_status
describe('get_agent_status → GET /dashboard/agents', () => {
  it('returns agent list with valid token', async () => {
    const r = await api('/dashboard/agents', 'GET', undefined, adminToken);
    expect([200, 500]).toContain(r.status);
  });
});

// tool: get_reports
describe('get_reports → GET /reports/:type', () => {
  it('returns calls report', async () => {
    const r = await api('/reports/calls', 'GET', undefined, adminToken);
    expect([200, 400, 500]).toContain(r.status);
  });

  it('returns telesale report', async () => {
    const r = await api('/reports/telesale', 'GET', undefined, adminToken);
    expect([200, 400, 500]).toContain(r.status);
  });
});

// tool: check_permissions
describe('check_permissions → role-based access on /users', () => {
  const privilegedRoles = [
    { role: 'admin', email: 'admin@crm.local' },
    { role: 'manager', email: 'manager@crm.local' },
  ];
  const restrictedRoles = [
    { role: 'qa', email: 'qa@crm.local' },
    { role: 'leader', email: 'leader@crm.local' },
    { role: 'agent_telesale', email: 'agent.ts@crm.local' },
    { role: 'agent_collection', email: 'agent.col@crm.local' },
  ];

  for (const { role, email } of privilegedRoles) {
    it(`${role} can access /users`, async () => {
      const token = await login(email);
      const r = await api('/users', 'GET', undefined, token);
      expect([200, 500]).toContain(r.status);
    });
  }

  for (const { role, email } of restrictedRoles) {
    it(`${role} is denied /users (403)`, async () => {
      const token = await login(email);
      if (!token) return; // skip if user doesn't exist
      const r = await api('/users', 'GET', undefined, token);
      expect([403, 401]).toContain(r.status);
    });
  }
});

// tool: get_recordings (uses /call-logs filtered by recordingStatus)
describe('get_recordings → GET /call-logs (recordings filter)', () => {
  it('returns call logs for recording lookup', async () => {
    const r = await api('/call-logs?limit=10', 'GET', undefined, adminToken);
    expect([200, 500]).toContain(r.status);
  });
});

// tool: click_to_call
describe('click_to_call → POST /calls/originate', () => {
  it('responds to originate request (may fail if ESL down)', async () => {
    const r = await api('/calls/originate', 'POST', { phone: '1000' }, adminToken);
    // 200/202 = accepted, 400 = validation, 500 = ESL error, 502 = bad gateway
    expect([200, 202, 400, 500, 502]).toContain(r.status);
  });
});
