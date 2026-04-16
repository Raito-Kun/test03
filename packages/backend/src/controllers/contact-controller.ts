import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { parsePagination } from '../lib/pagination';
import * as contactService from '../services/contact-service';

const createContactSchema = z.object({
  fullName: z.string().min(1).max(255),
  phone: z.string().min(1).max(20),
  phoneAlt: z.string().max(20).optional(),
  email: z.string().email().optional(),
  idNumber: z.string().max(20).optional(),
  address: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  source: z.string().max(100).optional(),
  tags: z.any().optional(),
  customFields: z.any().optional(),
  assignedTo: z.string().uuid().optional(),
  // Extended fields
  occupation: z.string().max(255).optional(),
  income: z.number().optional(),
  province: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  fullAddress: z.string().optional(),
  company: z.string().max(255).optional(),
  jobTitle: z.string().max(255).optional(),
  companyEmail: z.string().email().optional(),
  creditLimit: z.number().optional(),
  bankAccount: z.string().max(50).optional(),
  bankName: z.string().max(255).optional(),
  internalNotes: z.string().optional(),
});

const updateContactSchema = createContactSchema.partial();

/** GET /contacts */
export async function listContacts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pagination = parsePagination(req);
    const filters = {
      search: req.query.search as string | undefined,
      source: req.query.source as string | undefined,
      assignedTo: req.query.assigned_to as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    };
    const result = await contactService.listContacts(pagination, filters, req.dataScope || {}, req.user!.clusterId);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

/** POST /contacts */
export async function createContact(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createContactSchema.parse(req.body);
    const contact = await contactService.createContact(input, req.user!.userId, req, req.user!.clusterId);
    res.status(201).json({ success: true, data: contact });
  } catch (err) {
    next(err);
  }
}

/** GET /contacts/:id */
export async function getContact(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const contact = await contactService.getContactById(req.params.id as string, req.dataScope || {}, req.user!.clusterId);
    res.json({ success: true, data: contact });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'NOT_FOUND') {
      res.status(404).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    next(err);
  }
}

/** PATCH /contacts/:id */
export async function updateContact(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = updateContactSchema.parse(req.body);
    const contact = await contactService.updateContact(
      req.params.id as string,
      input,
      req.user!.userId,
      req.dataScope || {},
      req,
      req.user!.clusterId,
    );
    res.json({ success: true, data: contact });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'NOT_FOUND') {
      res.status(404).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    next(err);
  }
}

/** POST /contacts/bulk-delete  body: { ids: string[] } */
export async function bulkDeleteContacts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ids = (req.body?.ids ?? []) as unknown;
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((x) => typeof x === 'string')) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'ids must be a non-empty string[]' } });
      return;
    }
    const result = await contactService.bulkDeleteContacts(
      ids as string[],
      req.user!.userId,
      req.dataScope || {},
      req,
      req.user!.clusterId,
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/** DELETE /contacts/:id */
export async function deleteContact(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await contactService.deleteContact(req.params.id as string, req.user!.userId, req.dataScope || {}, req, req.user!.clusterId);
    res.json({ success: true, data: null });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'NOT_FOUND') {
      res.status(404).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    next(err);
  }
}

/** GET /contacts/:id/timeline */
export async function getTimeline(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const timeline = await contactService.getContactTimeline(req.params.id as string, req.dataScope || {}, req.user!.clusterId);
    res.json({ success: true, data: timeline });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'NOT_FOUND') {
      res.status(404).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    next(err);
  }
}
