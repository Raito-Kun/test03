import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const refreshTokenSchema = z.object({
  // Refresh token comes from httpOnly cookie, not body
});

export const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(1, 'Full name is required').max(255),
  role: z.enum(['admin', 'manager', 'qa', 'leader', 'agent_telesale', 'agent_collection']),
  teamId: z.string().uuid().optional(),
  sipExtension: z.string().max(10).optional(),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(1).max(255).optional(),
  role: z.enum(['admin', 'manager', 'qa', 'leader', 'agent_telesale', 'agent_collection']).optional(),
  teamId: z.string().uuid().nullable().optional(),
  sipExtension: z.string().max(10).nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
