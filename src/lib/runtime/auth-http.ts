import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

import type { AuthRepositoryBundle, UserQueryRepositoryBundle } from '../adapters';
import type {
  AuthSessionPrincipal,
  AuthUserRole,
  AuthUserStatus,
  UpdateAuthUserInput,
} from '../types/auth';
import type { ArtifactListFilters } from '../types/artifacts';
import type { ArtifactStatus, ArtifactType } from '../types/artifact';
import { isArtifactStatus, isArtifactType } from '../types/artifact';
import {
  createDefaultAuthIdGenerator,
  createGoogleOAuthRuntimeFromEnv,
  createDefaultPasswordHashRuntime,
  createDefaultSessionCookieRuntime,
  type AuthIdGenerator,
  type GoogleOAuthRuntime,
  type PasswordHashRuntime,
  type SessionCookieRuntime,
} from './auth-contract';

const DEFAULT_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const MAX_BODY_SIZE_BYTES = 64 * 1024;

type AuthHttpErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'method_not_allowed'
  | 'not_found'
  | 'conflict'
  | 'service_unavailable'
  | 'internal';

type AuthHttpSuccessBody = {
  ok: true;
  data: Record<string, unknown>;
};

type AuthHttpErrorBody = {
  ok: false;
  error: {
    code: AuthHttpErrorCode;
    message: string;
  };
};

export type AuthHttpResponseBody = AuthHttpSuccessBody | AuthHttpErrorBody;

export type AuthHttpRuntimeOptions = {
  repositories: AuthRepositoryBundle;
  queryRepositories?: UserQueryRepositoryBundle;
  sessionCookies?: SessionCookieRuntime;
  passwordHashing?: PasswordHashRuntime;
  googleOAuth?: GoogleOAuthRuntime | null;
  googleOAuthStateTtlMs?: number;
  googleOAuthSuccessRedirectPath?: string;
  idGenerator?: AuthIdGenerator;
  now?: () => Date;
  sessionTtlMs?: number;
};

export type HandleAuthHttpRequestResult = {
  handled: boolean;
};

type LoginRequestBody = {
  email?: unknown;
  password?: unknown;
};

type AdminCreateUserRequestBody = {
  email?: unknown;
  role?: unknown;
  status?: unknown;
  monthlyQuota?: unknown;
  monthlyUsed?: unknown;
  password?: unknown;
};

type AdminUpdateUserRequestBody = {
  email?: unknown;
  role?: unknown;
  status?: unknown;
  monthlyQuota?: unknown;
  monthlyUsed?: unknown;
  password?: unknown;
};

type CreateProjectRequestBody = {
  name?: unknown;
  description?: unknown;
};

const AUTH_USER_ROLE_SET = new Set<AuthUserRole>(['admin', 'member']);
const AUTH_USER_STATUS_SET = new Set<AuthUserStatus>(['active', 'disabled', 'pending_password_reset']);

const normalizePath = (url: string | undefined): string => {
  if (!url || url.length === 0) {
    return '/';
  }

  return url.split('?')[0] || '/';
};

