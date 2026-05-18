import type { IncomingMessage, ServerResponse } from 'node:http';

import type { AuthSessionPrincipal, AuthUserRole, AuthUserStatus } from '../../types/auth';

export const DEFAULT_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
export const MAX_BODY_SIZE_BYTES = 3 * 1024 * 1024;

export type AuthHttpErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'method_not_allowed'
  | 'not_found'
  | 'conflict'
  | 'service_unavailable'
  | 'internal';

export type AuthHttpSuccessBody = {
  ok: true;
  data: Record<string, unknown>;
};

export type AuthHttpErrorBody = {
  ok: false;
  error: {
    code: AuthHttpErrorCode;
    message: string;
  };
};

export type AuthHttpResponseBody = AuthHttpSuccessBody | AuthHttpErrorBody;

export type LoginRequestBody = {
  email?: unknown;
  password?: unknown;
};

export type AdminCreateUserRequestBody = {
  email?: unknown;
  role?: unknown;
  status?: unknown;
  monthlyQuota?: unknown;
  monthlyUsed?: unknown;
  password?: unknown;
};

export type AdminUpdateUserRequestBody = {
  email?: unknown;
  role?: unknown;
  status?: unknown;
  monthlyQuota?: unknown;
  monthlyUsed?: unknown;
  password?: unknown;
};

export type AdminCreateChangelogRequestBody = {
  title?: unknown;
  body?: unknown;
  status?: unknown;
};

export type CreateUserReportRequestBody = {
  category?: unknown;
  title?: unknown;
  description?: unknown;
};

export type AdminUpdateUserReportRequestBody = {
  status?: unknown;
};

export type AdminPublishUserReportIssueRequestBody = {
  owner?: unknown;
  repo?: unknown;
  title?: unknown;
  body?: unknown;
};

export const parseRequestUrl = (request: IncomingMessage): URL => {
  return new URL(request.url ?? '/', 'http://localhost');
};

export const parseOptionalNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const writeJson = (
  response: ServerResponse,
  statusCode: number,
  body: AuthHttpResponseBody,
): void => {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
};

export const writeSuccess = (
  response: ServerResponse,
  statusCode: number,
  data: Record<string, unknown>,
): void => {
  writeJson(response, statusCode, { ok: true, data });
};

export const writeError = (
  response: ServerResponse,
  statusCode: number,
  code: AuthHttpErrorCode,
  message: string,
): void => {
  writeJson(response, statusCode, {
    ok: false,
    error: { code, message },
  });
};

const readRequestBody = async (request: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  let totalSize = 0;

  await new Promise<void>((resolve, reject) => {
    request.on('data', (chunk: Buffer | string) => {
      const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalSize += chunkBuffer.length;
      if (totalSize > MAX_BODY_SIZE_BYTES) {
        reject(new Error('Request body too large'));
        return;
      }

      chunks.push(chunkBuffer);
    });
    request.on('end', () => resolve());
    request.on('error', reject);
  });

  return Buffer.concat(chunks).toString('utf8');
};

export const parseLoginBody = async (request: IncomingMessage): Promise<LoginRequestBody> => {
  const rawBody = await readRequestBody(request);
  if (rawBody.length === 0) {
    return {};
  }

  const parsed = JSON.parse(rawBody) as LoginRequestBody;
  return parsed;
};

export const parseJsonBody = async <T>(request: IncomingMessage): Promise<T> => {
  const rawBody = await readRequestBody(request);
  if (rawBody.length === 0) {
    return {} as T;
  }

  return JSON.parse(rawBody) as T;
};

const AUTH_USER_ROLE_SET = new Set<AuthUserRole>(['admin', 'member']);
const AUTH_USER_STATUS_SET = new Set<AuthUserStatus>(['active', 'disabled', 'pending_password_reset']);

export const parseAuthUserRole = (value: unknown): AuthUserRole | null => {
  if (typeof value !== 'string') {
    return null;
  }

  return AUTH_USER_ROLE_SET.has(value as AuthUserRole)
    ? (value as AuthUserRole)
    : null;
};

export const parseAuthUserStatus = (value: unknown): AuthUserStatus | null => {
  if (typeof value !== 'string') {
    return null;
  }

  return AUTH_USER_STATUS_SET.has(value as AuthUserStatus)
    ? (value as AuthUserStatus)
    : null;
};

export const isSessionPrincipalActive = (
  principal: AuthSessionPrincipal,
  now: Date,
): boolean => {
  if (principal.user.status !== 'active') {
    return false;
  }

  if (principal.session.revokedAt) {
    return false;
  }

  const expiresAt = Date.parse(principal.session.expiresAt);
  if (Number.isNaN(expiresAt)) {
    return false;
  }

  return expiresAt > now.getTime();
};

export const getClientIp = (request: IncomingMessage): string | null => {
  const forwardedFor = request.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0]?.trim() ?? null;
  }

  return request.socket.remoteAddress ?? null;
};

export const sessionToResponseData = (principal: AuthSessionPrincipal): Record<string, unknown> => {
  return {
    authenticated: true,
    user: {
      id: principal.user.id,
      email: principal.user.email,
      role: principal.user.role,
      status: principal.user.status,
    },
    session: {
      id: principal.session.id,
      authMethod: principal.session.authMethod,
      expiresAt: principal.session.expiresAt,
      lastSeenAt: principal.session.lastSeenAt,
    },
  };
};

export const userToResponseData = (user: {
  id: string;
  email: string;
  role: AuthUserRole;
  status: AuthUserStatus;
  monthlyQuota: number;
  monthlyUsed: number;
  disabledAt: string | null;
  createdByAdminUserId: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
}): Record<string, unknown> => {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    monthlyQuota: user.monthlyQuota,
    monthlyUsed: user.monthlyUsed,
    disabledAt: user.disabledAt,
    createdByAdminUserId: user.createdByAdminUserId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
    passwordChangedAt: user.passwordChangedAt,
  };
};
