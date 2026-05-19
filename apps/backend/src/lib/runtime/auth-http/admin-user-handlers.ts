import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

import { type AuthRepositoryBundle } from '../../adapters';
import type { AuthSessionPrincipal, AuthUserRole, AuthUserStatus, UpdateAuthUserInput } from '../../types/auth';
import type { PasswordHashRuntime } from '../auth-contract';
import type {
  AdminCreateUserRequestBody,
  AdminUpdateUserRequestBody,
  AuthHttpWriteErrorFn,
  AuthHttpWriteSuccessFn,
} from './support';

export type CreateAdminUserHandlersDependencies = {
  repositories: Pick<AuthRepositoryBundle, 'users' | 'sessions'>;
  passwordHashing: PasswordHashRuntime;
  now: () => Date;
  requireAdminPrincipal: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => Promise<AuthSessionPrincipal | null>;
  parseJsonBody: <T>(request: IncomingMessage) => Promise<T>;
  parseRequestUrl: (request: IncomingMessage) => URL;
  parseAuthUserRole: (value: unknown) => AuthUserRole | null;
  parseAuthUserStatus: (value: unknown) => AuthUserStatus | null;
  userToResponseData: (user: Awaited<ReturnType<AuthRepositoryBundle['users']['findUserById']>> extends infer U ? (U extends null ? never : U) : never) => Record<string, unknown>;
  writeError: AuthHttpWriteErrorFn;
  writeSuccess: AuthHttpWriteSuccessFn;
};

