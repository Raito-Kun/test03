import * as XLSX from 'xlsx';
import { ensureLeadingZero } from './contact-service';

/**
 * Shared parser used by both the legacy one-shot /contacts/import endpoint
 * and the new 3-step wizard endpoints. Pure parsing — no DB writes.
 */

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

export interface ContactImportRow {
  rowNumber: number;
  fullName: string;
  phone: string;
  phoneAlt?: string;
  email?: string;
  idNumber?: string;
  address?: string;
  province?: string;
  district?: string;
  occupation?: string;
  income?: number;
  company?: string;
  jobTitle?: string;
  companyEmail?: string;
  bankName?: string;
  bankAccount?: string;
  creditLimit?: number;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other';
  source?: string;
  tags?: string[];
  internalNotes?: string;
}

export interface ParseResult {
  rows: ContactImportRow[];
  errors: Array<{ row: number; error: string }>;
  totalRaw: number;
}

/** Canonicalize phone for both DB write and dedup lookup — must match
 *  the shape produced by the UI-create path (contact-service.ensureLeadingZero)
 *  so in-DB phones and imported phones compare equal. */
export function normalizePhone(raw: string): string {
  return ensureLeadingZero(raw) ?? '';
}

function parseDate(raw: string): Date | undefined {
  if (!raw) return undefined;
  const s = String(raw).trim();
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }
  const slash = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (slash) {
    const a = parseInt(slash[1], 10);
    const b = parseInt(slash[2], 10);
    const y = parseInt(slash[3], 10);
    if (a > 12) { const d = new Date(y, b - 1, a); if (!isNaN(d.getTime())) return d; }
    if (b > 12) { const d = new Date(y, a - 1, b); if (!isNaN(d.getTime())) return d; }
    const d = new Date(y, a - 1, b);
    if (!isNaN(d.getTime())) return d;
  }
  const num = Number(s);
  if (!isNaN(num) && num > 10000 && num < 100000) {
    const d = new Date((num - 25569) * 86400000);
    if (!isNaN(d.getTime())) return d;
  }
  return undefined;
}

/** Parse an uploaded CSV/XLSX buffer into validated contact rows. */
export function parseBuffer(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

  const out: ParseResult = { rows: [], errors: [], totalRaw: raw.length };

  for (let i = 0; i < raw.length; i++) {
    const rowNumber = i + 2;
    const mapped: Record<string, unknown> = {};
    for (const [viHeader, value] of Object.entries(raw[i])) {
      const stripped = viHeader.replace(/\s*\(.*?\)/g, '').trim();
      mapped[HEADER_MAP[stripped] || stripped] = value;
    }

    if (!mapped.fullName) { out.errors.push({ row: rowNumber, error: 'Họ tên không được để trống' }); continue; }
    if (!mapped.phone)    { out.errors.push({ row: rowNumber, error: 'Số điện thoại không được để trống' }); continue; }

    const phone = normalizePhone(String(mapped.phone));
    const phoneAlt = mapped.phoneAlt ? normalizePhone(String(mapped.phoneAlt)) : undefined;

    const dob = mapped.dateOfBirth ? parseDate(String(mapped.dateOfBirth)) : undefined;
    if (mapped.dateOfBirth && !dob) {
      out.errors.push({ row: rowNumber, error: `Ngày sinh sai định dạng: "${mapped.dateOfBirth}"` });
      continue;
    }

    const str = (k: string) => mapped[k] ? String(mapped[k]) : undefined;
    const dec = (k: string) => {
      if (!mapped[k]) return undefined;
      const v = parseFloat(String(mapped[k]).replace(/,/g, ''));
      return !isNaN(v) ? v : undefined;
    };

    out.rows.push({
      rowNumber,
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
      dateOfBirth: dob,
      gender: mapped.gender ? (GENDER_MAP[String(mapped.gender)] as 'male' | 'female' | 'other') : undefined,
      source: str('source') || 'import',
      tags: mapped.tags ? String(mapped.tags).split(',').map((t) => t.trim()).filter(Boolean) : [],
      internalNotes: str('internalNotes'),
    });
  }
  return out;
}
