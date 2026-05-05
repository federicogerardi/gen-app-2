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
import { BriefParseError, parseBriefInput } from './brief-parser';
import {
  isSupportedToolWorkflow,
  resolveStepDependencyIds,
  extractStepFromArtifactInput,
} from './tool-workflow-registry';
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
const MAX_BODY_SIZE_BYTES = 3 * 1024 * 1024;
const MAX_BRIEF_UPLOAD_BYTES = 2 * 1024 * 1024;

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

type CreateToolBriefRequestBody = {
  projectId?: unknown;
  toolKey?: unknown;
  fileName?: unknown;
  mimeType?: unknown;
  contentBase64?: unknown;
};

type ToolHydrateRequestBody = {
  projectId?: unknown;
  sourceArtifactId?: unknown;
  resolvedBriefingId?: unknown;
  sourceExtractionArtifactId?: unknown;
  intent?: unknown;
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

const normalizeMimeType = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
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
      const ensuredUser = byEmail ?? await repositories.users.createUser({
        id: `usr_${randomUUID()}`,
        email: identity.email,
        role: 'member',
        status: 'active',
      });

      await repositories.users.linkOAuthAccount({
        userId: ensuredUser.id,
        provider: 'google',
        providerSubject: identity.providerSubject,
        emailAtProvider: identity.email,
        profileJson: identity.profile,
      });

      user = ensuredUser;
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
    const limitRaw = url.searchParams.get('limit');
    const offsetRaw = url.searchParams.get('offset');

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

    if (limitRaw !== null) {
      const limit = Number.parseInt(limitRaw, 10);
      if (!Number.isFinite(limit) || limit <= 0) {
        writeError(response, 400, 'bad_request', 'Invalid limit filter');
        return;
      }
    }

    if (offsetRaw !== null) {
      const offset = Number.parseInt(offsetRaw, 10);
      if (!Number.isFinite(offset) || offset < 0) {
        writeError(response, 400, 'bad_request', 'Invalid offset filter');
        return;
      }
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
    if (limitRaw !== null) {
      filters.limit = Number.parseInt(limitRaw, 10);
    }
    if (offsetRaw !== null) {
      filters.offset = Number.parseInt(offsetRaw, 10);
    }

    const artifacts = await queries.artifacts.listArtifactsByUser(principal.user.id, filters);

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 200, { artifacts });
  };

  const handleToolsBriefUpload = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for tools brief upload');
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

    let body: CreateToolBriefRequestBody;
    try {
      body = await parseJsonBody<CreateToolBriefRequestBody>(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
    const toolKey = typeof body.toolKey === 'string' ? body.toolKey.trim() : '';
    const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : '';
    const mimeType = normalizeMimeType(body.mimeType);
    const contentBase64 = typeof body.contentBase64 === 'string' ? body.contentBase64.trim() : '';

    if (!projectId || !fileName || !contentBase64) {
      writeError(response, 400, 'bad_request', 'projectId, fileName and contentBase64 are required');
      return;
    }

    const project = await queries.projects.getProjectByIdForUser(principal.user.id, projectId);
    if (!project) {
      writeError(response, 403, 'forbidden', 'Project ownership check failed');
      return;
    }

    let fileBuffer: Buffer;
    try {
      fileBuffer = Buffer.from(contentBase64, 'base64');
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid base64 payload');
      return;
    }

    if (fileBuffer.length === 0) {
      writeError(response, 400, 'bad_request', 'Uploaded brief is empty');
      return;
    }

    if (fileBuffer.length > MAX_BRIEF_UPLOAD_BYTES) {
      writeError(response, 400, 'bad_request', 'Uploaded brief is too large');
      return;
    }

    let parsedBrief;
    try {
      parsedBrief = await parseBriefInput({
        fileName,
        mimeType,
        content: fileBuffer,
      });
    } catch (error) {
      if (error instanceof BriefParseError) {
        writeError(response, 400, 'bad_request', error.message);
        return;
      }

      writeError(response, 400, 'bad_request', 'Unable to parse brief content');
      return;
    }

    const briefingId = `brief_${randomUUID()}`;

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 201, {
      briefing: {
        briefingId,
        projectId,
        toolKey: toolKey || null,
        fileName,
        mimeType,
        size: fileBuffer.length,
        parsedFormat: parsedBrief.format,
        normalizedText: parsedBrief.normalizedText,
        charCount: parsedBrief.charCount,
        wordCount: parsedBrief.wordCount,
      },
    });
  };

  const handleToolsHydrate = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for tools hydrate');
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

    let body: ToolHydrateRequestBody;
    try {
      body = await parseJsonBody<ToolHydrateRequestBody>(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
    if (!projectId) {
      writeError(response, 400, 'bad_request', 'projectId is required');
      return;
    }

    const sourceArtifactId = typeof body.sourceArtifactId === 'string' ? body.sourceArtifactId.trim() || null : null;
    let resolvedBriefingId = typeof body.resolvedBriefingId === 'string' ? body.resolvedBriefingId.trim() || null : null;
    let sourceExtractionArtifactId = typeof body.sourceExtractionArtifactId === 'string' ? body.sourceExtractionArtifactId.trim() || null : null;

    const isRecord = (value: unknown): value is Record<string, unknown> =>
      typeof value === 'object' && value !== null && !Array.isArray(value);

    const normalizeExtractionPayload = (value: unknown): Record<string, unknown> => {
      if (!isRecord(value)) {
        return {};
      }

      const payload = value.payload;
      if (isRecord(payload)) {
        return payload;
      }

      const extractionPayload = value.extractionPayload;
      if (isRecord(extractionPayload)) {
        return extractionPayload;
      }

      const data = value.data;
      if (isRecord(data)) {
        const dataPayload = data.payload;
        if (isRecord(dataPayload)) {
          return dataPayload;
        }

        const dataExtractionPayload = data.extractionPayload;
        if (isRecord(dataExtractionPayload)) {
          return dataExtractionPayload;
        }
      }

      return value;
    };

    const parseJsonCandidate = (candidate: string): Record<string, unknown> => {
      try {
        const parsed = JSON.parse(candidate) as unknown;
        return normalizeExtractionPayload(parsed);
      } catch {
        return {};
      }
    };

    const parseExtractionContent = (content: string): Record<string, unknown> => {
      const direct = parseJsonCandidate(content);
      if (Object.keys(direct).length > 0) {
        return direct;
      }

      const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fenced?.[1]) {
        const fromFence = parseJsonCandidate(fenced[1]);
        if (Object.keys(fromFence).length > 0) {
          return fromFence;
        }
      }

      const objectSlice = content.match(/\{[\s\S]*\}/);
      if (objectSlice?.[0]) {
        const fromSlice = parseJsonCandidate(objectSlice[0]);
        if (Object.keys(fromSlice).length > 0) {
          return fromSlice;
        }
      }

      return {};
    };

    const parsedFormatFromInput = (input: Record<string, unknown>): 'txt' | 'md' | 'docx' => {
      const raw = typeof input.parsedFormat === 'string' ? input.parsedFormat.trim().toLowerCase() : '';
      if (raw === 'txt' || raw === 'md' || raw === 'docx') {
        return raw;
      }
      return 'md';
    };

    // Step 1: resolve from sourceArtifactId if provided
    if (sourceArtifactId) {
      const artifact = await queries.artifacts.getArtifactByIdForUser(principal.user.id, sourceArtifactId);
      if (artifact) {
        if (artifact.artifactType === 'extraction') {
          const briefingId = (typeof artifact.input.briefingId === 'string' && artifact.input.briefingId.trim())
            ? artifact.input.briefingId.trim()
            : artifact.artifactId;

          const extractionPayload = parseExtractionContent(artifact.content);
          const normalizedText = typeof artifact.input.briefingText === 'string' && artifact.input.briefingText.trim().length > 0
            ? artifact.input.briefingText
            : (typeof artifact.input.normalizedText === 'string' ? artifact.input.normalizedText : '');
          const parsedFormat = parsedFormatFromInput(artifact.input);

          const hasPayload = Object.keys(extractionPayload).length > 0;
          const hasText = normalizedText.trim().length > 0;

          console.debug('[auth-http] hydrate direct extraction artifact resolved', {
            sourceArtifactId,
            artifactId: artifact.artifactId,
            projectId,
            briefingId,
            normalizedTextLength: normalizedText.trim().length,
            extractionPayloadKeys: Object.keys(extractionPayload).length,
            parsedFormat,
            willFallThrough: !hasPayload && !hasText,
          });

          // If the referenced extraction artifact has no recoverable text or payload
          // (old artifact stored before text/payload persistence was introduced),
          // fall through to list-based ranking which may find a more complete artifact.
          if (hasPayload || hasText) {
            await repositories.sessions.touchSession(principal.session.id, now());
            writeSuccess(response, 200, {
              hydration: {
                extractionArtifactId: artifact.artifactId,
                extractionPayload,
                briefingId,
                normalizedText,
                parsedFormat,
              },
            });
            return;
          }

          // Fall through to Step 2.
          // Do NOT set sourceExtractionArtifactId to this empty artifact — Step 2 should
          // use recency-based ranking to find the most recent complete extraction artifact.
          resolvedBriefingId = resolvedBriefingId ?? briefingId;
        } else {
          // Content artifact: extract hints for list-based ranking
          const artifactBriefingId = typeof artifact.input.briefingId === 'string' ? artifact.input.briefingId.trim() || null : null;
          const artifactExtractionArtifactId = typeof artifact.input.extractionArtifactId === 'string' ? artifact.input.extractionArtifactId.trim() || null : null;
          resolvedBriefingId = resolvedBriefingId ?? artifactBriefingId;
          sourceExtractionArtifactId = sourceExtractionArtifactId ?? artifactExtractionArtifactId;

          if (!resolvedBriefingId && !sourceExtractionArtifactId) {
            writeError(response, 400, 'bad_request', 'missing_extraction_reference');
            return;
          }
        }
      }
      // If artifact not found, fall through to list-based ranking
    }

    // Step 2: list-based ranking — rank by sourceExtractionArtifactId match then recency
    const candidates = await queries.artifacts.listArtifactsByUser(principal.user.id, {
      type: 'extraction',
      status: 'completed',
      projectId,
    });

    if (candidates.length === 0) {
      writeError(response, 404, 'not_found', 'No extraction artifact found for this project');
      return;
    }

    const ranked = [...candidates].sort((a, b) => {
      const aIsSource = sourceExtractionArtifactId != null && a.artifactId === sourceExtractionArtifactId ? 1 : 0;
      const bIsSource = sourceExtractionArtifactId != null && b.artifactId === sourceExtractionArtifactId ? 1 : 0;
      if (aIsSource !== bIsSource) {
        return bIsSource - aIsSource;
      }
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    });

    const best = ranked[0]!;
    const bestDetail = await queries.artifacts.getArtifactByIdForUser(principal.user.id, best.artifactId);
    if (!bestDetail) {
      writeError(response, 404, 'not_found', 'Extraction artifact detail not found');
      return;
    }

    const briefingId = (typeof bestDetail.input.briefingId === 'string' && bestDetail.input.briefingId.trim())
      ? bestDetail.input.briefingId.trim()
      : bestDetail.artifactId;

    const extractionPayload = parseExtractionContent(bestDetail.content);
    const normalizedText = typeof bestDetail.input.briefingText === 'string' && bestDetail.input.briefingText.trim().length > 0
      ? bestDetail.input.briefingText
      : (typeof bestDetail.input.normalizedText === 'string' ? bestDetail.input.normalizedText : '');
    const parsedFormat = parsedFormatFromInput(bestDetail.input);

    console.debug('[auth-http] hydrate ranked extraction artifact resolved', {
      sourceArtifactId,
      sourceExtractionArtifactId,
      resolvedBriefingId,
      rankedCandidateCount: ranked.length,
      selectedArtifactId: bestDetail.artifactId,
      projectId,
      briefingId,
      normalizedTextLength: normalizedText.trim().length,
      extractionPayloadKeys: Object.keys(extractionPayload).length,
      parsedFormat,
    });

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 200, {
      hydration: {
        extractionArtifactId: bestDetail.artifactId,
        extractionPayload,
        briefingId,
        normalizedText,
        parsedFormat,
      },
    });
  };

  type ToolOrchestrationRequestBody = {
    projectId?: unknown;
    toolKey?: unknown;
    targetStep?: unknown;
  };

  const handleToolsOrchestrate = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for tools orchestrate');
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

    let body: ToolOrchestrationRequestBody;
    try {
      body = await parseJsonBody<ToolOrchestrationRequestBody>(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
    if (!projectId) {
      writeError(response, 400, 'bad_request', 'projectId is required');
      return;
    }

    const toolKey = typeof body.toolKey === 'string' ? body.toolKey.trim() : '';
    if (!toolKey) {
      writeError(response, 400, 'bad_request', 'toolKey is required');
      return;
    }

    if (!isSupportedToolWorkflow(toolKey)) {
      writeError(response, 400, 'bad_request', `Unsupported toolKey: ${toolKey}`);
      return;
    }

    const targetStep = typeof body.targetStep === 'string' ? body.targetStep.trim() : '';
    if (!targetStep) {
      writeError(response, 400, 'bad_request', 'targetStep is required');
      return;
    }

    // Query all completed artifacts for this user+project, filter by workflowType in memory.
    const allCompleted = await queries.artifacts.listArtifactsByUser(principal.user.id, {
      projectId,
      status: 'completed',
    });

    const toolArtifacts = allCompleted.filter(
      (a) => a.workflowType === toolKey && a.artifactType !== 'extraction',
    );

    // Fetch details to extract step keys (N+1 acceptable: max 3–5 artifacts per tool).
    const completedArtifactsByStep: Record<string, string> = {};
    for (const summary of toolArtifacts) {
      const detail = await queries.artifacts.getArtifactByIdForUser(
        principal.user.id,
        summary.artifactId,
      );
      if (!detail) {
        continue;
      }

      const step = extractStepFromArtifactInput(detail.input);
      if (step && !(step in completedArtifactsByStep)) {
        // Keep the most recent artifact per step (list is ordered updated_at DESC).
        completedArtifactsByStep[step] = detail.artifactId;
      }
    }

    const { stepDependencyArtifactIds, dependencyArtifactIdsByStep } = resolveStepDependencyIds(
      toolKey,
      targetStep,
      completedArtifactsByStep,
    );

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 200, {
      orchestration: {
        toolKey,
        targetStep,
        stepDependencyArtifactIds,
        dependencyArtifactIdsByStep,
      },
    });
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

      if (path === '/api/tools/briefs') {
        await handleToolsBriefUpload(request, response);
        return { handled: true };
      }

      if (path === '/api/tools/hydrate') {
        await handleToolsHydrate(request, response);
        return { handled: true };
      }

      if (path === '/api/tools/orchestrate') {
        await handleToolsOrchestrate(request, response);
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