export type AdminUserHandlers = {
  handleAdminListUsers(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleAdminCreateUser(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleAdminGetUser(request: IncomingMessage, response: ServerResponse, userId: string): Promise<void>;
  handleAdminUpdateUser(request: IncomingMessage, response: ServerResponse, userId: string): Promise<void>;
  handleAdminDeleteUser(request: IncomingMessage, response: ServerResponse, userId: string): Promise<void>;
};

export const createAdminUserHandlers = (
  deps: CreateAdminUserHandlersDependencies,
): AdminUserHandlers => {
  const {
    repositories,
    passwordHashing,
    now,
    requireAdminPrincipal,
    parseJsonBody,
    parseRequestUrl,
    parseAuthUserRole,
    parseAuthUserStatus,
    userToResponseData,
    writeError,
    writeSuccess,
  } = deps;

  const handleAdminListUsers = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for users list');
      return;
    }

    const adminPrincipal = await requireAdminPrincipal(request, response);
    if (!adminPrincipal) {
      return;
    }

    const url = parseRequestUrl(request);
    const query = url.searchParams.get('q') ?? undefined;
    const statusRaw = url.searchParams.get('status');
    const status = statusRaw ? parseAuthUserStatus(statusRaw) : undefined;
    if (statusRaw && !status) {
      writeError(response, 400, 'bad_request', 'Invalid status filter');
      return;
    }

    const users = await repositories.users.listUsers({
      ...(status ? { status } : {}),
      ...(query ? { query } : {}),
    });

    await repositories.sessions.touchSession(adminPrincipal.session.id, now());
    writeSuccess(response, 200, {
      users: users.map(userToResponseData),
    });
  };

  const handleAdminCreateUser = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for create user');
      return;
    }

    const adminPrincipal = await requireAdminPrincipal(request, response);
    if (!adminPrincipal) {
      return;
    }

    let body: AdminCreateUserRequestBody;
    try {
      body = await parseJsonBody<AdminCreateUserRequestBody>(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const email = typeof body.email === 'string' ? body.email.trim() : '';
    if (!email) {
      writeError(response, 400, 'bad_request', 'Email is required');
      return;
    }

    const role = body.role === undefined
      ? 'member'
      : parseAuthUserRole(body.role);
    if (!role) {
      writeError(response, 400, 'bad_request', 'Invalid role');
      return;
    }

    const status = body.status === undefined
      ? 'active'
      : parseAuthUserStatus(body.status);
    if (!status) {
      writeError(response, 400, 'bad_request', 'Invalid status');
      return;
    }

    const existing = await repositories.users.findUserByEmail(email);
    if (existing) {
      writeError(response, 409, 'conflict', 'User already exists');
      return;
    }

    const password = typeof body.password === 'string' ? body.password : null;
    const passwordHash = password
      ? await passwordHashing.hashPassword(password)
      : null;

    const created = await repositories.users.createUser({
      id: `usr_${randomUUID()}`,
      email,
      role,
      status,
      ...(typeof body.monthlyQuota === 'number' ? { monthlyQuota: body.monthlyQuota } : {}),
      ...(typeof body.monthlyUsed === 'number' ? { monthlyUsed: body.monthlyUsed } : {}),
      ...(passwordHash
        ? {
            passwordHash,
            passwordAlgo: passwordHashing.passwordAlgorithm,
            passwordChangedAt: now(),
          }
        : {}),
      createdByAdminUserId: adminPrincipal.user.id,
    });

    await repositories.sessions.touchSession(adminPrincipal.session.id, now());
    writeSuccess(response, 201, {
      user: userToResponseData(created),
    });
  };

  const handleAdminGetUser = async (
    request: IncomingMessage,
    response: ServerResponse,
    userId: string,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for user details');
      return;
    }

    const adminPrincipal = await requireAdminPrincipal(request, response);
    if (!adminPrincipal) {
      return;
    }

    const user = await repositories.users.findUserById(userId);
    if (!user) {
      writeError(response, 404, 'not_found', 'User not found');
      return;
    }

    await repositories.sessions.touchSession(adminPrincipal.session.id, now());
    writeSuccess(response, 200, {
      user: userToResponseData(user),
    });
  };

  const handleAdminUpdateUser = async (
    request: IncomingMessage,
    response: ServerResponse,
    userId: string,
  ): Promise<void> => {
    if (request.method !== 'PATCH') {
      writeError(response, 405, 'method_not_allowed', 'Use PATCH for update user');
      return;
    }

    const adminPrincipal = await requireAdminPrincipal(request, response);
    if (!adminPrincipal) {
      return;
    }

    let body: AdminUpdateUserRequestBody;
    try {
      body = await parseJsonBody<AdminUpdateUserRequestBody>(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const parsedRole = body.role === undefined ? undefined : parseAuthUserRole(body.role);
    if (body.role !== undefined && !parsedRole) {
      writeError(response, 400, 'bad_request', 'Invalid role');
      return;
    }

    const parsedStatus = body.status === undefined ? undefined : parseAuthUserStatus(body.status);
    if (body.status !== undefined && !parsedStatus) {
      writeError(response, 400, 'bad_request', 'Invalid status');
      return;
    }

    const nextEmail = typeof body.email === 'string' ? body.email.trim() : undefined;
    if (body.email !== undefined && !nextEmail) {
      writeError(response, 400, 'bad_request', 'Invalid email');
      return;
    }

    const password = typeof body.password === 'string' ? body.password : undefined;

    const updateInput: UpdateAuthUserInput = {};
    if (nextEmail !== undefined) {
      updateInput.email = nextEmail;
    }
    if (parsedRole !== undefined && parsedRole !== null) {
      updateInput.role = parsedRole;
    }
    if (parsedStatus !== undefined && parsedStatus !== null) {
      updateInput.status = parsedStatus;
    }
    if (typeof body.monthlyQuota === 'number') {
      updateInput.monthlyQuota = body.monthlyQuota;
    }
    if (typeof body.monthlyUsed === 'number') {
      updateInput.monthlyUsed = body.monthlyUsed;
    }
    if (parsedStatus === 'disabled') {
      updateInput.disabledAt = now();
    }

    const updated = await repositories.users.updateUser(userId, updateInput);

    if (!updated) {
      writeError(response, 404, 'not_found', 'User not found');
      return;
    }

    if (password) {
      const passwordHash = await passwordHashing.hashPassword(password);
      await repositories.users.setPassword(userId, {
        passwordHash,
        passwordAlgo: passwordHashing.passwordAlgorithm,
        passwordChangedAt: now(),
        ...(parsedStatus ? { nextStatus: parsedStatus } : {}),
      });
    }

    const reloaded = await repositories.users.findUserById(userId);
    if (!reloaded) {
      writeError(response, 404, 'not_found', 'User not found');
      return;
    }

    await repositories.sessions.touchSession(adminPrincipal.session.id, now());
    writeSuccess(response, 200, {
      user: userToResponseData(reloaded),
    });
  };

  const handleAdminDeleteUser = async (
    request: IncomingMessage,
    response: ServerResponse,
    userId: string,
  ): Promise<void> => {
    if (request.method !== 'DELETE') {
      writeError(response, 405, 'method_not_allowed', 'Use DELETE for disable user');
      return;
    }

    const adminPrincipal = await requireAdminPrincipal(request, response);
    if (!adminPrincipal) {
      return;
    }

    const updated = await repositories.users.updateUser(userId, {
      status: 'disabled',
      disabledAt: now(),
    });

    if (!updated) {
      writeError(response, 404, 'not_found', 'User not found');
      return;
    }

    await repositories.sessions.revokeUserSessions({
      userId,
      revokedAt: now(),
    });
    await repositories.sessions.touchSession(adminPrincipal.session.id, now());

    response.statusCode = 204;
    response.end('');
  };

  return {
    handleAdminListUsers,
    handleAdminCreateUser,
    handleAdminGetUser,
    handleAdminUpdateUser,
    handleAdminDeleteUser,
  };
};