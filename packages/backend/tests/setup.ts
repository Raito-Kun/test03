import dotenv from 'dotenv';

// Load test environment
dotenv.config({ path: '.env.test' });

// Override env for test — must be set BEFORE any app module imports
process.env.NODE_ENV = 'test';
process.env.ESL_ENABLED = 'false';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-jwt-access-secret-key-for-testing';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://crm_user:crm_password@localhost:5432/crm_db';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
