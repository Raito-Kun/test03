import { describe, it, expect } from 'vitest';
import { createAgent, authHeader } from './helpers';

describe('Auth API', () => {
  describe('POST /api/v1/auth/login', () => {
    it('returns 400 for missing credentials', async () => {
      const res = await createAgent()
        .post('/api/v1/auth/login')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid email format', async () => {
      const res = await createAgent()
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 401 for wrong credentials (or 500 if no DB)', async () => {
      const res = await createAgent()
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'wrongpassword' });

      expect([401, 500]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('returns 401 when no refresh cookie is present', async () => {
      const res = await createAgent()
        .post('/api/v1/auth/refresh');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('REFRESH_TOKEN_INVALID');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('returns 401 without auth token', async () => {
      const res = await createAgent()
        .post('/api/v1/auth/logout');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns 401 without auth token', async () => {
      const res = await createAgent()
        .get('/api/v1/auth/me');

      expect(res.status).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      const res = await createAgent()
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_INVALID');
    });
  });
});

describe('RBAC - Role-based access', () => {
  describe('GET /api/v1/users (admin/manager only)', () => {
    it('allows admin to list users', async () => {
      const res = await createAgent()
        .get('/api/v1/users')
        .set(authHeader('admin'));

      // Should not return 401 or 403
      expect([200, 500]).toContain(res.status); // 500 if no DB
    });

    it('blocks agent_telesale from listing users', async () => {
      const res = await createAgent()
        .get('/api/v1/users')
        .set(authHeader('agent_telesale'));

      expect(res.status).toBe(403);
    });

    it('blocks agent_collection from listing users', async () => {
      const res = await createAgent()
        .get('/api/v1/users')
        .set(authHeader('agent_collection'));

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/users (admin only)', () => {
    it('blocks manager from creating users', async () => {
      const res = await createAgent()
        .post('/api/v1/users')
        .set(authHeader('manager'))
        .send({ email: 'test@test.com', password: '123456', fullName: 'Test', role: 'agent_telesale' });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/campaigns (admin/manager only)', () => {
    it('blocks agent from creating campaigns', async () => {
      const res = await createAgent()
        .post('/api/v1/campaigns')
        .set(authHeader('agent_telesale'))
        .send({ name: 'Test', type: 'telesale' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/qa-annotations (qa/leader/manager/admin only)', () => {
    it('blocks agent from viewing QA annotations', async () => {
      const res = await createAgent()
        .get('/api/v1/qa-annotations')
        .set(authHeader('agent_telesale'));

      expect(res.status).toBe(403);
    });

    it('allows qa role to view QA annotations', async () => {
      const res = await createAgent()
        .get('/api/v1/qa-annotations')
        .set(authHeader('qa'));

      expect([200, 500]).toContain(res.status);
    });
  });
});
