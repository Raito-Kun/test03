import prisma from '../lib/prisma';
import logger from '../lib/logger';

interface DuplicateGroup {
  phone: string;
  count: number;
  contacts: { id: string; fullName: string; phone: string; email: string | null; createdAt: Date }[];
}

/** Find contacts with duplicate phone numbers */
export async function findDuplicates(): Promise<DuplicateGroup[]> {
  // Find phones that appear more than once
  const dupes = await prisma.$queryRaw<{ phone: string; count: bigint }[]>`
    SELECT phone, COUNT(*) as count FROM contacts
    WHERE phone IS NOT NULL AND phone != '' AND phone NOT LIKE 'MERGED_%'
    GROUP BY phone HAVING COUNT(*) > 1
    ORDER BY count DESC LIMIT 100
  `;

  const groups: DuplicateGroup[] = [];
  for (const d of dupes) {
    const contacts = await prisma.contact.findMany({
      where: { phone: d.phone },
      select: { id: true, fullName: true, phone: true, email: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    groups.push({ phone: d.phone, count: Number(d.count), contacts });
  }

  return groups;
}

interface MergeResult {
  survivingContactId: string;
  mergedCount: number;
  movedLeads: number;
  movedDebtCases: number;
  movedCallLogs: number;
  movedTickets: number;
}

/** Merge multiple contacts into one surviving contact */
export async function mergeContacts(keepId: string, mergeIds: string[]): Promise<MergeResult> {
  if (mergeIds.includes(keepId)) {
    throw new Error('Cannot merge contact into itself');
  }
  if (mergeIds.length === 0) {
    throw new Error('No contacts to merge');
  }

  const result = await prisma.$transaction(async (tx) => {
    // Move leads
    const leadsResult = await tx.lead.updateMany({
      where: { contactId: { in: mergeIds } },
      data: { contactId: keepId },
    });

    // Move debt cases
    const debtsResult = await tx.debtCase.updateMany({
      where: { contactId: { in: mergeIds } },
      data: { contactId: keepId },
    });

    // Move call logs
    const callsResult = await tx.callLog.updateMany({
      where: { contactId: { in: mergeIds } },
      data: { contactId: keepId },
    });

    // Move tickets
    const ticketsResult = await tx.ticket.updateMany({
      where: { contactId: { in: mergeIds } },
      data: { contactId: keepId },
    });

    // Copy non-null fields from merged contacts to surviving contact
    const surviving = await tx.contact.findUnique({ where: { id: keepId } });
    const merged = await tx.contact.findMany({ where: { id: { in: mergeIds } } });

    if (surviving) {
      const updates: Record<string, unknown> = {};
      for (const m of merged) {
        if (!surviving.phoneAlt && m.phoneAlt) updates.phoneAlt = m.phoneAlt;
        if (!surviving.email && m.email) updates.email = m.email;
        if (!surviving.address && m.address) updates.address = m.address;
        if (!surviving.idNumber && m.idNumber) updates.idNumber = m.idNumber;
        if (!surviving.dateOfBirth && m.dateOfBirth) updates.dateOfBirth = m.dateOfBirth;
      }
      if (Object.keys(updates).length > 0) {
        await tx.contact.update({ where: { id: keepId }, data: updates });
      }
    }

    // Soft-delete merged contacts by setting phone to merged indicator
    for (const mergeId of mergeIds) {
      await tx.contact.update({
        where: { id: mergeId },
        data: { phone: `MERGED_${mergeId.slice(0, 8)}`, phoneAlt: null },
      });
    }

    return {
      survivingContactId: keepId,
      mergedCount: mergeIds.length,
      movedLeads: leadsResult.count,
      movedDebtCases: debtsResult.count,
      movedCallLogs: callsResult.count,
      movedTickets: ticketsResult.count,
    };
  });

  logger.info('Contacts merged', result);
  return result;
}
