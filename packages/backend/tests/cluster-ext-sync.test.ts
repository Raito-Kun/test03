import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma BEFORE importing the module under test
vi.mock('../src/lib/prisma', () => ({
  default: {
    pbxCluster: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    clusterExtension: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('../src/lib/audit', () => ({ logAudit: vi.fn() }));
vi.mock('../src/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../src/lib/esl-daemon', () => ({ default: { getConnection: vi.fn() } }));

import prisma from '../src/lib/prisma';
import { listClusters } from '../src/services/cluster-service';

const mockFindMany = prisma.pbxCluster.findMany as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFindMany.mockReset();
});

/**
 * These tests pin the cluster list response shape so the frontend's
 * `ClusterSummary` + poll-until-done state machine keep working. If someone
 * drops one of the ext_sync_* fields from the clusterSelect projection, the
 * badge on `ClusterCard` would silently freeze at "no status" and the 2s
 * polling in `cluster-management.tsx` would never stop or start — both are
 * hard to notice without the exact regression the tests catch.
 */
describe('clusterSelect — ext-sync lifecycle fields surface to the list API', () => {
  it('listClusters projects extSyncStatus, extSyncError, extSyncCount, extSyncFinishedAt', async () => {
    mockFindMany.mockResolvedValue([]);
    await listClusters('some-cluster-uuid', 'admin');
    expect(mockFindMany).toHaveBeenCalledTimes(1);
    const callArg = mockFindMany.mock.calls[0][0];
    expect(callArg.select).toMatchObject({
      extSyncStatus: true,
      extSyncError: true,
      extSyncCount: true,
      extSyncFinishedAt: true,
    });
  });

  it('listClusters never exposes sshPassword / eslPassword / other secrets', async () => {
    mockFindMany.mockResolvedValue([]);
    await listClusters('some-cluster-uuid', 'admin');
    const callArg = mockFindMany.mock.calls[0][0];
    // select maps are whitelists — "undefined" keys simply don't come back,
    // but an explicit `true` here would be a leak. Assert the negative.
    expect(callArg.select.sshPassword).toBeUndefined();
    expect(callArg.select.eslPassword).toBeUndefined();
    expect(callArg.select.aiApiKey).toBeUndefined();
    expect(callArg.select.smtpPassword).toBeUndefined();
    expect(callArg.select.fusionpbxPgPassword).toBeUndefined();
  });

  it('super_admin sees all clusters (no where scope); other roles scoped to their clusterId', async () => {
    mockFindMany.mockResolvedValue([]);
    await listClusters('user-cluster-uuid', 'super_admin');
    expect(mockFindMany.mock.calls[0][0].where).toEqual({});

    mockFindMany.mockClear();
    await listClusters('user-cluster-uuid', 'admin');
    expect(mockFindMany.mock.calls[0][0].where).toEqual({ id: 'user-cluster-uuid' });
  });
});
