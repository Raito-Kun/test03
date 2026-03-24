import prisma from '../lib/prisma';
import { PaginationParams, paginatedResponse } from '../lib/pagination';
import { emitToUser } from '../lib/socket-io';
import { NotificationType } from '@prisma/client';

const notifSelect = {
  id: true,
  type: true,
  title: true,
  message: true,
  referenceType: true,
  referenceId: true,
  isRead: true,
  readAt: true,
  createdAt: true,
};

export async function listNotifications(
  pagination: PaginationParams,
  userId: string,
  isRead?: boolean,
) {
  const where: Record<string, unknown> = { userId };
  if (isRead !== undefined) where.isRead = isRead;

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      select: notifSelect,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where }),
  ]);

  return paginatedResponse(notifications, total, pagination.page, pagination.limit);
}

export async function markAsRead(id: string, userId: string) {
  const notif = await prisma.notification.findFirst({ where: { id, userId } });
  if (!notif) throw Object.assign(new Error('Notification not found'), { code: 'NOT_FOUND' });

  return prisma.notification.update({
    where: { id },
    data: { isRead: true, readAt: new Date() },
    select: notifSelect,
  });
}

export async function markAllAsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}

/** Create a notification and push via Socket.IO */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message?: string,
  referenceType?: string,
  referenceId?: string,
) {
  const notif = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message: message || null,
      referenceType: referenceType || null,
      referenceId: referenceId || null,
    },
    select: notifSelect,
  });

  // Push realtime
  emitToUser(userId, 'notification:new', notif);

  return notif;
}
