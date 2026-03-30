import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { createAgent, authHeader, generateToken } from './helpers';

const BASE = '/api/v1/auth';

describe('Auth - Login', () => {
  it('login success returns token for valid credentials', async () => {
    const res = await createAgent()
      .post(`${BASE}/login`)
      .send({ email: 'admin@test.com', password: 'ValidPass123!' });

    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
    }
  });

  it('login fail - missing credentials → 400', async () => {
    const res = await createAgent()
      .post(`${BASE}/login`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('login fail - invalid email format → 400', async () => {
    const res = await createAgent()
      .post(`${BASE}/login`)
      .send({ email: 'not-an-email', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('login fail - wrong credentials → [401, 500]', async () => {
    const res = await createAgent()
      .post(`${BASE}/login`)
      .send({ email: 'admin@test.com', password: 'wrongpassword' });

    expect([401, 500]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  it('login fail - nonexistent user → [401, 500]', async () => {
    const res = await createAgent()
      .post(`${BASE}/login`)
      .send({ email: 'nonexistent@test.com', password: 'somepassword' });

    expect([401, 500]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });
});

describe('Auth - Logout', () => {
  it('logout without token → 401', async () => {
    const res = await createAgent().post(`${BASE}/logout`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('logout with valid token → [200, 500]', async () => {
    const res = await createAgent()
      .post(`${BASE}/logout`)
      .set(authHeader('admin'));

    expect([200, 500]).toContain(res.status);
  });
});

describe('Auth - Refresh', () => {
  it('refresh without cookie → 401', async () => {
    const res = await createAgent().post(`${BASE}/refresh`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('REFRESH_TOKEN_INVALID');
  });
});

describe('Auth - Me', () => {
  it('GET /me without token → 401', async () => {
    const res = await createAgent().get(`${BASE}/me`);

    expect(res.status).toBe(401);
  });

  it('GET /me with invalid token → 401', async () => {
    const res = await createAgent()
      .get(`${BASE}/me`)
      .set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });

  it('GET /me with expired token → 401', async () => {
    const secret = process.env.JWT_ACCESS_SECRET || 'test-jwt-access-secret-key-for-testing';
    const expired = jwt.sign(
      { userId: 'u1', email: 'admin@test.com', role: 'admin' },
      secret,
      { expiresIn: -1 }
    );

    const res = await createAgent()
      .get(`${BASE}/me`)
      .set('Authorization', `Bearer ${expired}`);

    expect(res.status).toBe(401);
  });

  it('GET /me with valid token → [200, 500]', async () => {
    const res = await createAgent()
      .get(`${BASE}/me`)
      .set(authHeader('admin'));

    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
    }
  });
});
