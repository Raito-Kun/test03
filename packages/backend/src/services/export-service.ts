import ExcelJS from 'exceljs';
import { Response } from 'express';
import prisma from '../lib/prisma';
import { buildScopeWhere } from '../middleware/data-scope-middleware';

interface ExportColumn {
  header: string;
  key: string;
  width: number;
  transform?: (row: Record<string, unknown>) => string;
}

const ENTITY_CONFIGS: Record<string, {
  model: string;
  select: Record<string, unknown>;
  columns: ExportColumn[];
  buildWhere: (filters: Record<string, string>, scope: Record<string, unknown>) => Record<string, unknown>;
}> = {
  contacts: {
    model: 'contact',
    select: { id: true, fullName: true, phone: true, phoneAlt: true, email: true, address: true, source: true, gender: true, createdAt: true },
    columns: [
      { header: 'Họ tên', key: 'fullName', width: 25 },
      { header: 'SĐT', key: 'phone', width: 15 },
      { header: 'SĐT phụ', key: 'phoneAlt', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Địa chỉ', key: 'address', width: 30 },
      { header: 'Nguồn', key: 'source', width: 15 },
      { header: 'Ngày tạo', key: 'createdAt', width: 18, transform: (r) => fmtDate(r.createdAt) },
    ],
    buildWhere: (f, scope) => {
      const w: Record<string, unknown> = { ...buildScopeWhere(scope, 'createdBy', 'createdByUser') };
      if (f.search) w.OR = [{ fullName: { contains: f.search, mode: 'insensitive' } }, { phone: { contains: f.search } }];
      return w;
    },
  },
  leads: {
    model: 'lead',
    select: {
      id: true, status: true, score: true, notes: true, createdAt: true,
      contact: { select: { fullName: true, phone: true } },
      campaign: { select: { name: true } },
      assignedUser: { select: { fullName: true } },
    },
    columns: [
      { header: 'Khách hàng', key: 'contact', width: 25, transform: (r) => nested(r, 'contact', 'fullName') },
      { header: 'SĐT', key: 'phone', width: 15, transform: (r) => nested(r, 'contact', 'phone') },
      { header: 'Trạng thái', key: 'status', width: 15 },
      { header: 'Chiến dịch', key: 'campaign', width: 20, transform: (r) => nested(r, 'campaign', 'name') },
      { header: 'Nhân viên', key: 'assignedTo', width: 20, transform: (r) => nested(r, 'assignedUser', 'fullName') },
      { header: 'Điểm', key: 'score', width: 10 },
      { header: 'Ngày tạo', key: 'createdAt', width: 18, transform: (r) => fmtDate(r.createdAt) },
    ],
    buildWhere: (f, scope) => {
      const w: Record<string, unknown> = { ...buildScopeWhere(scope, 'assignedTo', 'assignedUser') };
      if (f.status) w.status = f.status;
      if (f.search) w.OR = [{ contact: { fullName: { contains: f.search, mode: 'insensitive' } } }, { contact: { phone: { contains: f.search } } }];
      return w;
    },
  },
  'call-logs': {
    model: 'callLog',
    select: {
      id: true, direction: true, callerNumber: true, destinationNumber: true,
      duration: true, billsec: true, hangupCause: true, sipCode: true, sipReason: true,
      startTime: true, endTime: true, notes: true,
      user: { select: { fullName: true } },
      contact: { select: { fullName: true, phone: true } },
    },
    columns: [
      { header: 'Hướng', key: 'direction', width: 10, transform: (r) => r.direction === 'inbound' ? 'Gọi vào' : 'Gọi ra' },
      { header: 'Số gọi', key: 'callerNumber', width: 15 },
      { header: 'Số nhận', key: 'destinationNumber', width: 15 },
      { header: 'Nhân viên', key: 'user', width: 20, transform: (r) => nested(r, 'user', 'fullName') },
      { header: 'Thời lượng (s)', key: 'duration', width: 14 },
      { header: 'Thời gian nói (s)', key: 'billsec', width: 16 },
      { header: 'Kết quả', key: 'hangupCause', width: 20 },
      { header: 'SIP Code', key: 'sipCode', width: 10 },
      { header: 'Phân loại', key: 'notes', width: 12 },
      { header: 'Thời gian bắt đầu', key: 'startTime', width: 20, transform: (r) => fmtDate(r.startTime) },
    ],
    buildWhere: (f, scope) => {
      const w: Record<string, unknown> = { ...buildScopeWhere(scope, 'userId', 'user') };
      if (f.direction) w.direction = f.direction;
      if (f.hangupCause) w.hangupCause = f.hangupCause;
      if (f.sipCode) w.sipCode = { contains: f.sipCode };
      if (f.dateFrom) w.startTime = { ...(w.startTime as object || {}), gte: new Date(f.dateFrom) };
      if (f.dateTo) w.startTime = { ...(w.startTime as object || {}), lte: new Date(f.dateTo) };
      if (f.search) w.OR = [{ callerNumber: { contains: f.search } }, { destinationNumber: { contains: f.search } }];
      return w;
    },
  },
  tickets: {
    model: 'ticket',
    select: {
      id: true, title: true, status: true, priority: true, createdAt: true,
      contact: { select: { fullName: true, phone: true } },
      user: { select: { fullName: true } },
      category: { select: { name: true } },
    },
    columns: [
      { header: 'Tiêu đề', key: 'title', width: 30 },
      { header: 'Trạng thái', key: 'status', width: 15 },
      { header: 'Mức độ', key: 'priority', width: 12 },
      { header: 'Khách hàng', key: 'contact', width: 25, transform: (r) => nested(r, 'contact', 'fullName') },
      { header: 'Nhân viên', key: 'user', width: 20, transform: (r) => nested(r, 'user', 'fullName') },
      { header: 'Danh mục', key: 'category', width: 15, transform: (r) => nested(r, 'category', 'name') },
      { header: 'Ngày tạo', key: 'createdAt', width: 18, transform: (r) => fmtDate(r.createdAt) },
    ],
    buildWhere: (f, scope) => {
      const w: Record<string, unknown> = { ...buildScopeWhere(scope, 'userId', 'user') };
      if (f.status) w.status = f.status;
      if (f.priority) w.priority = f.priority;
      if (f.search) w.OR = [{ title: { contains: f.search, mode: 'insensitive' } }];
      return w;
    },
  },
  campaigns: {
    model: 'campaign',
    select: { id: true, name: true, type: true, status: true, startDate: true, endDate: true, createdAt: true },
    columns: [
      { header: 'Tên chiến dịch', key: 'name', width: 30 },
      { header: 'Loại', key: 'type', width: 15 },
      { header: 'Trạng thái', key: 'status', width: 15 },
      { header: 'Ngày bắt đầu', key: 'startDate', width: 15, transform: (r) => fmtDate(r.startDate) },
      { header: 'Ngày kết thúc', key: 'endDate', width: 15, transform: (r) => fmtDate(r.endDate) },
      { header: 'Ngày tạo', key: 'createdAt', width: 18, transform: (r) => fmtDate(r.createdAt) },
    ],
    buildWhere: (f) => {
      const w: Record<string, unknown> = {};
      if (f.status) w.status = f.status;
      if (f.type) w.type = f.type;
      if (f.search) w.name = { contains: f.search, mode: 'insensitive' };
      return w;
    },
  },
  'debt-cases': {
    model: 'debtCase',
    select: {
      id: true, originalAmount: true, outstandingAmount: true, dpd: true, tier: true, status: true, createdAt: true,
      contact: { select: { fullName: true, phone: true } },
      assignedUser: { select: { fullName: true } },
    },
    columns: [
      { header: 'Khách hàng', key: 'contact', width: 25, transform: (r) => nested(r, 'contact', 'fullName') },
      { header: 'SĐT', key: 'phone', width: 15, transform: (r) => nested(r, 'contact', 'phone') },
      { header: 'Nợ gốc', key: 'originalAmount', width: 15 },
      { header: 'Nợ còn lại', key: 'outstandingAmount', width: 15 },
      { header: 'DPD', key: 'dpd', width: 8 },
      { header: 'Nhóm nợ', key: 'tier', width: 12 },
      { header: 'Trạng thái', key: 'status', width: 15 },
      { header: 'Nhân viên', key: 'assignedTo', width: 20, transform: (r) => nested(r, 'assignedUser', 'fullName') },
      { header: 'Ngày tạo', key: 'createdAt', width: 18, transform: (r) => fmtDate(r.createdAt) },
    ],
    buildWhere: (f, scope) => {
      const w: Record<string, unknown> = { ...buildScopeWhere(scope, 'assignedTo', 'assignedUser') };
      if (f.tier) w.tier = f.tier;
      if (f.status) w.status = f.status;
      if (f.search) w.OR = [{ contact: { fullName: { contains: f.search, mode: 'insensitive' } } }, { contact: { phone: { contains: f.search } } }];
      return w;
    },
  },
};

function fmtDate(v: unknown): string {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(String(v));
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function nested(row: Record<string, unknown>, rel: string, field: string): string {
  const obj = row[rel] as Record<string, unknown> | null;
  return obj ? String(obj[field] || '') : '';
}

/** Stream Excel file for given entity with filters */
export async function exportToExcel(
  entity: string,
  filters: Record<string, string>,
  dataScope: Record<string, unknown>,
  res: Response,
): Promise<void> {
  const config = ENTITY_CONFIGS[entity];
  if (!config) {
    res.status(400).json({ success: false, error: { code: 'INVALID_ENTITY', message: `Unknown entity: ${entity}` } });
    return;
  }

  const where = config.buildWhere(filters, dataScope);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await (prisma as any)[config.model].findMany({
    where,
    select: config.select,
    orderBy: { createdAt: 'desc' },
    take: 10000, // Safety limit
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(entity);

  // Header row
  sheet.columns = config.columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };

  // Data rows
  for (const row of rows) {
    const rowData: Record<string, unknown> = {};
    for (const col of config.columns) {
      rowData[col.key] = col.transform ? col.transform(row as Record<string, unknown>) : (row as Record<string, unknown>)[col.key] ?? '';
    }
    sheet.addRow(rowData);
  }

  // Stream response
  const fileName = `${entity}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  await workbook.xlsx.write(res);
  res.end();
}
