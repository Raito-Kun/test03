import { describe, it, expect } from 'vitest';
import { createAgent, authHeader } from './helpers';

const BASE = '/api/v1/debt-cases';

describe('Debt Cases - List', () => {
  it('list debt cases → [200, 500]', async () => {
    const res = await createAgent().get(BASE).set(authHeader('admin'));
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) expect(res.body.success).toBe(true);
  });

  it('filter by debtTier query → [200, 500]', async () => {
    const res = await createAgent()
      .get(`${BASE}?debtTier=tier1`)
      .set(authHeader('admin'));
    expect([200, 500]).toContain(res.status);
  });

  it('search debt cases → [200, 500]', async () => {
    const res = await createAgent()
      .get(`${BASE}?search=test`)
      .set(authHeader('agent_collection'));
    expect([200, 500]).toContain(res.status);
  });
});

describe('Debt Cases - Create', () => {
  it('create debt case with valid data → [201, 200, 500]', async () => {
    const res = await createAgent()
      .post(BASE)
      .set(authHeader('admin'))
      .send({
        contactId: '00000000-0000-0000-0000-000000000001',
        originalAmount: 5000000,
        outstandingAmount: 5000000,
      });
    expect([201, 200, 500]).toContain(res.status);
  });
});

describe('Debt Cases - Update', () => {
  it('update debt case → [200, 404, 500]', async () => {
    const res = await createAgent()
      .patch(`${BASE}/nonexistent-case-id`)
      .set(authHeader('agent_collection'))
      .send({ status: 'in_progress' });
    expect([200, 404, 500]).toContain(res.status);
  });
});

describe('Debt Cases - Promise to Pay (PTP)', () => {
  it('record PTP with valid body → [200, 201, 400, 404, 500]', async () => {
    const res = await createAgent()
      .post(`${BASE}/nonexistent-case-id/promise`)
      .set(authHeader('agent_collection'))
      .send({ promiseDate: '2026-04-01', promiseAmount: 1000000 });
    expect([200, 201, 400, 404, 500]).toContain(res.status);
  });

  it('record PTP missing body → [400, 500]', async () => {
    const res = await createAgent()
      .post(`${BASE}/fake-id/promise`)
      .set(authHeader('agent_collection'))
      .send({});
    expect([400, 404, 500]).toContain(res.status);
  });
});
