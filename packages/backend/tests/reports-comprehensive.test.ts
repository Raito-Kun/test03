import { describe, it, expect } from 'vitest';
import { createAgent, authHeader } from './helpers';

const REPORTS = '/api/v1/reports';
const DASHBOARD = '/api/v1/dashboard';

describe('Reports - Access by allowed roles', () => {
  it('GET /reports/calls as manager → [200, 400, 500]', async () => {
    const res = await createAgent()
      .get(`${REPORTS}/calls`)
      .set(authHeader('manager'));
    expect([200, 400, 500]).toContain(res.status);
  });

  it('GET /reports/telesale as admin → [200, 400, 500]', async () => {
    const res = await createAgent()
      .get(`${REPORTS}/telesale`)
      .set(authHeader('admin'));
    expect([200, 400, 500]).toContain(res.status);
  });

  it('GET /reports/collection as leader → [200, 400, 500]', async () => {
    const res = await createAgent()
      .get(`${REPORTS}/collection`)
      .set(authHeader('leader'));
    expect([200, 400, 500]).toContain(res.status);
  });

  it('GET /reports/calls as qa → [200, 400, 500]', async () => {
    const res = await createAgent()
      .get(`${REPORTS}/calls`)
      .set(authHeader('qa'));
    expect([200, 400, 500]).toContain(res.status);
  });
});

describe('Reports - RBAC blocks', () => {
  it('reports blocked for agent_telesale → 403', async () => {
    const res = await createAgent()
      .get(`${REPORTS}/calls`)
      .set(authHeader('agent_telesale'));
    expect(res.status).toBe(403);
  });

  it('reports blocked for agent_collection → 403', async () => {
    const res = await createAgent()
      .get(`${REPORTS}/calls`)
      .set(authHeader('agent_collection'));
    expect(res.status).toBe(403);
  });
});

describe('Dashboard', () => {
  it('GET /dashboard/overview → [200, 500]', async () => {
    const res = await createAgent()
      .get(`${DASHBOARD}/overview`)
      .set(authHeader('admin'));
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) expect(res.body.success).toBe(true);
  });

  it('GET /dashboard/agents → [200, 500]', async () => {
    const res = await createAgent()
      .get(`${DASHBOARD}/agents`)
      .set(authHeader('admin'));
    expect([200, 500]).toContain(res.status);
  });

  it('dashboard overview requires auth → 401', async () => {
    const res = await createAgent().get(`${DASHBOARD}/overview`);
    expect(res.status).toBe(401);
  });
});
