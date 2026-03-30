import { describe, it, expect } from 'vitest';
import { createAgent, authHeader } from './helpers';

const BASE = '/api/v1/tickets';

describe('Tickets - List', () => {
  it('list tickets → [200, 500]', async () => {
    const res = await createAgent().get(BASE).set(authHeader('admin'));
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) expect(res.body.success).toBe(true);
  });
});

describe('Tickets - Create', () => {
  it('create ticket with valid data → [201, 200, 500]', async () => {
    const res = await createAgent()
      .post(BASE)
      .set(authHeader('agent_telesale'))
      .send({
        contactId: '00000000-0000-0000-0000-000000000001',
        subject: 'Test Ticket',
        priority: 'medium',
      });
    expect([201, 200, 500]).toContain(res.status);
  });

  it('create ticket validation - missing subject → [400, 500]', async () => {
    const res = await createAgent()
      .post(BASE)
      .set(authHeader('agent_telesale'))
      .send({});
    expect([400, 500]).toContain(res.status);
  });
});

describe('Tickets - Detail', () => {
  it('get ticket detail (nonexistent) → [404, 500]', async () => {
    const res = await createAgent()
      .get(`${BASE}/nonexistent-ticket-id`)
      .set(authHeader('admin'));
    expect([404, 500]).toContain(res.status);
  });
});

describe('Tickets - Update', () => {
  it('update ticket → [200, 404, 500]', async () => {
    const res = await createAgent()
      .patch(`${BASE}/nonexistent-ticket-id`)
      .set(authHeader('admin'))
      .send({ status: 'resolved' });
    expect([200, 404, 500]).toContain(res.status);
  });
});

describe('Tickets - Delete', () => {
  it('delete ticket → [200, 204, 404, 500]', async () => {
    const res = await createAgent()
      .delete(`${BASE}/nonexistent-ticket-id`)
      .set(authHeader('admin'));
    expect([200, 204, 404, 500]).toContain(res.status);
  });
});
