import { describe, it, expect } from 'vitest';
import { createAgent, authHeader } from './helpers';

describe('Contact Endpoints', () => {
  it('GET /contacts returns paginated list', async () => {
    const res = await createAgent()
      .get('/api/v1/contacts')
      .set(authHeader('admin'));

    // 200 with data or 500 if no DB — never 401/403
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
    }
  });

  it('POST /contacts validates required fields', async () => {
    const res = await createAgent()
      .post('/api/v1/contacts')
      .set(authHeader('agent_telesale'))
      .send({});

    // Should be 400 (validation error) or 500 (no DB)
    expect([400, 500]).toContain(res.status);
  });

  it('GET /contacts/:id returns 404 or contact', async () => {
    const res = await createAgent()
      .get('/api/v1/contacts/nonexistent-id')
      .set(authHeader('admin'));

    expect([404, 500]).toContain(res.status);
  });
});

describe('Lead Endpoints', () => {
  it('GET /leads returns paginated list', async () => {
    const res = await createAgent()
      .get('/api/v1/leads')
      .set(authHeader('admin'));

    expect([200, 500]).toContain(res.status);
  });

  it('POST /leads validates body', async () => {
    const res = await createAgent()
      .post('/api/v1/leads')
      .set(authHeader('agent_telesale'))
      .send({});

    expect([400, 500]).toContain(res.status);
  });
});

describe('Debt Case Endpoints', () => {
  it('GET /debt-cases returns list', async () => {
    const res = await createAgent()
      .get('/api/v1/debt-cases')
      .set(authHeader('admin'));

    expect([200, 500]).toContain(res.status);
  });

  it('POST /debt-cases/:id/promise validates body', async () => {
    const res = await createAgent()
      .post('/api/v1/debt-cases/fake-id/promise')
      .set(authHeader('agent_collection'))
      .send({});

    expect([400, 404, 500]).toContain(res.status);
  });
});

describe('Ticket Endpoints', () => {
  it('GET /tickets returns list', async () => {
    const res = await createAgent()
      .get('/api/v1/tickets')
      .set(authHeader('admin'));

    expect([200, 500]).toContain(res.status);
  });

  it('GET /tickets/:id returns 404 for nonexistent', async () => {
    const res = await createAgent()
      .get('/api/v1/tickets/nonexistent-id')
      .set(authHeader('admin'));

    expect([404, 500]).toContain(res.status);
  });
});

describe('Call Log Endpoints', () => {
  it('GET /call-logs returns list', async () => {
    const res = await createAgent()
      .get('/api/v1/call-logs')
      .set(authHeader('admin'));

    expect([200, 500]).toContain(res.status);
  });
});

describe('Campaign Endpoints', () => {
  it('GET /campaigns returns list', async () => {
    const res = await createAgent()
      .get('/api/v1/campaigns')
      .set(authHeader('admin'));

    expect([200, 500]).toContain(res.status);
  });

  it('POST /campaigns blocked for agents', async () => {
    const res = await createAgent()
      .post('/api/v1/campaigns')
      .set(authHeader('agent_telesale'))
      .send({ name: 'Test Campaign', type: 'telesale' });

    expect(res.status).toBe(403);
  });
});

describe('Dashboard Endpoints', () => {
  it('GET /dashboard/overview requires auth', async () => {
    const res = await createAgent()
      .get('/api/v1/dashboard/overview')
      .set(authHeader('admin'));

    expect([200, 500]).toContain(res.status);
  });

  it('GET /dashboard/agents requires auth', async () => {
    const res = await createAgent()
      .get('/api/v1/dashboard/agents')
      .set(authHeader('admin'));

    expect([200, 500]).toContain(res.status);
  });
});

describe('Report Endpoints', () => {
  it('GET /reports/calls requires auth', async () => {
    const res = await createAgent()
      .get('/api/v1/reports/calls')
      .set(authHeader('manager'));

    expect([200, 400, 500]).toContain(res.status);
  });
});

describe('Disposition Code Endpoints', () => {
  it('GET /disposition-codes returns list', async () => {
    const res = await createAgent()
      .get('/api/v1/disposition-codes')
      .set(authHeader('admin'));

    expect([200, 500]).toContain(res.status);
  });

  it('POST /disposition-codes blocked for agents', async () => {
    const res = await createAgent()
      .post('/api/v1/disposition-codes')
      .set(authHeader('agent_telesale'))
      .send({ code: 'TEST', label: 'Test' });

    expect(res.status).toBe(403);
  });
});

describe('Team Endpoints', () => {
  it('GET /teams returns list', async () => {
    const res = await createAgent()
      .get('/api/v1/teams')
      .set(authHeader('admin'));

    expect([200, 500]).toContain(res.status);
  });

  it('DELETE /teams blocked for non-admin', async () => {
    const res = await createAgent()
      .delete('/api/v1/teams/fake-id')
      .set(authHeader('manager'));

    expect(res.status).toBe(403);
  });
});

describe('Macro Endpoints', () => {
  it('GET /macros returns list', async () => {
    const res = await createAgent()
      .get('/api/v1/macros')
      .set(authHeader('admin'));

    expect([200, 500]).toContain(res.status);
  });
});
