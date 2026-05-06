import type { IsoTimestamp } from './xstate';

export const AUTH_USER_ROLES = ['admin', 'member'] as const;
export type AuthUserRole = (typeof AUTH_USER_ROLES)[number];

export const AUTH_USER_STATUSES = ['active', 'disabled', 'pending_password_reset'] as const;
export type AuthUserStatus = (typeof AUTH_USER_STATUSES)[number];

export const AUTH_METHODS = ['native', 'google'] as const;
export type AuthMethod = (typeof AUTH_METHODS)[number];

export const OAUTH_PROVIDERS = ['google'] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export interface AuthUserRecord {
  id: string;
  email: string;
  role: AuthUserRole;
  status: AuthUserStatus;
  monthlyQuota: number;
  monthlyUsed: number;
  passwordHash: string | null;
  passwordAlgo: string | null;
  passwordChangedAt: IsoTimestamp | null;
  lastLoginAt: IsoTimestamp | null;
  disabledAt: IsoTimestamp | null;
  createdByAdminUserId: string | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface AuthSessionRecord {
  id: string;
  userId: string;
  sessionTokenHash: string;
  authMethod: AuthMethod;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: IsoTimestamp;
  revokedAt: IsoTimestamp | null;
  lastSeenAt: IsoTimestamp;
  createdAt: IsoTimestamp;
}

export interface AuthSessionPrincipal {
  session: AuthSessionRecord;
  user: Pick<AuthUserRecord, 'id' | 'email' | 'role' | 'status'>;
}

export interface OAuthAccountRecord {
  id: number;
  userId: string;
  provider: OAuthProvider;
  providerSubject: string;
  emailAtProvider: string | null;
  profileJson: Record<string, unknown>;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface OAuthStateTokenRecord {
  state: string;
  provider: OAuthProvider;
  codeVerifier: string;
  redirectUri: string;
  requestedByIp: string | null;
  expiresAt: IsoTimestamp;
  consumedAt: IsoTimestamp | null;
  createdAt: IsoTimestamp;
}

export interface AuthUserListFilters {
  status?: AuthUserStatus;
  query?: string;
}

export interface CreateAuthUserInput {
  id: string;
  email: string;
  role: AuthUserRole;
  status: AuthUserStatus;
  monthlyQuota?: number;
  monthlyUsed?: number;
  passwordHash?: string | null;
  passwordAlgo?: string | null;
  passwordChangedAt?: Date;
  disabledAt?: Date | null;
  createdByAdminUserId?: string | null;
}

export interface UpdateAuthUserInput {
  email?: string;
  role?: AuthUserRole;
  status?: AuthUserStatus;
  monthlyQuota?: number;
  monthlyUsed?: number;
  disabledAt?: Date | null;
}

export interface SetAuthUserPasswordInput {
  passwordHash: string;
  passwordAlgo: string;
  passwordChangedAt?: Date;
  nextStatus?: AuthUserStatus;
}

export interface CreateAuthSessionInput {
  id: string;
  userId: string;
  sessionTokenHash: string;
  authMethod: AuthMethod;
  expiresAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface RevokeAuthSessionsInput {
  userId: string;
  authMethod?: AuthMethod;
  revokedAt?: Date;
}

export interface LinkOAuthAccountInput {
  userId: string;
  provider: OAuthProvider;
  providerSubject: string;
  emailAtProvider?: string | null;
  profileJson?: Record<string, unknown>;
}

export interface CreateOAuthStateTokenInput {
  state: string;
  provider: OAuthProvider;
  codeVerifier: string;
  redirectUri: string;
  expiresAt: Date;
  requestedByIp?: string | null;
}