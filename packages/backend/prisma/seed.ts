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

  // 7 users (1 per role including super_admin)
  const password = await bcrypt.hash('changeme123', BCRYPT_ROUNDS);
  const superAdminPassword = await bcrypt.hash('SuperAdmin@123', BCRYPT_ROUNDS);

  const users = [
    { id: '10000000-0000-0000-0000-000000000000', email: 'superadmin@crm.local', fullName: 'Super Admin', role: 'super_admin' as const, teamId: null, sipExtension: '1000', passwordHash: superAdminPassword },
    { id: '10000000-0000-0000-0000-000000000001', email: 'admin@crm.local', fullName: 'Admin User', role: 'admin' as const, teamId: null, sipExtension: '1001', passwordHash: password },
    { id: '10000000-0000-0000-0000-000000000002', email: 'manager@crm.local', fullName: 'Manager User', role: 'manager' as const, teamId: null, sipExtension: '1002', passwordHash: password },
    { id: '10000000-0000-0000-0000-000000000003', email: 'qa@crm.local', fullName: 'QA User', role: 'qa' as const, teamId: null, sipExtension: '1003', passwordHash: password },
    { id: '10000000-0000-0000-0000-000000000004', email: 'leader@crm.local', fullName: 'Leader Telesale', role: 'leader' as const, teamId: teamTelesale.id, sipExtension: '1004', passwordHash: password },
    { id: '10000000-0000-0000-0000-000000000005', email: 'agent.ts@crm.local', fullName: 'Agent Telesale', role: 'agent_telesale' as const, teamId: teamTelesale.id, sipExtension: '1005', passwordHash: password },
    { id: '10000000-0000-0000-0000-000000000006', email: 'agent.col@crm.local', fullName: 'Agent Collection', role: 'agent_collection' as const, teamId: teamCollection.id, sipExtension: '1006', passwordHash: password },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { sipExtension: u.sipExtension },
      create: {
        id: u.id,
        email: u.email,
        passwordHash: u.passwordHash,
        fullName: u.fullName,
        role: u.role,
        teamId: u.teamId,
        sipExtension: u.sipExtension,
        mustChangePassword: u.role !== 'super_admin',
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

  // Disposition codes — Collection (per collection-disposition-guide)
  // Nhóm 1: Tiếp cận được KH
  const collectionDispositions = [
    { code: 'PTP', label: 'Hứa thanh toán', category: 'collection' as const, isFinal: false, requiresCallback: true, sortOrder: 1 },
    { code: 'PTP_PARTIAL', label: 'Hứa trả 1 phần', category: 'collection' as const, isFinal: false, requiresCallback: true, sortOrder: 2 },
    { code: 'PAID', label: 'Đã thanh toán', category: 'collection' as const, isFinal: true, requiresCallback: false, sortOrder: 3 },
    { code: 'BROKEN_PTP', label: 'Phá cam kết', category: 'collection' as const, isFinal: false, requiresCallback: true, sortOrder: 4 },
    { code: 'DISPUTE', label: 'Tranh chấp', category: 'collection' as const, isFinal: false, requiresCallback: false, sortOrder: 5 },
    { code: 'REFUSED', label: 'Từ chối trả', category: 'collection' as const, isFinal: true, requiresCallback: false, sortOrder: 6 },
    { code: 'HARDSHIP', label: 'Khó khăn tài chính', category: 'collection' as const, isFinal: false, requiresCallback: true, sortOrder: 7 },
    // Nhóm 2: Không tiếp cận KH
    { code: 'no_answer', label: 'Không nghe máy', category: 'both' as const, isFinal: false, requiresCallback: true, sortOrder: 8 },
    { code: 'BUSY', label: 'Máy bận', category: 'both' as const, isFinal: false, requiresCallback: true, sortOrder: 9 },
    { code: 'SWITCHED_OFF', label: 'Tắt máy', category: 'both' as const, isFinal: false, requiresCallback: true, sortOrder: 10 },
    { code: 'CALLBACK', label: 'Hẹn gọi lại', category: 'both' as const, isFinal: false, requiresCallback: true, sortOrder: 11 },
    { code: 'wrong_number', label: 'Sai số', category: 'both' as const, isFinal: true, requiresCallback: false, sortOrder: 12 },
    // Nhóm 3: Đặc biệt
    { code: 'THIRD_PARTY', label: 'Người thứ ba', category: 'collection' as const, isFinal: false, requiresCallback: true, sortOrder: 13 },
    { code: 'DECEASED', label: 'Đã mất', category: 'collection' as const, isFinal: true, requiresCallback: false, sortOrder: 14 },
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

  // ─── Permissions (hierarchical) ───────────────────────────
  // Parents first (no parentId), then children referencing parent keys
  type PermDef = { key: string; label: string; group: string; parentKey?: string };

  const permissionDefs: PermDef[] = [
    // ── Tổng đài (Switchboard) ──
    { key: 'switchboard.manage',            label: 'Quản lý tổng đài',        group: 'switchboard' },
    { key: 'switchboard.make_call',         label: 'Thực hiện cuộc gọi',      group: 'switchboard', parentKey: 'switchboard.manage' },
    { key: 'switchboard.receive_call',      label: 'Nhận cuộc gọi',           group: 'switchboard', parentKey: 'switchboard.manage' },
    { key: 'switchboard.transfer_call',     label: 'Chuyển cuộc gọi',         group: 'switchboard', parentKey: 'switchboard.manage' },
    { key: 'switchboard.hold_call',         label: 'Giữ cuộc gọi',            group: 'switchboard', parentKey: 'switchboard.manage' },
    { key: 'switchboard.listen_recording',  label: 'Nghe ghi âm',             group: 'switchboard', parentKey: 'switchboard.manage' },
    { key: 'switchboard.download_recording',label: 'Tải ghi âm',              group: 'switchboard', parentKey: 'switchboard.manage' },
    { key: 'recording.delete',              label: 'Xoá ghi âm',              group: 'switchboard', parentKey: 'switchboard.manage' },

    // ── CRM ──
    { key: 'crm.manage',           label: 'Quản lý CRM',         group: 'crm' },
    { key: 'crm.contacts.view',    label: 'Xem danh bạ',         group: 'crm', parentKey: 'crm.manage' },
    { key: 'crm.contacts.create',  label: 'Tạo liên hệ',         group: 'crm', parentKey: 'crm.manage' },
    { key: 'crm.contacts.edit',    label: 'Sửa liên hệ',         group: 'crm', parentKey: 'crm.manage' },
    { key: 'crm.contacts.delete',  label: 'Xóa liên hệ',         group: 'crm', parentKey: 'crm.manage' },
    { key: 'crm.contacts.import',  label: 'Import danh bạ',       group: 'crm', parentKey: 'crm.manage' },
    { key: 'crm.contacts.export',  label: 'Export danh bạ',       group: 'crm', parentKey: 'crm.manage' },
    { key: 'crm.leads.view',       label: 'Xem leads',           group: 'crm', parentKey: 'crm.manage' },
    { key: 'crm.leads.create',     label: 'Tạo lead',            group: 'crm', parentKey: 'crm.manage' },
    { key: 'crm.leads.edit',       label: 'Sửa lead',            group: 'crm', parentKey: 'crm.manage' },
    { key: 'crm.leads.delete',     label: 'Xóa lead',            group: 'crm', parentKey: 'crm.manage' },
    { key: 'crm.leads.import',     label: 'Import leads',         group: 'crm', parentKey: 'crm.manage' },
    { key: 'crm.debt.view',        label: 'Xem công nợ',         group: 'crm', parentKey: 'crm.manage' },
    { key: 'crm.debt.edit',        label: 'Sửa công nợ',         group: 'crm', parentKey: 'crm.manage' },
    { key: 'crm.data_allocation',  label: 'Phân bổ dữ liệu',     group: 'crm', parentKey: 'crm.manage' },

    // ── Chiến dịch (Campaign) ──
    { key: 'campaign.manage', label: 'Quản lý chiến dịch',   group: 'campaign' },
    { key: 'campaign.create', label: 'Tạo chiến dịch',       group: 'campaign', parentKey: 'campaign.manage' },
    { key: 'campaign.edit',   label: 'Sửa chiến dịch',       group: 'campaign', parentKey: 'campaign.manage' },
    { key: 'campaign.delete', label: 'Xóa chiến dịch',       group: 'campaign', parentKey: 'campaign.manage' },
    { key: 'campaign.assign', label: 'Phân bổ chiến dịch',   group: 'campaign', parentKey: 'campaign.manage' },
    { key: 'campaign.import', label: 'Nhập chiến dịch CSV',  group: 'campaign', parentKey: 'campaign.manage' },

    // ── Báo cáo (Reports) ──
    { key: 'report.manage',     label: 'Quản lý báo cáo',        group: 'report' },
    { key: 'report.view_own',   label: 'Xem báo cáo cá nhân',    group: 'report', parentKey: 'report.manage' },
    { key: 'report.view_team',  label: 'Xem báo cáo nhóm',       group: 'report', parentKey: 'report.manage' },
    { key: 'report.view_all',   label: 'Xem tất cả báo cáo',     group: 'report', parentKey: 'report.manage' },
    { key: 'report.export',     label: 'Xuất báo cáo',            group: 'report', parentKey: 'report.manage' },

    // ── Phiếu ghi (Tickets) ──
    { key: 'ticket.manage', label: 'Quản lý phiếu ghi',   group: 'ticket' },
    { key: 'ticket.create', label: 'Tạo phiếu ghi',       group: 'ticket', parentKey: 'ticket.manage' },
    { key: 'ticket.edit',   label: 'Sửa phiếu ghi',       group: 'ticket', parentKey: 'ticket.manage' },
    { key: 'ticket.delete', label: 'Xóa phiếu ghi',       group: 'ticket', parentKey: 'ticket.manage' },
    { key: 'ticket.assign', label: 'Phân công phiếu ghi', group: 'ticket', parentKey: 'ticket.manage' },

    // ── QA ──
    { key: 'qa.manage',   label: 'Quản lý QA', group: 'qa' },
    { key: 'qa.score',    label: 'Chấm điểm',  group: 'qa', parentKey: 'qa.manage' },
    { key: 'qa.review',   label: 'Đánh giá',   group: 'qa', parentKey: 'qa.manage' },
    { key: 'qa.annotate', label: 'Ghi chú QA', group: 'qa', parentKey: 'qa.manage' },

    // ── Hệ thống (System) ──
    { key: 'system.manage',      label: 'Quản lý hệ thống',  group: 'system' },
    { key: 'system.users',       label: 'Quản lý người dùng', group: 'system', parentKey: 'system.manage' },
    { key: 'system.roles',       label: 'Quản lý vai trò',    group: 'system', parentKey: 'system.manage' },
    { key: 'system.permissions', label: 'Quản lý quyền',      group: 'system', parentKey: 'system.manage' },
    { key: 'system.settings',    label: 'Cài đặt hệ thống',   group: 'system', parentKey: 'system.manage' },
    { key: 'system.audit_log',   label: 'Nhật ký hệ thống',   group: 'system', parentKey: 'system.manage' },
  ];

  // Upsert parents first (no parentKey), then children
  const parents = permissionDefs.filter((p) => !p.parentKey);
  const children = permissionDefs.filter((p) => !!p.parentKey);

  for (const p of parents) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { label: p.label, group: p.group },
      create: { key: p.key, label: p.label, group: p.group },
    });
  }

  // Build key→id map after upserting parents
  const parentMap = Object.fromEntries(
    (await prisma.permission.findMany()).map((p) => [p.key, p.id]),
  );

  for (const p of children) {
    const parentId = p.parentKey ? parentMap[p.parentKey] : undefined;
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { label: p.label, group: p.group, parentId: parentId ?? null },
      create: { key: p.key, label: p.label, group: p.group, parentId: parentId ?? null },
    });
  }

  // Default role grants
  const permMap = Object.fromEntries(
    (await prisma.permission.findMany()).map((p) => [p.key, p.id]),
  );

  const defaultGrants: Record<string, string[]> = {
    super_admin: permissionDefs.map((p) => p.key),
    admin: permissionDefs
      .filter((p) => p.group !== 'system' || p.key === 'system.manage')
      .filter((p) => !['system.users','system.roles','system.permissions','system.settings','system.audit_log'].includes(p.key))
      .map((p) => p.key),
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

  const clusters = await prisma.pbxCluster.findMany({ select: { id: true } });
  for (const cluster of clusters) {
    for (const [role, keys] of Object.entries(defaultGrants)) {
      for (const key of keys) {
        const permissionId = permMap[key];
        if (!permissionId) continue;
        await prisma.rolePermission.upsert({
          where: {
            clusterId_role_permissionId: { clusterId: cluster.id, role: role as any, permissionId },
          },
          update: { granted: true },
          create: { clusterId: cluster.id, role: role as any, permissionId, granted: true },
        });
      }
    }
  }

  // ─── Call Scripts (per telesale-script-generator & collection-disposition-guide) ───

  const scripts = [
    {
      name: 'Kịch bản Telesale — Mặc định',
      type: 'default' as const,
      product: null,
      sortOrder: 1,
      content: `**Bước 1 — Mở đầu & Xác minh danh tính**
Xin chào, tôi là {{agent_name}} từ [Công ty]. Xin hỏi tôi đang nói chuyện với anh/chị {{customer_name}} phải không ạ?

**Bước 2 — Tạo sự liên quan (Hook)**
Anh/chị ơi, bên em đang có chương trình ưu đãi đặc biệt dành riêng cho khách hàng [phân khúc]. Em xin phép chia sẻ nhanh với anh/chị được không ạ?

**Bước 3 — Thăm dò nhu cầu (2-3 câu hỏi)**
• Hiện tại anh/chị có đang quan tâm đến {{product}} không ạ?
• Anh/chị đang sử dụng dịch vụ nào tương tự chưa?
• Mức ngân sách anh/chị dự kiến khoảng bao nhiêu?

**Bước 4 — Giới thiệu sản phẩm**
Dựa trên nhu cầu của anh/chị, em xin giới thiệu {{product}} với những ưu điểm:
• [Ưu điểm 1 — phù hợp nhu cầu đã thăm dò]
• [Ưu điểm 2 — lợi ích cụ thể]
• [Ưu điểm 3 — khác biệt so với đối thủ]

**Bước 5 — Xử lý 4 nhóm Objection**
① "Không có nhu cầu" → Dạ em hiểu, nhưng anh/chị biết không, nhiều khách hàng ban đầu cũng nghĩ vậy…
② "Giá cao" → Em hiểu lo lắng của anh/chị. Nếu tính ra chi phí mỗi ngày chỉ khoảng X đồng thôi ạ…
③ "Cần suy nghĩ" → Dạ anh/chị cần thêm thông tin gì để quyết định không ạ? Em hỗ trợ ngay…
④ "Đang dùng bên khác" → Anh/chị có thể so sánh thử, bên em có ưu đãi chuyển đổi rất hấp dẫn…

**Bước 6 — Chốt cuộc gọi**
Vậy anh/chị cho phép em ghi nhận thông tin để tiến hành [bước tiếp theo] nhé?
• Xác nhận: họ tên, SĐT, email
• Hẹn lịch: Anh/chị tiện nhận cuộc gọi tiếp theo lúc nào ạ?

**Bước 7 — Kết thúc**
*Nếu chốt (A):* Cảm ơn anh/chị {{customer_name}} đã tin tưởng. Em sẽ gửi thông tin xác nhận qua [kênh]. Chúc anh/chị một ngày tốt lành!
*Nếu hẹn lại (B):* Vâng, em sẽ liên hệ lại anh/chị vào [ngày giờ]. Cảm ơn anh/chị đã dành thời gian!
*Nếu từ chối (C):* Dạ em cảm ơn anh/chị đã lắng nghe. Nếu sau này có nhu cầu, anh/chị cứ liên hệ hotline [số] nhé. Chúc anh/chị một ngày tốt lành!`,
    },
    {
      name: 'Kịch bản Vay tiêu dùng',
      type: 'product' as const,
      product: 'vay_tieu_dung',
      sortOrder: 2,
      content: `**Sản phẩm: Vay tiêu dùng**
*Tone: Gần gũi, đồng cảm*
*Điểm nhấn: Giải ngân nhanh, không thế chấp*

**Mở đầu:**
Xin chào anh/chị {{customer_name}}, em là {{agent_name}}. Anh/chị ơi, bên em đang có gói vay tiêu dùng giải ngân trong 24h, không cần thế chấp — em chia sẻ nhanh với anh/chị nhé?

**Thăm dò:**
• Anh/chị có đang cần khoản tài chính cho mục đích gì không ạ? (mua sắm, sửa nhà, du lịch…)
• Khoản vay anh/chị quan tâm khoảng bao nhiêu?

**Giới thiệu:**
• Hạn mức: 10 triệu — 500 triệu
• Lãi suất: từ X%/năm, trả góp linh hoạt 6-60 tháng
• Giải ngân: trong 24h sau duyệt hồ sơ
• Không cần thế chấp tài sản

**Xử lý từ chối:**
"Lãi cao" → Tính ra mỗi tháng anh/chị chỉ trả X đồng, bằng 1 bữa cafe mỗi ngày thôi ạ.
"Sợ nợ" → Bên em có bảo hiểm khoản vay, trường hợp bất khả kháng sẽ được hỗ trợ ạ.

**Chốt:**
Em chỉ cần CMND/CCCD và bảng lương — em hỗ trợ anh/chị làm hồ sơ ngay hôm nay được không ạ?`,
    },
    {
      name: 'Kịch bản Thẻ tín dụng',
      type: 'product' as const,
      product: 'the_tin_dung',
      sortOrder: 3,
      content: `**Sản phẩm: Thẻ tín dụng**
*Tone: Năng động, bận ích*
*Điểm nhấn: Miễn lãi kỳ ngay, cashback*

**Mở đầu:**
Chào anh/chị {{customer_name}}, em là {{agent_name}}. Hiện bên em đang có chương trình mở thẻ tín dụng miễn phí thường niên năm đầu + hoàn tiền đến 5% — anh/chị cho em 2 phút chia sẻ nhé?

**Thăm dò:**
• Anh/chị hiện có đang dùng thẻ tín dụng nào không ạ?
• Anh/chị hay chi tiêu online hay offline nhiều hơn?

**Giới thiệu:**
• Hạn mức: tối đa 500 triệu
• Miễn lãi: đến 55 ngày
• Hoàn tiền: cashback 1-5% tùy danh mục
• Phí thường niên: MIỄN năm đầu, miễn vĩnh viễn nếu chi tiêu đủ
• Ưu đãi: giảm giá tại 1000+ đối tác

**Xử lý từ chối:**
"Đã có thẻ rồi" → Anh/chị hoàn toàn có thể dùng song song. Thẻ bên em cashback cao hơn cho [danh mục KH hay dùng] ạ.
"Sợ phí" → Chỉ cần chi tiêu X triệu/tháng là miễn phí hoàn toàn ạ.

**Chốt:**
Em hỗ trợ anh/chị đăng ký online ngay, chỉ cần 5 phút thôi ạ. Anh/chị cho em xác nhận thông tin nhé?`,
    },
    {
      name: 'Kịch bản Tái tục hợp đồng',
      type: 'product' as const,
      product: 'tai_tuc_hop_dong',
      sortOrder: 4,
      content: `**Sản phẩm: Tái tục hợp đồng**
*Tone: Tín trọng, trân trọng*
*Điểm nhấn: Ưu đãi khách cũ, hạn mức đã tích*

**Mở đầu:**
Xin chào anh/chị {{customer_name}}, em là {{agent_name}}. Anh/chị là khách hàng thân thiết và hợp đồng của anh/chị sắp đến hạn — bên em có chính sách ưu đãi đặc biệt dành riêng cho khách hàng cũ, anh/chị cho em chia sẻ nhé?

**Thăm dò:**
• Trong thời gian qua, anh/chị có hài lòng với dịch vụ bên em không ạ?
• Anh/chị có mong muốn điều chỉnh gì về hạn mức hoặc kỳ hạn không?

**Giới thiệu:**
• Hạn mức mới: tăng lên đến [hạn mức tích lũy]
• Lãi suất: ưu đãi X% — thấp hơn khách mới
• Thủ tục: đơn giản hóa, không cần hồ sơ lại
• Bonus: [quà tặng / voucher] khi tái tục trong tháng này

**Xử lý từ chối:**
"Muốn chuyển bên khác" → Em hiểu, nhưng lịch sử tín dụng tốt của anh/chị bên em đang cho hạn mức cao hơn đối thủ rất nhiều ạ.
"Không cần nữa" → Dạ, anh/chị có thể giữ tài khoản không phí để khi cần thì kích hoạt lại nhanh ạ.

**Chốt:**
Em xin phép gửi hợp đồng tái tục qua email, anh/chị xác nhận là xong trong 5 phút thôi ạ. Anh/chị đồng ý em tiến hành nhé?`,
    },
    {
      name: 'Kịch bản Thu hồi nợ — Mặc định',
      type: 'default' as const,
      product: null,
      sortOrder: 5,
      content: `**Kịch bản Thu hồi nợ (Collection)**

**Bước 1 — Xác minh danh tính**
Xin chào, tôi là {{agent_name}} từ bộ phận quản lý tài khoản [Công ty]. Tôi muốn xác nhận mình đang nói chuyện với anh/chị {{customer_name}} — chủ tài khoản số [mã HĐ] — đúng không ạ?

**Bước 2 — Thông báo tình trạng nợ**
Theo hệ thống ghi nhận, tài khoản của anh/chị hiện đang quá hạn [X ngày], với số dư cần thanh toán là [số tiền] đồng.

**Bước 3 — Lắng nghe & Thăm dò**
Em muốn hiểu tình hình hiện tại của anh/chị — có lý do gì khiến anh/chị chưa thể thanh toán không ạ?
• Nếu KH khó khăn → chuyển sang phương án trả góp
• Nếu KH quên → nhắc nhẹ, hướng dẫn thanh toán ngay
• Nếu KH tranh chấp → ghi nhận, chuyển bộ phận xử lý

**Bước 4 — Đề xuất phương án**
*Trả toàn bộ:* Nếu anh/chị thanh toán trong ngày hôm nay, bên em miễn phí phạt trễ hạn.
*Trả một phần:* Anh/chị có thể trả trước [X%] hôm nay, phần còn lại cam kết ngày [Y].
*Gia hạn:* Em có thể xin cấp trên gia hạn đến [ngày], nhưng cần anh/chị xác nhận cam kết.

**Bước 5 — Ghi nhận kết quả (Disposition)**
• **PTP** → Hứa thanh toán: ghi ngày + số tiền cam kết
• **PTP_PARTIAL** → Hứa trả 1 phần: ghi ngày + số tiền trả + số còn lại
• **PAID** → Đã thanh toán: xác nhận, cảm ơn
• **REFUSED** → Từ chối: ghi lý do, chuyển Team Leader
• **DISPUTE** → Tranh chấp: ghi chi tiết, chuyển bộ phận giải quyết
• **HARDSHIP** → Khó khăn: ghi tình huống, đề xuất giảm/giãn nợ

**Bước 6 — Kết thúc**
*Nếu PTP:* Cảm ơn anh/chị. Em ghi nhận cam kết thanh toán [số tiền] vào ngày [ngày]. Em sẽ nhắc lại trước 1 ngày. Chúc anh/chị một ngày tốt.
*Nếu từ chối:* Dạ em ghi nhận. Em sẽ báo lại bộ phận quản lý để hỗ trợ phương án phù hợp. Cảm ơn anh/chị.

**Quy tắc nghiệp vụ:**
• Khung giờ gọi: 7:00 — 21:00
• Tối đa 5 cuộc/ngày/KH
• NO_ANSWER: tối đa 3 lần/ngày, cách nhau 2 giờ
• DISPUTE / DECEASED: KHÔNG được gọi tiếp
• BROKEN_PTP lần 2 → Team Leader review bắt buộc`,
    },
  ];

  for (const s of scripts) {
    const existing = await prisma.callScript.findFirst({ where: { name: s.name } });
    if (!existing) {
      await prisma.callScript.create({ data: s });
    }
  }

  // Seed default PBX cluster
  await prisma.pbxCluster.upsert({
    where: { id: '20000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '20000000-0000-0000-0000-000000000001',
      name: 'Cụm mặc định',
      description: 'Cụm PBX chính',
      eslHost: '10.10.101.189',
      eslPort: 8021,
      eslPassword: 'ClueCon',
      sipDomain: 'crm',
      sipWssUrl: '',
      pbxIp: '10.10.101.189',
      gatewayName: '368938db-bc9d-48ba-b9d3-e18bc3000623',
      recordingPath: '/var/lib/freeswitch/recordings/',
      recordingUrlPrefix: '',
      cdrReportUrl: '',
      isActive: true,
    },
  });
  console.log('Default PBX cluster seeded');

  console.log('Seed complete: 2 teams, 7 users, 20 disposition codes, 4 ticket categories, 60+ permissions (hierarchical), 5 call scripts');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
