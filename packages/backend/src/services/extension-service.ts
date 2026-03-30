import prisma from '../lib/prisma';
import { getSofiaRegistrations } from './esl-service';

export interface ExtensionInfo {
  extension: string;
  userId: string | null;
  userFullName: string | null;
  userEmail: string | null;
  domain: string;
  status: 'Registered' | 'Unregistered' | 'Unknown';
}

const DOMAIN = process.env.FUSIONPBX_DOMAIN || 'crm';

export async function listExtensions(): Promise<ExtensionInfo[]> {
  const [users, regs] = await Promise.all([
    prisma.user.findMany({
      where: { sipExtension: { not: null } },
      select: { id: true, fullName: true, email: true, sipExtension: true },
    }),
    getSofiaRegistrations(),
  ]);

  const assignedMap = new Map<string, { id: string; fullName: string; email: string }>();
  for (const u of users) {
    if (u.sipExtension) assignedMap.set(u.sipExtension, { id: u.id, fullName: u.fullName, email: u.email });
  }

  const allExtensions: string[] = [];
  for (let i = 1001; i <= 1010; i++) allExtensions.push(String(i));
  for (const ext of regs.keys()) {
    if (!allExtensions.includes(ext)) allExtensions.push(ext);
  }
  for (const ext of assignedMap.keys()) {
    if (!allExtensions.includes(ext)) allExtensions.push(ext);
  }

  return allExtensions.sort().map((ext) => {
    const user = assignedMap.get(ext) ?? null;
    const regStatus = regs.get(ext);
    const status: ExtensionInfo['status'] = regStatus === 'Registered'
      ? 'Registered'
      : regStatus === 'Unregistered'
        ? 'Unregistered'
        : 'Unknown';
    return {
      extension: ext,
      userId: user?.id ?? null,
      userFullName: user?.fullName ?? null,
      userEmail: user?.email ?? null,
      domain: DOMAIN,
      status,
    };
  });
}

export async function assignExtension(extension: string, userId: string | null): Promise<void> {
  // Clear any user currently assigned this extension
  await prisma.user.updateMany({
    where: { sipExtension: extension },
    data: { sipExtension: null },
  });

  if (userId) {
    await prisma.user.update({
      where: { id: userId },
      data: { sipExtension: extension },
    });
  }
}
