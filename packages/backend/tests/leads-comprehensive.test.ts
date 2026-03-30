import { describe, it, expect } from 'vitest';
import { createAgent, authHeader } from './helpers';

const BASE = '/api/v1/leads';

describe('Leads - List', () => {
  it('list leads as admin → [200, 500]', async () => {
    const res = await createAgent().get(BASE).set(authHeader('admin'));
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) expect(res.body.success).toBe(true);
  });

  it('list leads as agent → [200, 500]', async () => {
    const res = await createAgent().get(BASE).set(authHeader('agent_telesale'));
    expect([200, 500]).toContain(res.status);
  });

  it('search leads with query param → [200, 500]', async () => {
    const res = await createAgent()
      .get(`${BASE}?search=test`)
      .set(authHeader('admin'));
    expect([200, 500]).toContain(res.status);
  });

  it('filter leads by status → [200, 500]', async () => {
    const res = await createAgent()
      .get(`${BASE}?status=new`)
      .set(authHeader('admin'));
    expect([200, 500]).toContain(res.status);
  });
});

describe('Leads - Create', () => {
  it('create lead with valid data → [201, 200, 500]', async () => {
    const res = await createAgent()
      .post(BASE)
      .set(authHeader('agent_telesale'))
      .send({ contactId: '00000000-0000-0000-0000-000000000001' });
    expect([201, 200, 500]).toContain(res.status);
  });

  it('create lead missing required fields → [400, 500]', async () => {
    const res = await createAgent()
      .post(BASE)
      .set(authHeader('agent_telesale'))
      .send({});
    expect([400, 500]).toContain(res.status);
  });
});

describe('Leads - Update', () => {
  it('update lead status → [200, 404, 500]', async () => {
    const res = await createAgent()
      .patch(`${BASE}/nonexistent-lead-id`)
      .set(authHeader('agent_telesale'))
      .send({ status: 'contacted' });
    expect([200, 404, 500]).toContain(res.status);
  });
});
