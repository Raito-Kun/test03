import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma BEFORE importing the module under test
vi.mock('../src/lib/prisma', () => ({
  default: {
    pbxCluster: {
      findFirst: vi.fn(),
    },
  },
}));

import prisma from '../src/lib/prisma';
import { resolveListClusterFilter } from '../src/lib/active-cluster';

const mockFindFirst = prisma.pbxCluster.findFirst as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFindFirst.mockReset();
});

describe('resolveListClusterFilter — cross-tenant leak guard', () => {
  it('super_admin reads the DB-active cluster, NOT the JWT claim', async () => {
    // Scenario: super_admin created in blueva (stale JWT claim), currently viewing hoangthien
    mockFindFirst.mockResolvedValue({ id: 'hoangthien-uuid' });
    const result = await resolveListClusterFilter('super_admin', 'blueva-uuid-from-stale-jwt');
    expect(result).toBe('hoangthien-uuid');
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true },
    });
  });

  it('super_admin gets null when no cluster is isActive (prevents seeing all tenants)', async () => {
    mockFindFirst.mockResolvedValue(null);
    const result = await resolveListClusterFilter('super_admin', 'some-jwt-value');
    expect(result).toBeNull();
  });

  it('regular user (agent) uses JWT claim, does NOT hit the DB', async () => {
    const result = await resolveListClusterFilter('agent', 'agent-home-cluster');
    expect(result).toBe('agent-home-cluster');
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it('leader role uses JWT claim', async () => {
    const result = await resolveListClusterFilter('leader', 'leader-cluster');
    expect(result).toBe('leader-cluster');
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it('admin (non-super) uses JWT claim', async () => {
    const result = await resolveListClusterFilter('admin', 'admin-cluster');
    expect(result).toBe('admin-cluster');
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it('regular user with no JWT claim falls back to DB active (legacy)', async () => {
    mockFindFirst.mockResolvedValue({ id: 'fallback-cluster' });
    const result = await resolveListClusterFilter('agent', null);
    expect(result).toBe('fallback-cluster');
  });

  it('undefined role uses JWT claim path (non-super behavior)', async () => {
    const result = await resolveListClusterFilter(undefined, 'jwt-cluster');
    expect(result).toBe('jwt-cluster');
    expect(mockFindFirst).not.toHaveBeenCalled();
  });
});
