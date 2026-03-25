import request from 'supertest';
import jwt from 'jsonwebtoken';

// Import app without starting server
import app from '../src/index';

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'test-jwt-access-secret-key-for-testing';

export { app };

/** Create a test agent with supertest */
export function createAgent() {
  return request(app);
}

/** Generate a valid JWT access token for testing */
export function generateToken(payload: {
  userId: string;
  email: string;
  role: string;
  teamId?: string;
}): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}

/** Generate auth header for a given role */
export function authHeader(role: string, userId = 'test-user-id', teamId = 'test-team-id') {
  const token = generateToken({
    userId,
    email: `${role}@test.com`,
    role,
    teamId,
  });
  return { Authorization: `Bearer ${token}` };
}

/** Seed test data IDs */
export const TEST_IDS = {
  adminUser: 'test-admin-001',
  agentUser: 'test-agent-001',
  agentUser2: 'test-agent-002',
  managerUser: 'test-manager-001',
  teamId: 'test-team-001',
};
