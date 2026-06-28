import { z } from 'zod';

import type { AuthUserRole, AuthUserStatus } from '../../auth/runtime/auth-client';
import type { AdminUser } from './admin-client';

export const ADMIN_USER_ROLE_OPTIONS = [
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin' },
] as const;

export const ADMIN_USER_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'pending_password_reset', label: 'Pending password reset' },
  { value: 'disabled', label: 'Disabled' },
] as const;

export const adminUserFormSchema = z.object({
  email: z.string().email('Email non valida'),
  role: z.enum(['member', 'admin']),
  status: z.enum(['active', 'pending_password_reset', 'disabled']),
  password: z.string().optional(),
  monthlyQuota: z
    .string()
    .optional()
    .refine((value) => {
      if (!value || !value.trim()) return true;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0;
    }, 'La quota mensile deve essere un numero >= 0'),
  monthlyArtifactLimit: z
    .string()
    .optional()
    .refine((value) => {
      if (!value || !value.trim()) return true;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0;
    }, 'Il limite artefatti deve essere un numero >= 0'),
});

export type AdminUserFormValues = {
  email: string;
  role: AuthUserRole;
  status: AuthUserStatus;
  password: string;
  monthlyQuota: string;
  monthlyArtifactLimit: string;
};

export const createEmptyUserForm = (): AdminUserFormValues => ({
  email: '',
  role: 'member',
  status: 'active',
  password: '',
  monthlyQuota: '',
  monthlyArtifactLimit: '',
});

export const createEditUserForm = (user: AdminUser): AdminUserFormValues => ({
  email: user.email,
  role: user.role,
  status: user.status,
  password: '',
  monthlyQuota: typeof user.monthlyQuota === 'number' ? String(user.monthlyQuota) : '',
  monthlyArtifactLimit: typeof user.monthlyArtifactLimit === 'number' ? String(user.monthlyArtifactLimit) : '',
});

export const parseOptionalNumber = (value: string): number | undefined => {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};