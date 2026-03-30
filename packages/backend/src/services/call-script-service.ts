import prisma from '../lib/prisma';

/**
 * Resolve which script to show for an active call.
 * Priority: campaign script → product script → default script.
 */
export async function resolveScript(
  userId: string,
  campaignId?: string | null,
  product?: string | null,
): Promise<{ name: string; content: string; type: string } | null> {
  // 1. Campaign script (from campaign.script field)
  if (campaignId) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { name: true, script: true },
    });
    if (campaign?.script) {
      return { name: `Script: ${campaign.name}`, content: campaign.script, type: 'campaign' };
    }
  }

  // 2. Product-specific script
  if (product) {
    const productScript = await prisma.callScript.findFirst({
      where: { type: 'product', product, isActive: true },
      select: { name: true, content: true },
      orderBy: { sortOrder: 'asc' },
    });
    if (productScript) {
      return { name: productScript.name, content: productScript.content, type: 'product' };
    }
  }

  // 3. Default script
  const defaultScript = await prisma.callScript.findFirst({
    where: { type: 'default', isActive: true },
    select: { name: true, content: true },
    orderBy: { sortOrder: 'asc' },
  });
  if (defaultScript) {
    return { name: defaultScript.name, content: defaultScript.content, type: 'default' };
  }

  return null;
}

/** Substitute variables in script content */
export function substituteVariables(
  content: string,
  vars: Record<string, string>,
): string {
  let result = content;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

/** CRUD for call scripts */
export async function listScripts() {
  return prisma.callScript.findMany({
    orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
  });
}

export async function createScript(data: {
  name: string;
  type: 'default' | 'product';
  product?: string;
  content: string;
  createdBy?: string;
}) {
  return prisma.callScript.create({ data });
}

export async function updateScript(id: string, data: {
  name?: string;
  content?: string;
  product?: string;
  isActive?: boolean;
  sortOrder?: number;
}) {
  return prisma.callScript.update({ where: { id }, data });
}

export async function deleteScript(id: string) {
  return prisma.callScript.delete({ where: { id } });
}
