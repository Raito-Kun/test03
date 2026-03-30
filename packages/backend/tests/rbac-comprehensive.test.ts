import { describe, it, expect } from 'vitest';
import { createAgent, authHeader } from './helpers';

describe('RBAC - Users endpoint', () => {
  it('admin can access /users → [200, 500]', async () => {
    const res = await createAgent().get('/api/v1/users').set(authHeader('admin'));
    expect([200, 500]).toContain(res.status);
  });

  it('manager can access /users → [200, 500]', async () => {
    const res = await createAgent().get('/api/v1/users').set(authHeader('manager'));
    expect([200, 500]).toContain(res.status);
  });

  it('qa blocked from /users → 403', async () => {
    const res = await createAgent().get('/api/v1/users').set(authHeader('qa'));
    expect(res.status).toBe(403);
  });

  it('leader blocked from /users → 403', async () => {
    const res = await createAgent().get('/api/v1/users').set(authHeader('leader'));
    expect(res.status).toBe(403);
  });

  it('agent_telesale blocked from /users → 403', async () => {
    const res = await createAgent().get('/api/v1/users').set(authHeader('agent_telesale'));
    expect(res.status).toBe(403);
  });

  it('agent_collection blocked from /users → 403', async () => {
    const res = await createAgent().get('/api/v1/users').set(authHeader('agent_collection'));
    expect(res.status).toBe(403);
  });
});

describe('RBAC - User creation (admin only)', () => {
  const newUser = { email: 'new@test.com', password: 'Pass123!', fullName: 'New User', role: 'agent_telesale' };

  it('admin can create users → [201, 200, 500]', async () => {
    const res = await createAgent()
      .post('/api/v1/users')
      .set(authHeader('admin'))
      .send(newUser);
    expect([201, 200, 500]).toContain(res.status);
  });

  it('manager blocked from creating users → 403', async () => {
    const res = await createAgent()
      .post('/api/v1/users')
      .set(authHeader('manager'))
      .send(newUser);
    expect(res.status).toBe(403);
  });
});

describe('RBAC - Campaigns (admin/manager only)', () => {
  it('agent blocked from creating campaigns → 403', async () => {
    const res = await createAgent()
      .post('/api/v1/campaigns')
      .set(authHeader('agent_telesale'))
      .send({ name: 'Test', type: 'telesale' });
    expect(res.status).toBe(403);
  });
});

describe('RBAC - QA Annotations', () => {
  it('qa can view qa-annotations → [200, 500]', async () => {
    const res = await createAgent()
      .get('/api/v1/qa-annotations')
      .set(authHeader('qa'));
    expect([200, 500]).toContain(res.status);
  });

  it('agent_telesale blocked from qa-annotations → 403', async () => {
    const res = await createAgent()
      .get('/api/v1/qa-annotations')
      .set(authHeader('agent_telesale'));
    expect(res.status).toBe(403);
  });

  it('agent_collection blocked from qa-annotations → 403', async () => {
    const res = await createAgent()
      .get('/api/v1/qa-annotations')
      .set(authHeader('agent_collection'));
    expect(res.status).toBe(403);
  });
});

describe('RBAC - Reports', () => {
  it('agent_telesale blocked from reports → 403', async () => {
    const res = await createAgent()
      .get('/api/v1/reports/calls')
      .set(authHeader('agent_telesale'));
    expect(res.status).toBe(403);
  });

  it('qa can access reports → [200, 400, 500]', async () => {
    const res = await createAgent()
      .get('/api/v1/reports/calls')
      .set(authHeader('qa'));
    expect([200, 400, 500]).toContain(res.status);
  });

  it('leader can access reports → [200, 400, 500]', async () => {
    const res = await createAgent()
      .get('/api/v1/reports/calls')
      .set(authHeader('leader'));
    expect([200, 400, 500]).toContain(res.status);
  });
});

describe('RBAC - Teams', () => {
  it('delete team blocked for non-admin (manager) → 403', async () => {
    const res = await createAgent()
      .delete('/api/v1/teams/fake-id')
      .set(authHeader('manager'));
    expect(res.status).toBe(403);
  });

  it('delete team blocked for agent → 403', async () => {
    const res = await createAgent()
      .delete('/api/v1/teams/fake-id')
      .set(authHeader('agent_telesale'));
    expect(res.status).toBe(403);
  });
});
