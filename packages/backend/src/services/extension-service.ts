import prisma from '../lib/prisma';
import { getSofiaRegistrations } from './esl-service';
import { getActiveClusterId } from '../lib/active-cluster';

export interface ExtensionInfo {
  extension: string;
  userId: string | null;
  userFullName: string | null;
  userEmail: string | null;
  domain: string;
  status: 'Registered' | 'Unregistered' | 'Unknown';
}

/**
 * List extensions from cluster_extensions table for the user's cluster.
 * Matches with user assignments and ESL registration status.
 */
export async function listExtensions(userClusterId?: string | null): Promise<ExtensionInfo[]> {
  const clusterId = await getActiveClusterId(userClusterId);
  if (!clusterId) return [];

  const cluster = await prisma.pbxCluster.findUnique({
    where: { id: clusterId },
    select: { sipDomain: true },
  });
  const domain = cluster?.sipDomain || 'unknown';

  const [clusterExts, users, regs] = await Promise.all([
    prisma.clusterExtension.findMany({
      where: { clusterId },
      select: { extension: true, callerName: true },
      orderBy: { extension: 'asc' },
    }),
    prisma.user.findMany({
      where: { clusterId, OR: [{ extension: { not: null } }, { sipExtension: { not: null } }] },
      select: { id: true, fullName: true, email: true, sipExtension: true, extension: true },
    }),
    getSofiaRegistrations(),
  ]);

  const assignedMap = new Map<string, { id: string; fullName: string; email: string }>();
  for (const u of users) {
    const ext = u.extension ?? u.sipExtension;
    if (ext) assignedMap.set(ext, { id: u.id, fullName: u.fullName, email: u.email });
  }

  return clusterExts.map((ce) => {
    const user = assignedMap.get(ce.extension) ?? null;
    const regStatus = regs.get(ce.extension);
    const status: ExtensionInfo['status'] = regStatus === 'Registered'
      ? 'Registered'
      : regStatus === 'Unregistered'
        ? 'Unregistered'
        : 'Unknown';
    return {
      extension: ce.extension,
      userId: user?.id ?? null,
      userFullName: user?.fullName ?? null,
      userEmail: user?.email ?? null,
      domain,
      status,
    };
  });
}

export async function assignExtension(extension: string, userId: string | null): Promise<void> {
  // Clear any user currently assigned this extension (either column)
  await prisma.user.updateMany({
    where: { OR: [{ sipExtension: extension }, { extension }] },
    data: { sipExtension: null, extension: null },
  });

  if (userId) {
    await prisma.user.update({
      where: { id: userId },
      data: { sipExtension: extension, extension },
    });
  }
}
