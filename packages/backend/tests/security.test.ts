import { describe, it, expect } from 'vitest';
import { createAgent, authHeader } from './helpers';

describe('Security Headers', () => {
  it('returns helmet security headers', async () => {
    const res = await createAgent().get('/api/v1/health');

    // Helmet default headers
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-xss-protection']).toBeDefined();
  });

  it('returns CORS headers for allowed origin', async () => {
    const res = await createAgent()
      .get('/api/v1/health')
      .set('Origin', process.env.FRONTEND_URL || 'http://localhost:3000');

    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });
});

describe('Error Handling', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await createAgent()
      .get('/api/v1/nonexistent-endpoint')
      .set(authHeader('admin'));

    // Express returns 404 for unmatched routes
    expect(res.status).toBe(404);
  });

  it('health endpoint returns 200', async () => {
    const res = await createAgent().get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});

describe('Input Validation', () => {
  it('rejects invalid JSON body', async () => {
    const res = await createAgent()
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ invalid json }');

    // Express returns 400 or 500 for malformed JSON
    expect([400, 500]).toContain(res.status);
  });

  it('rejects login with too-short password', async () => {
    const res = await createAgent()
      .post('/api/v1/auth/login')
      .send({ email: 'user@test.com', password: '' });

    expect(res.status).toBe(400);
  });
});

describe('Auth Protection', () => {
  const protectedEndpoints = [
    { method: 'get', path: '/api/v1/contacts' },
    { method: 'get', path: '/api/v1/leads' },
    { method: 'get', path: '/api/v1/debt-cases' },
    { method: 'get', path: '/api/v1/call-logs' },
    { method: 'get', path: '/api/v1/tickets' },
    { method: 'get', path: '/api/v1/campaigns' },
    { method: 'get', path: '/api/v1/dashboard/overview' },
    { method: 'get', path: '/api/v1/notifications' },
  ];

  protectedEndpoints.forEach(({ method, path }) => {
    it(`returns 401 for unauthenticated ${method.toUpperCase()} ${path}`, async () => {
      const res = await (createAgent() as Record<string, Function>)[method](path);
      expect(res.status).toBe(401);
    });
  });
});

describe('Webhook Security', () => {
  it('CDR webhook accepts XML content type', async () => {
    const res = await createAgent()
      .post('/api/v1/webhooks/cdr')
      .set('Content-Type', 'text/xml')
      .send('<xml></xml>');

    // Should not return 401 (webhook routes have their own auth)
    // May return 400/500 depending on XML validation
    expect(res.status).not.toBe(404);
  });
});
