export const USER_ROLES = {
  admin: 'admin',
  user: 'user',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const isUserAdmin = (role: string): boolean => role === USER_ROLES.admin;
