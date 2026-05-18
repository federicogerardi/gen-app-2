import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

import type { AuthRepositoryBundle } from '../../adapters';
import type { AuthSessionPrincipal } from '../../types/auth';
import type {
  AuthIdGenerator,
  GoogleOAuthRuntime,
  PasswordHashRuntime,
  SessionCookieRuntime,
} from '../auth-contract';

type LoginRequestBody = {
  email?: unknown;
  password?: unknown;
};

type WriteError = (
  response: ServerResponse,
  statusCode: number,
  code:
    | 'bad_request'
    | 'unauthorized'
    | 'forbidden'
    | 'method_not_allowed'
    | 'service_unavailable',
  message: string,
) => void;

type WriteSuccess = (response: ServerResponse, statusCode: number, data: Record<string, unknown>) => void;

export type CreateAuthHandlersDependencies = {
  repositories: AuthRepositoryBundle;
  now: () => Date;
  sessionTtlMs: number;
  googleOAuthStateTtlMs: number;
  googleOAuthSuccessRedirectPath: string;
  sessionCookies: SessionCookieRuntime;
  passwordHashing: PasswordHashRuntime;
  googleOAuth: GoogleOAuthRuntime | null;
  idGenerator: AuthIdGenerator;
  parseLoginBody: (request: IncomingMessage) => Promise<LoginRequestBody>;
  readPrincipalFromCookie: (request: IncomingMessage) => Promise<AuthSessionPrincipal | null>;
  getClientIp: (request: IncomingMessage) => string | null;
  parseRequestUrl: (request: IncomingMessage) => URL;
  sessionToResponseData: (principal: AuthSessionPrincipal) => Record<string, unknown>;
  writeError: WriteError;
  writeSuccess: WriteSuccess;
};

export type AuthHandlers = {
  handleLogin(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleLogout(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleSession(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleGoogleOAuthStart(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleGoogleOAuthCallback(request: IncomingMessage, response: ServerResponse): Promise<void>;
};

export const createAuthHandlers = (deps: CreateAuthHandlersDependencies): AuthHandlers => {
  const {
    repositories,
    now,
    sessionTtlMs,
    googleOAuthStateTtlMs,
    googleOAuthSuccessRedirectPath,
    sessionCookies,
    passwordHashing,
    googleOAuth,
    idGenerator,
    parseLoginBody,
    readPrincipalFromCookie,
    getClientIp,
    parseRequestUrl,
    sessionToResponseData,
    writeError,
    writeSuccess,
  } = deps;

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

  return {
    handleLogin,
    handleLogout,
    handleSession,
    handleGoogleOAuthStart,
    handleGoogleOAuthCallback,
  };
};