const parseRequestUrl = (request: IncomingMessage): URL => {
  return new URL(request.url ?? '/', 'http://localhost');
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

const writeSuccess = (
  response: ServerResponse,
  statusCode: number,
  data: Record<string, unknown>,
): void => {
  writeJson(response, statusCode, { ok: true, data });
};

const writeError = (
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

const parseLoginBody = async (request: IncomingMessage): Promise<LoginRequestBody> => {
  const rawBody = await readRequestBody(request);
  if (rawBody.length === 0) {
    return {};
  }

  const parsed = JSON.parse(rawBody) as LoginRequestBody;
  return parsed;
};

const parseJsonBody = async <T>(request: IncomingMessage): Promise<T> => {
  const rawBody = await readRequestBody(request);
  if (rawBody.length === 0) {
    return {} as T;
  }

  return JSON.parse(rawBody) as T;
};

const parseAuthUserRole = (value: unknown): AuthUserRole | null => {
  if (typeof value !== 'string') {
    return null;
  }

  return AUTH_USER_ROLE_SET.has(value as AuthUserRole)
    ? (value as AuthUserRole)
    : null;
};

const parseAuthUserStatus = (value: unknown): AuthUserStatus | null => {
  if (typeof value !== 'string') {
    return null;
  }

  return AUTH_USER_STATUS_SET.has(value as AuthUserStatus)
    ? (value as AuthUserStatus)
    : null;
};

const isSessionPrincipalActive = (
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

const getClientIp = (request: IncomingMessage): string | null => {
  const forwardedFor = request.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0]?.trim() ?? null;
  }

  return request.socket.remoteAddress ?? null;
};

const sessionToResponseData = (principal: AuthSessionPrincipal): Record<string, unknown> => {
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

const userToResponseData = (user: {
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

export const createAuthHttpRuntime = (
  options: AuthHttpRuntimeOptions,
): {
  handleRequest(request: IncomingMessage, response: ServerResponse): Promise<HandleAuthHttpRequestResult>;
} => {
  const repositories = options.repositories;
  const queryRepositories = options.queryRepositories;
  const now = options.now ?? (() => new Date());
  const sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  const googleOAuthStateTtlMs = options.googleOAuthStateTtlMs ?? 10 * 60 * 1000;
  const googleOAuthSuccessRedirectPath = options.googleOAuthSuccessRedirectPath ?? '/';
  const sessionCookies = options.sessionCookies ?? createDefaultSessionCookieRuntime();
  const passwordHashing = options.passwordHashing ?? createDefaultPasswordHashRuntime();
  const googleOAuth = options.googleOAuth ?? createGoogleOAuthRuntimeFromEnv();
  const idGenerator = options.idGenerator ?? createDefaultAuthIdGenerator();

  const readPrincipalFromCookie = async (
    request: IncomingMessage,
  ): Promise<AuthSessionPrincipal | null> => {
    const sessionToken = sessionCookies.readSessionToken(request);
    if (!sessionToken) {
      return null;
    }

    const sessionTokenHash = passwordHashing.hashSessionToken(sessionToken);
    const principal = await repositories.sessions.getSessionByTokenHash(sessionTokenHash);
    if (!principal) {
      return null;
    }

    if (!isSessionPrincipalActive(principal, now())) {
      return null;
    }

    return principal;
  };

  const handleLogin = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for login');
      return;
    }

    let body: LoginRequestBody;
    try {
      body = await parseLoginBody(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (email.length === 0 || password.length === 0) {
      writeError(response, 400, 'bad_request', 'Email and password are required');
      return;
    }

    const user = await repositories.users.findUserByEmail(email);
    if (!user || !user.passwordHash || !user.passwordAlgo) {
      writeError(response, 401, 'unauthorized', 'Invalid credentials');
      return;
    }

    if (user.status !== 'active') {
      writeError(response, 403, 'forbidden', 'User is not active');
      return;
    }

    const passwordOk = await passwordHashing.verifyPassword(password, user.passwordHash);
    if (!passwordOk) {
      writeError(response, 401, 'unauthorized', 'Invalid credentials');
      return;
    }

    const issuedAt = now();
    const expiresAt = new Date(issuedAt.getTime() + sessionTtlMs);
    const sessionToken = sessionCookies.issueSessionToken();
    const sessionTokenHash = passwordHashing.hashSessionToken(sessionToken);

    const principal = await repositories.sessions.createSession({
      id: idGenerator.nextSessionId(),
      userId: user.id,
      sessionTokenHash,
      authMethod: 'native',
      ipAddress: getClientIp(request),
      userAgent: request.headers['user-agent'] ?? null,
      expiresAt,
    });

    await repositories.users.recordSuccessfulLogin(user.id, issuedAt);
    sessionCookies.applySessionCookie(response, sessionToken, expiresAt);

    writeSuccess(response, 200, sessionToResponseData(principal));
  };

  const handleLogout = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for logout');
      return;
    }

    const sessionToken = sessionCookies.readSessionToken(request);
    if (sessionToken) {
      const sessionTokenHash = passwordHashing.hashSessionToken(sessionToken);
      const principal = await repositories.sessions.getSessionByTokenHash(sessionTokenHash);
      if (principal) {
        await repositories.sessions.revokeSession(principal.session.id, now());
      }
    }

    sessionCookies.clearSessionCookie(response);
    response.statusCode = 204;
    response.end('');
  };

  const handleSession = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for session');
      return;
    }

    const principal = await readPrincipalFromCookie(request);
    if (!principal) {
      sessionCookies.clearSessionCookie(response);
      writeError(response, 401, 'unauthorized', 'No active session');
      return;
    }

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 200, sessionToResponseData(principal));
  };

  const handleGoogleOAuthStart = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for Google OAuth start');
      return;
    }

    if (!googleOAuth) {
      writeError(response, 503, 'service_unavailable', 'Google OAuth is not configured');
      return;
    }

    const state = `st_${randomUUID()}`;
    const codeVerifier = `cv_${randomUUID()}_${randomUUID()}`;
    const expiresAt = new Date(now().getTime() + googleOAuthStateTtlMs);

    await repositories.oauthState.createStateToken({
      state,
      provider: 'google',
      codeVerifier,
      redirectUri: googleOAuth.redirectUri,
      expiresAt,
      requestedByIp: getClientIp(request),
    });

    const authorizeUrl = googleOAuth.buildAuthorizationUrl({
      state,
      codeVerifier,
    });

    response.statusCode = 302;
    response.setHeader('Location', authorizeUrl);
    response.end('');
  };

  const handleGoogleOAuthCallback = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for Google OAuth callback');
      return;
    }

    if (!googleOAuth) {
      writeError(response, 503, 'service_unavailable', 'Google OAuth is not configured');
      return;
    }

    const url = parseRequestUrl(request);
    const state = url.searchParams.get('state');
    const code = url.searchParams.get('code');

    if (!state || !code) {
      writeError(response, 400, 'bad_request', 'Missing state or code');
      return;
    }

    const stateToken = await repositories.oauthState.consumeStateToken(
      state,
      'google',
      now(),
    );

    if (!stateToken) {
      writeError(response, 401, 'unauthorized', 'Invalid or already consumed OAuth state');
      return;
    }

    if (Date.parse(stateToken.expiresAt) <= now().getTime()) {
      writeError(response, 401, 'unauthorized', 'Expired OAuth state');
      return;
    }

    let identity;
    try {
      identity = await googleOAuth.exchangeCodeForIdentity({
        code,
        codeVerifier: stateToken.codeVerifier,
        redirectUri: stateToken.redirectUri,
      });
    } catch {
      writeError(response, 401, 'unauthorized', 'Google OAuth exchange failed');
      return;
    }

    let user = await repositories.users.findUserByOAuthSubject('google', identity.providerSubject);
    if (!user) {
      const byEmail = await repositories.users.findUserByEmail(identity.email);
      if (!byEmail) {
        writeError(response, 403, 'forbidden', 'Google account not linked to an allowed user');
        return;
      }

      await repositories.users.linkOAuthAccount({
        userId: byEmail.id,
        provider: 'google',
        providerSubject: identity.providerSubject,
        emailAtProvider: identity.email,
        profileJson: identity.profile,
      });

      user = byEmail;
    }

    if (user.status !== 'active') {
      writeError(response, 403, 'forbidden', 'User is not active');
      return;
    }

    const issuedAt = now();
    const expiresAt = new Date(issuedAt.getTime() + sessionTtlMs);
    const sessionToken = sessionCookies.issueSessionToken();
    const sessionTokenHash = passwordHashing.hashSessionToken(sessionToken);

    await repositories.sessions.createSession({
      id: idGenerator.nextSessionId(),
      userId: user.id,
      sessionTokenHash,
      authMethod: 'google',
      ipAddress: getClientIp(request),
      userAgent: request.headers['user-agent'] ?? null,
      expiresAt,
    });

    await repositories.users.recordSuccessfulLogin(user.id, issuedAt);
    sessionCookies.applySessionCookie(response, sessionToken, expiresAt);

    response.statusCode = 302;
    response.setHeader('Location', googleOAuthSuccessRedirectPath);
    response.end('');
  };

  const requireAdminPrincipal = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<AuthSessionPrincipal | null> => {
    const principal = await readPrincipalFromCookie(request);
    if (!principal) {
      sessionCookies.clearSessionCookie(response);
      writeError(response, 401, 'unauthorized', 'No active session');
      return null;
    }

    if (principal.user.role !== 'admin') {
      writeError(response, 403, 'forbidden', 'Admin scope required');
      return null;
    }

    return principal;
  };

  const requireSessionPrincipal = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<AuthSessionPrincipal | null> => {
    const principal = await readPrincipalFromCookie(request);
    if (!principal) {
      sessionCookies.clearSessionCookie(response);
      writeError(response, 401, 'unauthorized', 'No active session');
      return null;
    }

    return principal;
  };

  const requireQueryRepositories = (response: ServerResponse): UserQueryRepositoryBundle | null => {
    if (!queryRepositories) {
      writeError(response, 503, 'service_unavailable', 'Query repositories are not configured');
      return null;
    }

    return queryRepositories;
  };

  const handleProjectsList = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for projects list');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) {
      return;
    }

    const queries = requireQueryRepositories(response);
    if (!queries) {
      return;
    }

    const projects = await queries.projects.listProjectsByUser(principal.user.id);
    await repositories.sessions.touchSession(principal.session.id, now());

    writeSuccess(response, 200, { projects });
  };

  const handleProjectsCreate = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for create project');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) {
      return;
    }

    const queries = requireQueryRepositories(response);
    if (!queries) {
      return;
    }

    let body: CreateProjectRequestBody;
    try {
      body = await parseJsonBody<CreateProjectRequestBody>(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      writeError(response, 400, 'bad_request', 'Project name is required');
      return;
    }

    const description = typeof body.description === 'string' ? body.description.trim() : undefined;
    const project = await queries.projects.createProjectForUser(principal.user.id, {
      name,
      ...(description ? { description } : {}),
    });

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 201, { project });
  };

  const handleProjectById = async (
    request: IncomingMessage,
    response: ServerResponse,
    projectId: string,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for project detail');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) {
      return;
    }

    const queries = requireQueryRepositories(response);
    if (!queries) {
      return;
    }

    const project = await queries.projects.getProjectByIdForUser(principal.user.id, projectId);
    if (!project) {
      writeError(response, 404, 'not_found', 'Project not found');
      return;
    }

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 200, { project });
  };

  const handleArtifactsList = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for artifacts list');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) {
      return;
    }

    const queries = requireQueryRepositories(response);
    if (!queries) {
      return;
    }

    const url = parseRequestUrl(request);
    const typeRaw = url.searchParams.get('type');
    const statusRaw = url.searchParams.get('status');
    const projectIdRaw = url.searchParams.get('projectId');
    const fromRaw = url.searchParams.get('from');
    const toRaw = url.searchParams.get('to');

    if (typeRaw && !isArtifactType(typeRaw)) {
      writeError(response, 400, 'bad_request', 'Invalid type filter');
      return;
    }

    if (statusRaw && !isArtifactStatus(statusRaw)) {
      writeError(response, 400, 'bad_request', 'Invalid status filter');
      return;
    }

    if (projectIdRaw !== null && projectIdRaw.trim().length === 0) {
      writeError(response, 400, 'bad_request', 'Invalid projectId filter');
      return;
    }

    if (fromRaw && Number.isNaN(Date.parse(fromRaw))) {
      writeError(response, 400, 'bad_request', 'Invalid from filter');
      return;
    }

    if (toRaw && Number.isNaN(Date.parse(toRaw))) {
      writeError(response, 400, 'bad_request', 'Invalid to filter');
      return;
    }

    const filters: ArtifactListFilters = {};
    if (typeRaw) {
      filters.type = typeRaw as ArtifactType;
    }
    if (statusRaw) {
      filters.status = statusRaw as ArtifactStatus;
    }
    if (projectIdRaw) {
      filters.projectId = projectIdRaw;
    }
    if (fromRaw) {
      filters.from = fromRaw;
    }
    if (toRaw) {
      filters.to = toRaw;
    }

    const artifacts = await queries.artifacts.listArtifactsByUser(principal.user.id, filters);

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 200, { artifacts });
  };

  const handleArtifactById = async (
    request: IncomingMessage,
    response: ServerResponse,
    artifactId: string,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for artifact detail');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) {
      return;
    }

    const queries = requireQueryRepositories(response);
    if (!queries) {
      return;
    }

    const artifact = await queries.artifacts.getArtifactByIdForUser(principal.user.id, artifactId);
    if (!artifact) {
      writeError(response, 404, 'not_found', 'Artifact not found');
      return;
    }

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 200, { artifact });
  };

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
    async handleRequest(
      request: IncomingMessage,
      response: ServerResponse,
    ): Promise<HandleAuthHttpRequestResult> {
      const path = normalizePath(request.url);
      try {

      if (path === '/auth/login') {
        await handleLogin(request, response);
        return { handled: true };
      }

      if (path === '/auth/logout') {
        await handleLogout(request, response);
        return { handled: true };
      }

      if (path === '/auth/session') {
        await handleSession(request, response);
        return { handled: true };
      }

      if (path === '/auth/google/start') {
        await handleGoogleOAuthStart(request, response);
        return { handled: true };
      }

      if (path === '/auth/google/callback') {
        await handleGoogleOAuthCallback(request, response);
        return { handled: true };
      }

      if (path === '/admin/users') {
        if (request.method === 'GET') {
          await handleAdminListUsers(request, response);
          return { handled: true };
        }

        if (request.method === 'POST') {
          await handleAdminCreateUser(request, response);
          return { handled: true };
        }

        writeError(response, 405, 'method_not_allowed', 'Method not allowed for /admin/users');
        return { handled: true };
      }

      const adminUserMatch = path.match(/^\/admin\/users\/([^/]+)$/);
      if (adminUserMatch) {
        const userId = decodeURIComponent(adminUserMatch[1] ?? '');

        if (request.method === 'GET') {
          await handleAdminGetUser(request, response, userId);
          return { handled: true };
        }

        if (request.method === 'PATCH') {
          await handleAdminUpdateUser(request, response, userId);
          return { handled: true };
        }

        if (request.method === 'DELETE') {
          await handleAdminDeleteUser(request, response, userId);
          return { handled: true };
        }

        writeError(response, 405, 'method_not_allowed', 'Method not allowed for /admin/users/:id');
        return { handled: true };
      }

      if (path === '/api/projects') {
        if (request.method === 'GET') {
          await handleProjectsList(request, response);
          return { handled: true };
        }

        if (request.method === 'POST') {
          await handleProjectsCreate(request, response);
          return { handled: true };
        }

        writeError(response, 405, 'method_not_allowed', 'Method not allowed for /api/projects');
        return { handled: true };
      }

      const projectMatch = path.match(/^\/api\/projects\/([^/]+)$/);
      if (projectMatch) {
        await handleProjectById(request, response, decodeURIComponent(projectMatch[1] ?? ''));
        return { handled: true };
      }

      if (path === '/api/artifacts') {
        await handleArtifactsList(request, response);
        return { handled: true };
      }

      const artifactMatch = path.match(/^\/api\/artifacts\/([^/]+)$/);
      if (artifactMatch) {
        await handleArtifactById(request, response, decodeURIComponent(artifactMatch[1] ?? ''));
        return { handled: true };
      }

      return { handled: false };
      } catch (err) {
        console.error(`[auth-http] unhandled error for ${request.method} ${request.url}:`, err);
        if (!response.writableEnded && !response.destroyed) {
          writeError(response, 500, 'internal', 'Internal server error');
        }

        return { handled: true };
      }
    },
  };
};
