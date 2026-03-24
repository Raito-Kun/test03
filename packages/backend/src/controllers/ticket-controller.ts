import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { parsePagination } from '../lib/pagination';
import * as ticketService from '../services/ticket-service';

const createSchema = z.object({
  contactId: z.string().uuid(),
  callLogId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  subject: z.string().min(1).max(500),
  content: z.string().optional(),
  resultCode: z.string().max(100).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
});

const updateSchema = z.object({
  categoryId: z.string().uuid().optional(),
  subject: z.string().min(1).max(500).optional(),
  content: z.string().optional(),
  resultCode: z.string().max(100).optional(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
});

function handleErrors(err: unknown, res: Response, next: NextFunction): void {
  const error = err as Error & { code?: string };
  if (error.code === 'NOT_FOUND') {
    res.status(404).json({ success: false, error: { code: error.code, message: error.message } });
    return;
  }
  next(err);
}

/** GET /tickets */
export async function listTickets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pagination = parsePagination(req);
    const filters = {
      contactId: req.query.contact_id as string | undefined,
      status: req.query.status as string | undefined,
      priority: req.query.priority as string | undefined,
    };
    const result = await ticketService.listTickets(
      pagination,
      req.user!.userId,
      req.user!.role,
      filters,
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

/** POST /tickets */
export async function createTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createSchema.parse(req.body);
    const ticket = await ticketService.createTicket(input, req.user!.userId, req);
    res.status(201).json({ success: true, data: ticket });
  } catch (err) {
    next(err);
  }
}

/** GET /tickets/:id */
export async function getTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ticket = await ticketService.getTicketById(req.params.id as string, req.user!.userId, req.user!.role);
    res.json({ success: true, data: ticket });
  } catch (err) {
    handleErrors(err, res, next);
  }
}

/** PATCH /tickets/:id */
export async function updateTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = updateSchema.parse(req.body);
    const ticket = await ticketService.updateTicket(
      req.params.id as string,
      input,
      req.user!.userId,
      req.user!.role,
      req,
    );
    res.json({ success: true, data: ticket });
  } catch (err) {
    handleErrors(err, res, next);
  }
}

/** DELETE /tickets/:id */
export async function deleteTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await ticketService.deleteTicket(req.params.id as string, req.user!.userId, req.user!.role, req);
    res.json({ success: true, data: null });
  } catch (err) {
    handleErrors(err, res, next);
  }
}

/** GET /contacts/:id/tickets */
export async function listContactTickets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pagination = parsePagination(req);
    const result = await ticketService.listContactTickets(req.params.id as string, pagination);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}
