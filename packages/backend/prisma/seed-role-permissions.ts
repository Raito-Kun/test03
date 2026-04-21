/**
 * Targeted re-seed: populate role_permissions for every cluster × role × key
 * using the canonical default grants. Idempotent.
 *
 * Invoked standalone after the per-tenant role_permissions migration wiped
 * the legacy global rows.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultGrants: Record<string, string[]> = {
  super_admin: [
    'switchboard.manage','switchboard.make_call','switchboard.receive_call','switchboard.transfer_call','switchboard.hold_call','switchboard.listen_recording','switchboard.download_recording','recording.delete',
    'crm.manage','crm.contacts.view','crm.contacts.create','crm.contacts.edit','crm.contacts.delete','crm.contacts.import','crm.contacts.export','crm.leads.view','crm.leads.create','crm.leads.edit','crm.leads.delete','crm.leads.import','crm.debt.view','crm.debt.edit','crm.data_allocation',
    'campaign.manage','campaign.create','campaign.edit','campaign.delete','campaign.assign','campaign.import',
    'report.manage','report.view_own','report.view_team','report.view_all','report.export',
    'ticket.manage','ticket.create','ticket.edit','ticket.delete','ticket.assign',
    'qa.manage','qa.score','qa.review','qa.annotate',
    'system.manage','system.users','system.roles','system.permissions','system.settings','system.audit_log',
  ],
  admin: [
    // admin gets everything except a few system-level leaves
    'switchboard.manage','switchboard.make_call','switchboard.receive_call','switchboard.transfer_call','switchboard.hold_call','switchboard.listen_recording','switchboard.download_recording','recording.delete',
    'crm.manage','crm.contacts.view','crm.contacts.create','crm.contacts.edit','crm.contacts.delete','crm.contacts.import','crm.contacts.export','crm.leads.view','crm.leads.create','crm.leads.edit','crm.leads.delete','crm.leads.import','crm.debt.view','crm.debt.edit','crm.data_allocation',
    'campaign.manage','campaign.create','campaign.edit','campaign.delete','campaign.assign','campaign.import',
    'report.manage','report.view_own','report.view_team','report.view_all','report.export',
    'ticket.manage','ticket.create','ticket.edit','ticket.delete','ticket.assign',
    'qa.manage','qa.score','qa.review','qa.annotate',
    'system.manage',
  ],
  manager: [
    'switchboard.manage','switchboard.make_call','switchboard.receive_call','switchboard.transfer_call','switchboard.hold_call','switchboard.listen_recording','switchboard.download_recording',
    'crm.manage','crm.contacts.view','crm.contacts.create','crm.contacts.edit','crm.contacts.delete','crm.contacts.import','crm.contacts.export','crm.leads.view','crm.leads.create','crm.leads.edit','crm.leads.delete','crm.leads.import','crm.debt.view','crm.debt.edit','crm.data_allocation',
    'campaign.manage','campaign.create','campaign.edit','campaign.delete','campaign.assign','campaign.import',
    'report.manage','report.view_own','report.view_team','report.view_all','report.export',
    'ticket.manage','ticket.create','ticket.edit','ticket.delete','ticket.assign',
  ],
  leader: [
    'switchboard.manage','switchboard.make_call','switchboard.receive_call','switchboard.transfer_call','switchboard.hold_call','switchboard.listen_recording',
    'crm.manage','crm.contacts.view','crm.contacts.create','crm.contacts.edit','crm.leads.view','crm.leads.create','crm.leads.edit','crm.debt.view','crm.data_allocation',
    'campaign.manage',
    'report.manage','report.view_own','report.view_team',
    'ticket.manage','ticket.create','ticket.edit','ticket.assign',
  ],
  qa: [
    'qa.manage','qa.score','qa.review','qa.annotate',
    'switchboard.listen_recording',
    'report.manage','report.view_own',
  ],
  agent_telesale: [
    'switchboard.make_call','switchboard.receive_call','switchboard.hold_call',
    'crm.contacts.view','crm.contacts.create','crm.contacts.edit',
    'crm.leads.view','crm.leads.create','crm.leads.edit',
    'ticket.create','ticket.edit',
  ],
  agent_collection: [
    'switchboard.make_call','switchboard.receive_call','switchboard.hold_call',
    'crm.contacts.view','crm.contacts.edit',
    'crm.debt.view','crm.debt.edit',
    'ticket.create','ticket.edit',
  ],
};

async function main() {
  const [clusters, permissions] = await Promise.all([
    prisma.pbxCluster.findMany({ select: { id: true, name: true } }),
    prisma.permission.findMany({ select: { id: true, key: true } }),
  ]);

  const permMap = Object.fromEntries(permissions.map((p) => [p.key, p.id]));

  let total = 0;
  for (const cluster of clusters) {
    for (const [role, keys] of Object.entries(defaultGrants)) {
      for (const key of keys) {
        const permissionId = permMap[key];
        if (!permissionId) continue;
        await prisma.rolePermission.upsert({
          where: { clusterId_role_permissionId: { clusterId: cluster.id, role: role as any, permissionId } },
          update: { granted: true },
          create: { clusterId: cluster.id, role: role as any, permissionId, granted: true },
        });
        total++;
      }
    }
    console.log(`  cluster ${cluster.name}: done`);
  }
  console.log(`Total upserts: ${total} across ${clusters.length} clusters`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
