import prisma from '../lib/prisma';
import { PaginationParams, paginatedResponse } from '../lib/pagination';
import { logAudit } from '../lib/audit';
import { Request } from 'express';

const ticketSelect = {
  id: true,
  contactId: true,
  callLogId: true,
  categoryId: true,
  subject: true,
  content: true,
  resultCode: true,
  status: true,
  priority: true,
  createdAt: true,
  updatedAt: true,
  contact: { select: { id: true, fullName: true, phone: true } },
  user: { select: { id: true, fullName: true } },
  category: { select: { id: true, name: true } },
};

interface CreateTicketInput {
  contactId: string;
  callLogId?: string;
  categoryId?: string;
  subject: string;
  content?: string;
  resultCode?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

export async function createTicket(input: CreateTicketInput, userId: string, req?: Request) {
  const ticket = await prisma.ticket.create({
    data: {
      contactId: input.contactId,
      callLogId: input.callLogId || null,
      userId,
      categoryId: input.categoryId || null,
      subject: input.subject,
      content: input.content || null,
      resultCode: input.resultCode || null,
      priority: input.priority || 'medium',
    },
    select: ticketSelect,
  });

  logAudit(userId, 'create', 'tickets', ticket.id, { new: input }, req);
  return ticket;
}

export async function getTicketById(id: string, userId: string, role: string) {
  const where: Record<string, unknown> = { id };

  // Agents can only see their own tickets
  if (role === 'agent_telesale' || role === 'agent_collection') {
    where.userId = userId;
  }

  const ticket = await prisma.ticket.findFirst({ where, select: ticketSelect });
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { code: 'NOT_FOUND' });
  return ticket;
}

interface UpdateTicketInput {
  categoryId?: string;
  subject?: string;
  content?: string;
  resultCode?: string;
  status?: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

export async function updateTicket(
  id: string,
  input: UpdateTicketInput,
  userId: string,
  role: string,
  req?: Request,
) {
  await getTicketById(id, userId, role);

  const ticket = await prisma.ticket.update({
    where: { id },
    data: {
      ...(input.categoryId !== undefined && { categoryId: input.categoryId || null }),
      ...(input.subject && { subject: input.subject }),
      ...(input.content !== undefined && { content: input.content || null }),
      ...(input.resultCode !== undefined && { resultCode: input.resultCode || null }),
      ...(input.status && { status: input.status }),
      ...(input.priority && { priority: input.priority }),
    },
    select: ticketSelect,
  });

  logAudit(userId, 'update', 'tickets', id, { changes: input }, req);
  return ticket;
}

export async function deleteTicket(id: string, userId: string, role: string, req?: Request) {
  await getTicketById(id, userId, role);
  await prisma.ticket.delete({ where: { id } });
  logAudit(userId, 'delete', 'tickets', id, null, req);
}

export async function listTickets(
  pagination: PaginationParams,
  userId: string,
  role: string,
  filters: { contactId?: string; status?: string; priority?: string },
) {
  const where: Record<string, unknown> = {};

  if (role === 'agent_telesale' || role === 'agent_collection') {
    where.userId = userId;
  }

  if (filters.contactId) where.contactId = filters.contactId;
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      select: ticketSelect,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: pagination.orderBy,
    }),
    prisma.ticket.count({ where }),
  ]);

  return paginatedResponse(tickets, total, pagination.page, pagination.limit);
}

export async function listContactTickets(contactId: string, pagination: PaginationParams) {
  const where = { contactId };

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      select: ticketSelect,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.ticket.count({ where }),
  ]);

  return paginatedResponse(tickets, total, pagination.page, pagination.limit);
}
