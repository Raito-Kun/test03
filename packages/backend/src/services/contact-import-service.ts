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
  'Địa chỉ đầy đủ': 'fullAddress',
  'Ngày sinh': 'dateOfBirth',
  'Giới tính': 'gender',
  'Nghề nghiệp': 'occupation',
  'Thu nhập': 'income',
  'Tỉnh/Thành': 'province',
  'Quận/Huyện': 'district',
  'Công ty': 'company',
  'Chức vụ': 'jobTitle',
  'Email công ty': 'companyEmail',
  'Ngân hàng': 'bankName',
  'Số tài khoản': 'bankAccount',
  'Hạn mức': 'creditLimit',
  'Nguồn': 'source',
  'Nhãn': 'tags',
  'Ghi chú': 'notes',
  'Ghi chú nội bộ': 'internalNotes',
};

const GENDER_MAP: Record<string, string> = {
  'Nam': 'male', 'Nữ': 'female', 'Khác': 'other',
  'nam': 'male', 'nữ': 'female', 'khác': 'other',
};

interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; error: string }>;
}

/** Normalize Vietnamese phone: 9 digits without leading 0 → add "0" prefix */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 9 && /^[3-9]/.test(digits)) return '0' + digits;
  return digits;
}

/** Parse date from multiple formats: YYYY-MM-DD, M/D/YYYY, D/M/YYYY, DD/MM/YYYY */
function parseDate(raw: string): Date | undefined {
  if (!raw) return undefined;
  const s = String(raw).trim();

  // YYYY-MM-DD (ISO)
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }

  // Slash formats: M/D/YYYY or D/M/YYYY or DD/MM/YYYY
  const slashMatch = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (slashMatch) {
    const a = parseInt(slashMatch[1], 10);
    const b = parseInt(slashMatch[2], 10);
    const year = parseInt(slashMatch[3], 10);

    // If a > 12, it must be day (D/M/YYYY)
    if (a > 12) {
      const d = new Date(year, b - 1, a);
      if (!isNaN(d.getTime())) return d;
    }
    // If b > 12, it must be month (M/D/YYYY)
    if (b > 12) {
      const d = new Date(year, a - 1, b);
      if (!isNaN(d.getTime())) return d;
    }
    // Ambiguous (both ≤12): assume M/D/YYYY (US format, common in Excel)
    const d = new Date(year, a - 1, b);
    if (!isNaN(d.getTime())) return d;
  }

  // Excel serial number (e.g. 34000 = date)
  const num = Number(s);
  if (!isNaN(num) && num > 10000 && num < 100000) {
    const d = new Date((num - 25569) * 86400000);
    if (!isNaN(d.getTime())) return d;
  }

  return undefined;
}

/** Import contacts from Excel buffer */
export async function importContacts(
  buffer: Buffer,
  userId: string,
): Promise<ImportResult> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

  const result: ImportResult = { imported: 0, updated: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    try {
      const raw = rows[i];
      const mapped: Record<string, unknown> = {};

      // Map Vietnamese headers to English field names; also strip (*required) markers
      for (const [viHeader, value] of Object.entries(raw)) {
        const stripped = viHeader.replace(/\s*\(.*?\)/g, '').trim();
        const key = HEADER_MAP[stripped] || stripped;
        mapped[key] = value;
      }

      // Validate required fields with specific messages
      if (!mapped.fullName) {
        result.errors.push({ row: i + 2, error: 'Họ tên không được để trống' });
        result.skipped++;
        continue;
      }
      if (!mapped.phone) {
        result.errors.push({ row: i + 2, error: 'Số điện thoại không được để trống' });
        result.skipped++;
        continue;
      }

      // Normalize phone numbers (auto-add leading 0 for 9-digit VN numbers)
      const phone = normalizePhone(String(mapped.phone));
      const phoneAlt = mapped.phoneAlt ? normalizePhone(String(mapped.phoneAlt)) : undefined;

      // Parse date with multi-format support
      const dateOfBirth = mapped.dateOfBirth ? parseDate(String(mapped.dateOfBirth)) : undefined;
      if (mapped.dateOfBirth && !dateOfBirth) {
        result.errors.push({ row: i + 2, error: `Ngày sinh sai định dạng: "${mapped.dateOfBirth}" (dùng YYYY-MM-DD hoặc D/M/YYYY)` });
        result.skipped++;
        continue;
      }

      // Parse tags (comma-separated)
      const tags = mapped.tags
        ? String(mapped.tags).split(',').map((t) => t.trim()).filter(Boolean)
        : [];

      // Map gender
      const gender = mapped.gender ? GENDER_MAP[String(mapped.gender)] : undefined;

      // Build optional string/decimal helpers
      const str = (key: string) => mapped[key] ? String(mapped[key]) : undefined;
      const dec = (key: string) => {
        if (!mapped[key]) return undefined;
        const v = parseFloat(String(mapped[key]).replace(/,/g, ''));
        return !isNaN(v) ? v : undefined;
      };

      const contactData = {
        fullName: String(mapped.fullName),
        phone,
        phoneAlt,
        email: str('email'),
        idNumber: str('idNumber'),
        address: str('fullAddress') || str('address'),
        province: str('province'),
        district: str('district'),
        occupation: str('occupation'),
        income: dec('income'),
        company: str('company'),
        jobTitle: str('jobTitle'),
        companyEmail: str('companyEmail'),
        bankName: str('bankName'),
        bankAccount: str('bankAccount'),
        creditLimit: dec('creditLimit'),
        dateOfBirth,
        gender: gender as 'male' | 'female' | 'other' | undefined,
        source: str('source') || 'import',
        tags,
        internalNotes: str('internalNotes'),
      };

      // Upsert: if phone exists → update, else → create
      const existing = await prisma.contact.findFirst({ where: { phone }, select: { id: true } });
      if (existing) {
        await prisma.contact.update({ where: { id: existing.id }, data: contactData });
        result.updated++;
      } else {
        await prisma.contact.create({ data: { ...contactData, createdBy: userId } });
        result.imported++;
      }
    } catch (err) {
      const msg = (err as Error).message;
      // Make Prisma unique constraint errors human-readable
      if (msg.includes('Unique constraint')) {
        result.errors.push({ row: i + 2, error: `Dữ liệu trùng lặp (dòng ${i + 2})` });
      } else {
        result.errors.push({ row: i + 2, error: msg.slice(0, 200) });
      }
      result.skipped++;
    }
  }

  logger.info('Contact import complete', { imported: result.imported, updated: result.updated, skipped: result.skipped });
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
