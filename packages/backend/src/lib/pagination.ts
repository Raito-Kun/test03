import { Request } from 'express';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  orderBy: Record<string, 'asc' | 'desc'>;
}

/** Parse pagination query params from request */
export function parsePagination(req: Request): PaginationParams {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const sort = (req.query.sort as string) || 'created_at';
  const order = ((req.query.order as string) || 'desc') === 'asc' ? 'asc' : 'desc';

  // Allowlisted sort fields (snake_case → camelCase)
  const fieldMap: Record<string, string> = {
    created_at: 'createdAt',
    updated_at: 'updatedAt',
    full_name: 'fullName',
    start_time: 'startTime',
    name: 'name',
    email: 'email',
    score: 'score',
    status: 'status',
    dpd: 'dpd',
  };

  // Only allow known sort fields; default to createdAt
  const prismaField = fieldMap[sort] || (Object.values(fieldMap).includes(sort) ? sort : 'createdAt');

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    orderBy: { [prismaField]: order },
  };
}

/** Build paginated response */
export function paginatedResponse<T>(data: T[], total: number, page: number, limit: number) {
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
