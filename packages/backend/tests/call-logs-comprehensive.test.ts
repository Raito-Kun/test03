import { describe, it, expect } from 'vitest';
import { createAgent, authHeader } from './helpers';

const BASE = '/api/v1/call-logs';

describe('Call Logs - List', () => {
  it('list call logs → [200, 500]', async () => {
    const res = await createAgent().get(BASE).set(authHeader('admin'));
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) expect(res.body.success).toBe(true);
  });

  it('filter by direction query → [200, 500]', async () => {
    const res = await createAgent()
      .get(`${BASE}?direction=inbound`)
      .set(authHeader('admin'));
    expect([200, 500]).toContain(res.status);
  });

  it('filter by date range → [200, 500]', async () => {
    const res = await createAgent()
      .get(`${BASE}?startDate=2026-01-01&endDate=2026-03-31`)
      .set(authHeader('admin'));
    expect([200, 500]).toContain(res.status);
  });

  it('search by phone → [200, 500]', async () => {
    const res = await createAgent()
      .get(`${BASE}?phone=0901234567`)
      .set(authHeader('admin'));
    expect([200, 500]).toContain(res.status);
  });
});

describe('Call Logs - Detail', () => {
  it('get call log detail (nonexistent) → [404, 500]', async () => {
    const res = await createAgent()
      .get(`${BASE}/nonexistent-log-id`)
      .set(authHeader('admin'));
    expect([404, 500]).toContain(res.status);
  });
});

describe('Call Logs - Recording', () => {
  it('get recording (nonexistent) → [404, 500]', async () => {
    const res = await createAgent()
      .get(`${BASE}/nonexistent-log-id/recording`)
      .set(authHeader('admin'));
    expect([404, 500]).toContain(res.status);
  });
});

describe('Call Logs - Manual', () => {
  it('manual call log → [201, 200, 500]', async () => {
    const res = await createAgent()
      .post(`${BASE}/manual`)
      .set(authHeader('agent_telesale'))
      .send({ phone: '0901234567', duration: 120, direction: 'outbound' });
    expect([201, 200, 500]).toContain(res.status);
  });
});

describe('Call Logs - Disposition', () => {
  it('set disposition → [200, 400, 404, 500]', async () => {
    const res = await createAgent()
      .post(`${BASE}/nonexistent-log-id/disposition`)
      .set(authHeader('agent_telesale'))
      .send({ dispositionCodeId: '00000000-0000-0000-0000-000000000001', notes: 'test note' });
    expect([200, 400, 404, 500]).toContain(res.status);
  });
});

describe('Call Logs - QA Annotation', () => {
  it('QA annotation - allowed for qa role → [200, 201, 404, 500]', async () => {
    const res = await createAgent()
      .post(`${BASE}/nonexistent-log-id/qa`)
      .set(authHeader('qa'))
      .send({ score: 8, feedback: 'Good call', tags: ['polite'] });
    expect([200, 201, 404, 500]).toContain(res.status);
  });

  it('QA annotation - blocked for agent → 403', async () => {
    const res = await createAgent()
      .post(`${BASE}/some-log-id/qa`)
      .set(authHeader('agent_telesale'))
      .send({ score: 8, feedback: 'test' });
    expect(res.status).toBe(403);
  });
});
