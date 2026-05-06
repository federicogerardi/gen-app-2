import { randomBytes, randomUUID, scrypt as nodeScrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import type { IncomingMessage, ServerResponse } from 'node:http';

const scrypt = promisify(nodeScrypt);

const DEFAULT_PASSWORD_ALGO = 'scrypt-v1';
const DEFAULT_COOKIE_NAME = 'genapp_session';

type CookieSameSite = 'lax' | 'strict' | 'none';

export type SessionCookieRuntime = {
  cookieName: string;
  issueSessionToken(): string;
  readSessionToken(request: IncomingMessage): string | null;
  applySessionCookie(response: ServerResponse, token: string, expiresAt: Date): void;
  clearSessionCookie(response: ServerResponse): void;
};

export type PasswordHashRuntime = {
  passwordAlgorithm: string;
  hashPassword(plainTextPassword: string): Promise<string>;
  verifyPassword(plainTextPassword: string, passwordHash: string): Promise<boolean>;
  hashSessionToken(sessionToken: string): string;
};

export type AuthRuntimeContracts = {
  sessionCookies: SessionCookieRuntime;
  passwordHashing: PasswordHashRuntime;
};

export type GoogleOAuthIdentity = {
  providerSubject: string;
  email: string;
  emailVerified: boolean;
  profile: Record<string, unknown>;
};

export type GoogleOAuthRuntime = {
  redirectUri: string;
  buildAuthorizationUrl(input: { state: string; codeVerifier: string }): string;
  exchangeCodeForIdentity(input: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<GoogleOAuthIdentity>;
};

export type GoogleOAuthRuntimeOptions = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  userInfoEndpoint?: string;
  scopes?: string[];
  fetchImpl?: typeof fetch;
};

export type SessionCookieRuntimeOptions = {
  cookieName?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: CookieSameSite;
};

export type PasswordHashRuntimeOptions = {
  passwordAlgorithm?: string;
};

const normalizeCookieValue = (value: string): string => {
  return encodeURIComponent(value);
};

const parseCookieHeader = (cookieHeader: string | undefined): Record<string, string> => {
  if (!cookieHeader) {
    return {};
  }

  const parsed: Record<string, string> = {};
  const entries = cookieHeader.split(';');
  for (const entry of entries) {
    const [rawName, ...rawValueParts] = entry.trim().split('=');
    if (!rawName || rawValueParts.length === 0) {
      continue;
    }

    const value = rawValueParts.join('=');
    parsed[rawName] = decodeURIComponent(value);
  }

  return parsed;
};

const appendSetCookie = (response: ServerResponse, cookie: string): void => {
  const current = response.getHeader('Set-Cookie');
  if (!current) {
    response.setHeader('Set-Cookie', cookie);
    return;
  }

  if (Array.isArray(current)) {
    response.setHeader('Set-Cookie', [...current.map(String), cookie]);
    return;
  }

  response.setHeader('Set-Cookie', [String(current), cookie]);
};

export const createDefaultSessionCookieRuntime = (
  options: SessionCookieRuntimeOptions = {},
): SessionCookieRuntime => {
  const cookieName = options.cookieName ?? DEFAULT_COOKIE_NAME;
  const cookiePath = options.path ?? '/';
  const sameSite = options.sameSite ?? 'lax';
  const secure = options.secure ?? false;
  const httpOnly = options.httpOnly ?? true;

  return {
    cookieName,
    issueSessionToken(): string {
      return randomBytes(32).toString('base64url');
    },
    readSessionToken(request: IncomingMessage): string | null {
      const cookieHeader = request.headers.cookie;
      const serialized = Array.isArray(cookieHeader)
        ? cookieHeader.join(';')
        : cookieHeader;
      const cookies = parseCookieHeader(serialized);
      const token = cookies[cookieName];
      return token && token.length > 0 ? token : null;
    },
    applySessionCookie(response: ServerResponse, token: string, expiresAt: Date): void {
      const parts = [
        `${cookieName}=${normalizeCookieValue(token)}`,
        `Path=${cookiePath}`,
        `Expires=${expiresAt.toUTCString()}`,
        'Max-Age=' + Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
        `SameSite=${sameSite.charAt(0).toUpperCase()}${sameSite.slice(1)}`,
      ];

      if (httpOnly) {
        parts.push('HttpOnly');
      }

      if (secure) {
        parts.push('Secure');
      }

      appendSetCookie(response, parts.join('; '));
    },
    clearSessionCookie(response: ServerResponse): void {
      const parts = [
        `${cookieName}=`,
        `Path=${cookiePath}`,
        'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
        'Max-Age=0',
        `SameSite=${sameSite.charAt(0).toUpperCase()}${sameSite.slice(1)}`,
      ];

      if (httpOnly) {
        parts.push('HttpOnly');
      }

      if (secure) {
        parts.push('Secure');
      }

      appendSetCookie(response, parts.join('; '));
    },
  };
};

const constantTimeEquals = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

export const createDefaultPasswordHashRuntime = (
  options: PasswordHashRuntimeOptions = {},
): PasswordHashRuntime => {
  const passwordAlgorithm = options.passwordAlgorithm ?? DEFAULT_PASSWORD_ALGO;

  return {
    passwordAlgorithm,
    async hashPassword(plainTextPassword: string): Promise<string> {
      const salt = randomBytes(16);
      const derivedKey = await scrypt(plainTextPassword, salt, 64) as Buffer;
      return `scrypt$${salt.toString('base64')}$${derivedKey.toString('base64')}`;
    },
    async verifyPassword(plainTextPassword: string, passwordHash: string): Promise<boolean> {
      const parts = passwordHash.split('$');
      if (parts.length !== 3 || parts[0] !== 'scrypt') {
        return false;
      }

      const saltValue = parts[1];
      const expectedValue = parts[2];
      if (!saltValue || !expectedValue) {
        return false;
      }

      const salt = Buffer.from(saltValue, 'base64');
      const expected = Buffer.from(expectedValue, 'base64');
      const derived = await scrypt(plainTextPassword, salt, expected.length) as Buffer;
      return constantTimeEquals(derived.toString('base64'), expected.toString('base64'));
    },
    hashSessionToken(sessionToken: string): string {
      return createHash('sha256').update(sessionToken).digest('hex');
    },
  };
};

export type AuthIdGenerator = {
  nextSessionId(): string;
};

export const createDefaultAuthIdGenerator = (): AuthIdGenerator => {
  return {
    nextSessionId(): string {
      return randomUUID();
    },
  };
};

const base64UrlSha256 = (value: string): string => {
  return createHash('sha256').update(value).digest('base64url');
};

export const createGoogleOAuthRuntime = (
  options: GoogleOAuthRuntimeOptions,
): GoogleOAuthRuntime => {
  const authorizationEndpoint =
    options.authorizationEndpoint ?? 'https://accounts.google.com/o/oauth2/v2/auth';
  const tokenEndpoint = options.tokenEndpoint ?? 'https://oauth2.googleapis.com/token';
  const userInfoEndpoint = options.userInfoEndpoint ?? 'https://openidconnect.googleapis.com/v1/userinfo';
  const scopes = options.scopes ?? ['openid', 'email', 'profile'];
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    redirectUri: options.redirectUri,
    buildAuthorizationUrl(input: { state: string; codeVerifier: string }): string {
      const params = new URLSearchParams({
        client_id: options.clientId,
        redirect_uri: options.redirectUri,
        response_type: 'code',
        scope: scopes.join(' '),
        state: input.state,
        code_challenge: base64UrlSha256(input.codeVerifier),
        code_challenge_method: 'S256',
        access_type: 'offline',
        prompt: 'consent',
      });

      return `${authorizationEndpoint}?${params.toString()}`;
    },
    async exchangeCodeForIdentity(input: {
      code: string;
      codeVerifier: string;
      redirectUri: string;
    }): Promise<GoogleOAuthIdentity> {
      const tokenResponse = await fetchImpl(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code: input.code,
          client_id: options.clientId,
          client_secret: options.clientSecret,
          redirect_uri: input.redirectUri,
          grant_type: 'authorization_code',
          code_verifier: input.codeVerifier,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error('google_token_exchange_failed');
      }

      const tokenBody = await tokenResponse.json() as {
        access_token?: string;
      };
      if (!tokenBody.access_token) {
        throw new Error('google_access_token_missing');
      }

      const userInfoResponse = await fetchImpl(userInfoEndpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokenBody.access_token}`,
        },
      });

      if (!userInfoResponse.ok) {
        throw new Error('google_userinfo_failed');
      }

      const userInfoBody = await userInfoResponse.json() as {
        sub?: string;
        email?: string;
        email_verified?: boolean;
        [key: string]: unknown;
      };

      if (!userInfoBody.sub || !userInfoBody.email) {
        throw new Error('google_userinfo_incomplete');
      }

      return {
        providerSubject: userInfoBody.sub,
        email: userInfoBody.email,
        emailVerified: userInfoBody.email_verified === true,
        profile: userInfoBody,
      };
    },
  };
};

export const createGoogleOAuthRuntimeFromEnv = (
  env: NodeJS.ProcessEnv = process.env,
): GoogleOAuthRuntime | null => {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  const redirectUri = env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  return createGoogleOAuthRuntime({
    clientId,
    clientSecret,
    redirectUri,
  });
};
