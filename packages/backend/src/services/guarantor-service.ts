import prisma from '../lib/prisma';
import logger from '../lib/logger';
import { RelationshipType } from '@prisma/client';

export interface GuarantorInput {
  debtCaseId: string;
  fullName: string;
  relationship: string;
  phone?: string;
  address?: string;
}

export interface Guarantor {
  id: string;
  relatedContactId: string;
  fullName: string;
  relationship: string;
  phone: string;
  address?: string;
}

/**
 * List all guarantors for a debt case.
 * Guarantors are stored as ContactRelationship records with type=guarantor
 * linked via the debt case's contactId.
 */
export async function listGuarantors(debtCaseId?: string): Promise<Guarantor[]> {
  try {
    if (!debtCaseId) return [];

    const debtCase = await prisma.debtCase.findUniqueOrThrow({
      where: { id: debtCaseId },
      select: { contactId: true },
    });

    const relationships = await prisma.contactRelationship.findMany({
      where: {
        contactId: debtCase.contactId,
        relationshipType: RelationshipType.guarantor,
      },
      include: {
        relatedContact: {
          select: { id: true, fullName: true, phone: true, address: true },
        },
      },
    });

    return relationships.map((r) => ({
      id: r.id,
      relatedContactId: r.relatedContact.id,
      fullName: r.relatedContact.fullName,
      relationship: r.notes ?? r.relationshipType,
      phone: r.relatedContact.phone,
      address: r.relatedContact.address ?? undefined,
    }));
  } catch (error) {
    logger.error('listGuarantors failed', { debtCaseId, error });
    throw error;
  }
}

/**
 * Add a guarantor to a debt case.
 * Creates a new Contact for the guarantor and links it via ContactRelationship.
 */
export async function addGuarantor(input: GuarantorInput): Promise<Guarantor> {
  try {
    const debtCase = await prisma.debtCase.findUniqueOrThrow({
      where: { id: input.debtCaseId },
      select: { contactId: true },
    });

    const guarantorContact = await prisma.contact.create({
      data: {
        fullName: input.fullName,
        phone: input.phone ?? '',
        address: input.address,
      },
    });

    const relationship = await prisma.contactRelationship.create({
      data: {
        contactId: debtCase.contactId,
        relatedContactId: guarantorContact.id,
        relationshipType: RelationshipType.guarantor,
        notes: input.relationship,
      },
    });

    logger.info('addGuarantor created', { debtCaseId: input.debtCaseId, relationshipId: relationship.id });

    return {
      id: relationship.id,
      relatedContactId: guarantorContact.id,
      fullName: guarantorContact.fullName,
      relationship: input.relationship,
      phone: guarantorContact.phone,
      address: guarantorContact.address ?? undefined,
    };
  } catch (error) {
    logger.error('addGuarantor failed', { debtCaseId: input.debtCaseId, error });
    throw error;
  }
}

/**
 * Remove a guarantor relationship by ContactRelationship id.
 * Does not delete the Contact record itself (may be referenced elsewhere).
 */
export async function removeGuarantor(guarantorId: string, debtCaseId?: string | string[]): Promise<void> {
  const resolvedDebtCaseId: string | undefined = Array.isArray(debtCaseId) ? debtCaseId[0] : debtCaseId;
  try {
    const where: Record<string, unknown> = { id: guarantorId, relationshipType: RelationshipType.guarantor };

    if (resolvedDebtCaseId) {
      const debtCase = await prisma.debtCase.findUniqueOrThrow({
        where: { id: resolvedDebtCaseId },
        select: { contactId: true },
      });
      where.contactId = debtCase.contactId;
    }

    await prisma.contactRelationship.deleteMany({ where });

    logger.info('removeGuarantor deleted', { guarantorId, debtCaseId: resolvedDebtCaseId });
  } catch (error) {
    logger.error('removeGuarantor failed', { guarantorId, error });
    throw error;
  }
}
