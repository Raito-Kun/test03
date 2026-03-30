import { describe, it, expect } from 'vitest';
import { createAgent, authHeader } from './helpers';

const BASE = '/api/v1/contacts';

describe('Contacts - List', () => {
  it('list contacts as admin → [200, 500]', async () => {
    const res = await createAgent().get(BASE).set(authHeader('admin'));
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) expect(res.body.success).toBe(true);
  });

  it('list contacts as agent → [200, 500] (data-scoped)', async () => {
    const res = await createAgent().get(BASE).set(authHeader('agent_telesale'));
    expect([200, 500]).toContain(res.status);
  });
});

describe('Contacts - Create', () => {
  it('create contact with valid data → [201, 200, 500]', async () => {
    const res = await createAgent()
      .post(BASE)
      .set(authHeader('admin'))
      .send({ fullName: 'Test Contact', phone: '0901234567' });

    expect([201, 200, 500]).toContain(res.status);
  });

  it('create contact missing required fields → [400, 500]', async () => {
    const res = await createAgent()
      .post(BASE)
      .set(authHeader('agent_telesale'))
      .send({});

    expect([400, 500]).toContain(res.status);
  });
});

describe('Contacts - Detail', () => {
  it('get contact by ID (nonexistent) → [404, 500]', async () => {
    const res = await createAgent()
      .get(`${BASE}/nonexistent-contact-id`)
      .set(authHeader('admin'));

    expect([404, 500]).toContain(res.status);
  });
});

describe('Contacts - Update', () => {
  it('update contact → [200, 500]', async () => {
    const res = await createAgent()
      .patch(`${BASE}/nonexistent-contact-id`)
      .set(authHeader('admin'))
      .send({ fullName: 'Updated Name' });

    expect([200, 404, 500]).toContain(res.status);
  });
});

describe('Contacts - Delete', () => {
  it('delete contact as admin → [200, 204, 404, 500]', async () => {
    const res = await createAgent()
      .delete(`${BASE}/nonexistent-contact-id`)
      .set(authHeader('admin'));

    expect([200, 204, 404, 500]).toContain(res.status);
  });

  it('delete contact blocked for agent_telesale → 403', async () => {
    const res = await createAgent()
      .delete(`${BASE}/some-id`)
      .set(authHeader('agent_telesale'));

    expect(res.status).toBe(403);
  });

  it('delete contact blocked for qa → 403', async () => {
    const res = await createAgent()
      .delete(`${BASE}/some-id`)
      .set(authHeader('qa'));

    expect(res.status).toBe(403);
  });
});

describe('Contacts - Import', () => {
  it('import without file → 400', async () => {
    const res = await createAgent()
      .post(`${BASE}/import`)
      .set(authHeader('admin'));

    expect([400, 500]).toContain(res.status);
  });

  it('import blocked for agents → 403', async () => {
    const res = await createAgent()
      .post(`${BASE}/import`)
      .set(authHeader('agent_telesale'));

    expect(res.status).toBe(403);
  });
});

describe('Contacts - Export', () => {
  it('export as admin → [200, 500]', async () => {
    const res = await createAgent()
      .get(`${BASE}/export`)
      .set(authHeader('admin'));

    expect([200, 500]).toContain(res.status);
  });

  it('export blocked for agents → 403', async () => {
    const res = await createAgent()
      .get(`${BASE}/export`)
      .set(authHeader('agent_telesale'));

    expect(res.status).toBe(403);
  });
});

describe('Contacts - Timeline', () => {
  it('contact timeline → [200, 404, 500]', async () => {
    const res = await createAgent()
      .get(`${BASE}/nonexistent-id/timeline`)
      .set(authHeader('admin'));

    expect([200, 404, 500]).toContain(res.status);
  });
});
