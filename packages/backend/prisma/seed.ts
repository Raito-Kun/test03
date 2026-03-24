import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

async function main() {
  // Production guard — seed only in development
  if (process.env.NODE_ENV === 'production') {
    console.error('ERROR: Seed script cannot run in production. Set ADMIN_EMAIL and ADMIN_PASSWORD env vars for production admin setup.');
    process.exit(1);
  }

  console.log('Seeding development database...');

  // Teams
  const teamTelesale = await prisma.team.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Telesale Team A',
      type: 'telesale',
    },
  });

  const teamCollection = await prisma.team.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Collection Team A',
      type: 'collection',
    },
  });

  // 6 users (1 per role)
  const password = await bcrypt.hash('changeme123', BCRYPT_ROUNDS);

  const users = [
    { id: '10000000-0000-0000-0000-000000000001', email: 'admin@crm.local', fullName: 'Admin User', role: 'admin' as const, teamId: null, sipExtension: '1001' },
    { id: '10000000-0000-0000-0000-000000000002', email: 'manager@crm.local', fullName: 'Manager User', role: 'manager' as const, teamId: null, sipExtension: '1002' },
    { id: '10000000-0000-0000-0000-000000000003', email: 'qa@crm.local', fullName: 'QA User', role: 'qa' as const, teamId: null, sipExtension: '1003' },
    { id: '10000000-0000-0000-0000-000000000004', email: 'leader@crm.local', fullName: 'Leader Telesale', role: 'leader' as const, teamId: teamTelesale.id, sipExtension: '1004' },
    { id: '10000000-0000-0000-0000-000000000005', email: 'agent.ts@crm.local', fullName: 'Agent Telesale', role: 'agent_telesale' as const, teamId: teamTelesale.id, sipExtension: '1005' },
    { id: '10000000-0000-0000-0000-000000000006', email: 'agent.col@crm.local', fullName: 'Agent Collection', role: 'agent_collection' as const, teamId: teamCollection.id, sipExtension: '1006' },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        id: u.id,
        email: u.email,
        passwordHash: password,
        fullName: u.fullName,
        role: u.role,
        teamId: u.teamId,
        sipExtension: u.sipExtension,
        mustChangePassword: true,
      },
    });
  }

  // Set team leaders
  await prisma.team.update({ where: { id: teamTelesale.id }, data: { leaderId: users[3].id } });
  await prisma.team.update({ where: { id: teamCollection.id }, data: { leaderId: users[5].id } });

  // Disposition codes — Telesale
  const telesaleDispositions = [
    { code: 'contacted', label: 'Đã liên hệ', category: 'telesale' as const, isFinal: false, requiresCallback: false, sortOrder: 1 },
    { code: 'callback', label: 'Hẹn gọi lại', category: 'telesale' as const, isFinal: false, requiresCallback: true, sortOrder: 2 },
    { code: 'not_interested', label: 'Không quan tâm', category: 'telesale' as const, isFinal: true, requiresCallback: false, sortOrder: 3 },
    { code: 'qualified', label: 'Đủ điều kiện', category: 'telesale' as const, isFinal: false, requiresCallback: false, sortOrder: 4 },
    { code: 'won', label: 'Chốt thành công', category: 'telesale' as const, isFinal: true, requiresCallback: false, sortOrder: 5 },
    { code: 'lost', label: 'Mất lead', category: 'telesale' as const, isFinal: true, requiresCallback: false, sortOrder: 6 },
  ];

  // Disposition codes — Collection
  const collectionDispositions = [
    { code: 'col_contacted', label: 'Đã liên hệ', category: 'collection' as const, isFinal: false, requiresCallback: false, sortOrder: 1 },
    { code: 'promise_to_pay', label: 'Hứa trả', category: 'collection' as const, isFinal: false, requiresCallback: true, sortOrder: 2 },
    { code: 'paid', label: 'Đã thanh toán', category: 'collection' as const, isFinal: true, requiresCallback: false, sortOrder: 3 },
    { code: 'refused', label: 'Từ chối trả', category: 'collection' as const, isFinal: true, requiresCallback: false, sortOrder: 4 },
    { code: 'wrong_number', label: 'Sai số', category: 'collection' as const, isFinal: true, requiresCallback: false, sortOrder: 5 },
    { code: 'no_answer', label: 'Không nghe máy', category: 'both' as const, isFinal: false, requiresCallback: true, sortOrder: 6 },
  ];

  for (const d of [...telesaleDispositions, ...collectionDispositions]) {
    await prisma.dispositionCode.upsert({
      where: { code: d.code },
      update: {},
      create: d,
    });
  }

  // Ticket categories
  const categories = [
    { name: 'Tư vấn', sortOrder: 1 },
    { name: 'Khiếu nại', sortOrder: 2 },
    { name: 'Hỗ trợ', sortOrder: 3 },
    { name: 'Hẹn gọi lại', sortOrder: 4 },
  ];

  for (const cat of categories) {
    const existing = await prisma.ticketCategory.findFirst({ where: { name: cat.name, parentId: null } });
    if (!existing) {
      await prisma.ticketCategory.create({ data: cat });
    }
  }

  console.log('Seed complete: 2 teams, 6 users, 12 disposition codes, 4 ticket categories');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
