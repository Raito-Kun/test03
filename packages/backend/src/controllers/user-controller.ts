import { Request, Response, NextFunction } from 'express';
import { createUserSchema, updateUserSchema } from '@crm/shared/src/validation/auth-schemas';
import { parsePagination } from '../lib/pagination';
import * as userService from '../services/user-service';
import prisma from '../lib/prisma';

/** Check if current user can modify target user (admin cannot modify super_admin) */
async function canModifyUser(req: Request, res: Response, targetUserId: string): Promise<boolean> {
  if (req.user?.role === 'super_admin') return true;
  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { role: true, clusterId: true } });
  if (!target) return true; // let the service layer handle NOT_FOUND
  if (target.role === 'super_admin') {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Không thể chỉnh sửa tài khoản Super Admin' } });
    return false;
  }
  // admin can only modify users in their own cluster
  if (req.user?.role !== 'super_admin' && req.user?.clusterId && target.clusterId !== req.user.clusterId) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Bạn chỉ có thể chỉnh sửa tài khoản trong cụm của mình' } });
    return false;
  }
  return true;
}

/** GET /users */
export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pagination = parsePagination(req);
    const filters = {
      role: req.query.role as string | undefined,
      teamId: req.query.team_id as string | undefined,
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
    };

    const result = await userService.listUsers(pagination, filters, req.user!.clusterId, req.user!.role);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

/** POST /users */
export async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createUserSchema.parse(req.body);
    const user = await userService.createUser(input, req.user!.clusterId);
    res.status(201).json({ success: true, data: user });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'EMAIL_EXISTS') {
      res.status(409).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    next(err);
  }
}

/** GET /users/:id */
export async function getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await userService.getUserById(req.params.id as string);
    res.json({ success: true, data: user });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'NOT_FOUND') {
      res.status(404).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    next(err);
  }
}

/** PATCH /users/:id */
export async function updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = updateUserSchema.parse(req.body);
    const user = await userService.updateUser(req.params.id as string, input);
    res.json({ success: true, data: user });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'NOT_FOUND') {
      res.status(404).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    if (error.code === 'EMAIL_TAKEN') {
      res.status(409).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    next(err);
  }
}

/** DELETE /users/:id */
export async function deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await userService.deactivateUser(req.params.id as string);
    res.json({ success: true, data: user });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'NOT_FOUND') {
      res.status(404).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    next(err);
  }
}

/** GET /clusters/:id/accounts */
export async function listClusterAccounts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const requestedClusterId = req.params.id as string;
    // Non-super_admin can only view accounts in their own cluster
    if (req.user?.role !== 'super_admin' && req.user?.clusterId && req.user.clusterId !== requestedClusterId) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Bạn chỉ có thể xem tài khoản trong cụm của mình' } });
      return;
    }
    const users = await userService.listClusterUsers(requestedClusterId, req.user?.role);
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
}

/** POST /clusters/:id/accounts */
export async function createClusterAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, fullName, role, extension } = req.body;
    if (!email || !password || !fullName || !role) {
      res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'email, password, fullName, role là bắt buộc' } });
      return;
    }
    // Only super_admin can create super_admin accounts
    if (role === 'super_admin' && req.user?.role !== 'super_admin') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Chỉ Super Admin mới có thể tạo tài khoản Super Admin' } });
      return;
    }
    // Non-super_admin can only create in their own cluster
    if (req.user?.role !== 'super_admin' && req.user?.clusterId && req.user.clusterId !== req.params.id) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Bạn chỉ có thể tạo tài khoản trong cụm của mình' } });
      return;
    }
    const user = await userService.createClusterUser({
      email, password, fullName, role, extension: extension || null,
      clusterId: req.params.id as string,
    });
    res.status(201).json({ success: true, data: user });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'EMAIL_EXISTS') {
      res.status(409).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    next(err);
  }
}

/** POST /clusters/:id/accounts/import-csv */
export async function importClusterAccountsCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'rows phải là mảng không rỗng' } });
      return;
    }
    const result = await userService.importClusterUsersFromCsv(rows, req.params.id as string);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/** POST /clusters/:id/accounts/:userId/change-password */
export async function changeClusterAccountPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!await canModifyUser(req, res, req.params.userId as string)) return;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Mật khẩu phải ít nhất 6 ký tự' } });
      return;
    }
    const user = await userService.changeUserPassword(req.params.userId as string, newPassword);
    res.json({ success: true, data: user });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'NOT_FOUND') {
      res.status(404).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    next(err);
  }
}

/** DELETE /clusters/:id/accounts/:userId */
export async function deleteClusterAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!await canModifyUser(req, res, req.params.userId as string)) return;
    await userService.deleteUser(req.params.userId as string);
    res.json({ success: true, message: 'Đã xóa tài khoản' });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'NOT_FOUND') {
      res.status(404).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    if (error.code === 'USER_HAS_REFERENCES') {
      res.status(409).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    next(err);
  }
}

/** PATCH /clusters/:id/accounts/:userId/status */
export async function toggleClusterAccountStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!await canModifyUser(req, res, req.params.userId as string)) return;
    const { status } = req.body;
    if (!status || !['active', 'inactive'].includes(status)) {
      res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'status phải là active hoặc inactive' } });
      return;
    }
    const user = await userService.updateUser(req.params.userId as string, { status });
    res.json({ success: true, data: user });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'NOT_FOUND') {
      res.status(404).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    next(err);
  }
}
