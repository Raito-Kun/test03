import * as XLSX from 'xlsx';
import prisma from '../lib/prisma';
import logger from '../lib/logger';

/** Vietnamese → English header mapping */
const HEADER_MAP: Record<string, string> = {
  'Họ tên': 'fullName',
  'Số điện thoại': 'phone',
  'Số ĐT phụ': 'phoneAlt',
  'Email': 'email',
  'CMND/CCCD': 'idNumber',
  'Địa chỉ': 'address',
  'Ngày sinh': 'dateOfBirth',
  'Giới tính': 'gender',
  'Nguồn': 'source',
  'Nhãn': 'tags',
  'Ghi chú': 'notes',
};

const GENDER_MAP: Record<string, string> = {
  'Nam': 'male', 'Nữ': 'female', 'Khác': 'other',
  'nam': 'male', 'nữ': 'female', 'khác': 'other',
};

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

/** Import contacts from Excel buffer */
export async function importContacts(
  buffer: Buffer,
  userId: string,
): Promise<ImportResult> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

  const result: ImportResult = { total: rows.length, success: 0, failed: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    try {
      const raw = rows[i];
      const mapped: Record<string, unknown> = {};

      // Map Vietnamese headers to English field names
      for (const [viHeader, value] of Object.entries(raw)) {
        const key = HEADER_MAP[viHeader] || viHeader;
        mapped[key] = value;
      }

      if (!mapped.fullName || !mapped.phone) {
        result.errors.push({ row: i + 2, error: 'Thiếu Họ tên hoặc Số điện thoại' });
        result.failed++;
        continue;
      }

      // Parse tags (comma-separated)
      const tags = mapped.tags
        ? String(mapped.tags).split(',').map((t) => t.trim()).filter(Boolean)
        : [];

      // Map gender
      const gender = mapped.gender ? GENDER_MAP[String(mapped.gender)] : undefined;

      await prisma.contact.create({
        data: {
          fullName: String(mapped.fullName),
          phone: String(mapped.phone),
          phoneAlt: mapped.phoneAlt ? String(mapped.phoneAlt) : undefined,
          email: mapped.email ? String(mapped.email) : undefined,
          idNumber: mapped.idNumber ? String(mapped.idNumber) : undefined,
          address: mapped.address ? String(mapped.address) : undefined,
          dateOfBirth: mapped.dateOfBirth ? new Date(String(mapped.dateOfBirth)) : undefined,
          gender: gender as 'male' | 'female' | 'other' | undefined,
          source: mapped.source ? String(mapped.source) : 'import',
          tags,
          createdBy: userId,
        },
      });
      result.success++;
    } catch (err) {
      result.errors.push({ row: i + 2, error: (err as Error).message });
      result.failed++;
    }
  }

  logger.info('Contact import complete', { total: result.total, success: result.success, failed: result.failed });
  return result;
}

/** Export contacts to Excel buffer */
export async function exportContacts(
  filters: { search?: string; source?: string },
): Promise<Buffer> {
  const contacts = await prisma.contact.findMany({
    where: {
      ...(filters.search && {
        OR: [
          { fullName: { contains: filters.search, mode: 'insensitive' } },
          { phone: { contains: filters.search } },
        ],
      }),
      ...(filters.source && { source: filters.source }),
    },
    orderBy: { createdAt: 'desc' },
    take: 10000,
  });

  // Map to Vietnamese headers
  const data = contacts.map((c) => ({
    'Họ tên': c.fullName,
    'Số điện thoại': c.phone,
    'Số ĐT phụ': c.phoneAlt || '',
    'Email': c.email || '',
    'CMND/CCCD': c.idNumber || '',
    'Địa chỉ': c.address || '',
    'Ngày sinh': c.dateOfBirth ? c.dateOfBirth.toISOString().split('T')[0] : '',
    'Giới tính': c.gender === 'male' ? 'Nam' : c.gender === 'female' ? 'Nữ' : c.gender === 'other' ? 'Khác' : '',
    'Nguồn': c.source || '',
    'Nhãn': Array.isArray(c.tags) ? (c.tags as string[]).join(', ') : '',
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh bạ');

  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}
