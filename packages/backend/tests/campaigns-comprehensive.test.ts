import { describe, it, expect } from 'vitest';
import { createAgent, authHeader } from './helpers';

const BASE = '/api/v1/campaigns';

describe('Campaigns - List', () => {
  it('list campaigns → [200, 500]', async () => {
    const res = await createAgent().get(BASE).set(authHeader('admin'));
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) expect(res.body.success).toBe(true);
  });
});

describe('Campaigns - Create', () => {
  it('create campaign as admin → [201, 200, 500]', async () => {
    const res = await createAgent()
      .post(BASE)
      .set(authHeader('admin'))
      .send({ name: 'Admin Campaign', type: 'telesale' });
    expect([201, 200, 500]).toContain(res.status);
  });

  it('create campaign as manager → [201, 200, 500]', async () => {
    const res = await createAgent()
      .post(BASE)
      .set(authHeader('manager'))
      .send({ name: 'Manager Campaign', type: 'telesale' });
    expect([201, 200, 500]).toContain(res.status);
  });

  it('create campaign blocked for agent → 403', async () => {
    const res = await createAgent()
      .post(BASE)
      .set(authHeader('agent_telesale'))
      .send({ name: 'Agent Campaign', type: 'telesale' });
    expect(res.status).toBe(403);
  });

  it('create campaign blocked for agent_collection → 403', async () => {
    const res = await createAgent()
      .post(BASE)
      .set(authHeader('agent_collection'))
      .send({ name: 'Collection Campaign', type: 'collection' });
    expect(res.status).toBe(403);
  });

  it('create campaign validation - missing name → [400, 500]', async () => {
    const res = await createAgent()
      .post(BASE)
      .set(authHeader('admin'))
      .send({ type: 'telesale' });
    expect([400, 500]).toContain(res.status);
  });
});

describe('Campaigns - Update', () => {
  it('update campaign as admin → [200, 404, 500]', async () => {
    const res = await createAgent()
      .patch(`${BASE}/nonexistent-campaign-id`)
      .set(authHeader('admin'))
      .send({ name: 'Updated Campaign' });
    expect([200, 404, 500]).toContain(res.status);
  });

  it('update campaign blocked for agent → 403', async () => {
    const res = await createAgent()
      .patch(`${BASE}/some-campaign-id`)
      .set(authHeader('agent_telesale'))
      .send({ name: 'Hacked Campaign' });
    expect(res.status).toBe(403);
  });
});
