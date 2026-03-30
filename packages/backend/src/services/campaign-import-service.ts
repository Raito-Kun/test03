import * as XLSX from 'xlsx';
import prisma from '../lib/prisma';
import logger from '../lib/logger';

interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; error: string }>;
}

const VALID_TYPES = ['telesale', 'collection'];

/** Import campaigns from CSV/XLSX buffer */
export async function importCampaigns(buffer: Buffer, userId: string): Promise<ImportResult> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    // Normalize header keys (strip markers like " (*required)")
    const data: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      const clean = k.replace(/\s*\(.*?\)/g, '').trim();
      data[clean] = String(v ?? '').trim();
    }

    const name = data['name'];
    const type = data['type']?.toLowerCase();

    if (!name) {
      result.errors.push({ row: rowNum, error: 'Thiếu tên chiến dịch (name)' });
      result.skipped++;
      continue;
    }

    if (!VALID_TYPES.includes(type)) {
      result.errors.push({ row: rowNum, error: `Loại chiến dịch không hợp lệ: "${type}". Phải là telesale hoặc collection` });
      result.skipped++;
      continue;
    }

    try {
      const startDate = data['startDate'] ? new Date(data['startDate']) : undefined;
      const endDate = data['endDate'] ? new Date(data['endDate']) : undefined;

      await prisma.campaign.create({
        data: {
          name,
          type: type as any,
          startDate: startDate && !isNaN(startDate.getTime()) ? startDate : undefined,
          endDate: endDate && !isNaN(endDate.getTime()) ? endDate : undefined,
          script: data['description'] || undefined,
          createdBy: userId,
        },
      });
      result.imported++;
    } catch (err) {
      result.errors.push({ row: rowNum, error: (err as Error).message });
      result.skipped++;
    }
  }

  logger.info('Campaign import complete', result);
  return result;
}
