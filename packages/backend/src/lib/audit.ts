import { Request } from 'express';
import prisma from './prisma';
import { AuditAction } from '@prisma/client';

/**
 * Log an audit event. Fire-and-forget (don't block the request).
 */
export function logAudit(
  userId: string | null,
  action: AuditAction,
  entityType: string,
  entityId: string | null,
  changes: Record<string, unknown> | null,
  req?: Request,
): void {
  prisma.auditLog
    .create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        changes: changes ? JSON.parse(JSON.stringify(changes)) : undefined,
        ipAddress: req?.ip || null,
        userAgent: req?.get('user-agent') || null,
      },
    })
    .catch(() => {
      // Audit logging should never break the main flow
    });
}
