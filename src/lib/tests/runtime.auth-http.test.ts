import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  ArtifactQueryRepositoryStub,
  createAuthStubRepositories,
  ProjectQueryRepositoryStub,
} from '../adapters';
import {
  createAuthHttpRuntime,
  createDefaultPasswordHashRuntime,
  createDefaultSessionCookieRuntime,
  type GoogleOAuthRuntime,
} from '../runtime';

class MockIncomingMessage extends EventEmitter {
  method: string;
  url: string;
  headers: Record<string, string>;
  socket: { remoteAddress: string | null };

  constructor(options: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: string;
    remoteAddress?: string | null;
  }) {
    super();
    this.method = options.method;
    this.url = options.url;
    this.headers = options.headers ?? {};
    this.socket = { remoteAddress: options.remoteAddress ?? null };

    process.nextTick(() => {
      if (typeof options.body === 'string') {
        this.emit('data', Buffer.from(options.body));
      }
      this.emit('end');
    });
  }
}

class MockServerResponse extends EventEmitter {
  statusCode = 200;
  writableEnded = false;
  private readonly headers = new Map<string, string | string[]>();
  private readonly bodyChunks: string[] = [];

  setHeader(name: string, value: string | string[]) {
    this.headers.set(name.toLowerCase(), value);
  }

  getHeader(name: string): string | string[] | undefined {
    return this.headers.get(name.toLowerCase());
  }

  end(chunk?: string) {
    if (typeof chunk === 'string' && chunk.length > 0) {
      this.bodyChunks.push(chunk);
    }

    this.writableEnded = true;
    this.emit('finish');
  }

  jsonBody(): Record<string, unknown> {
    const serialized = this.bodyChunks.join('');
    return serialized.length > 0 ? JSON.parse(serialized) as Record<string, unknown> : {};
  }
}

test('auth HTTP runtime supports login, session and logout flow', async () => {
  const hasher = createDefaultPasswordHashRuntime();
  const sessionCookies = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });
  const repositories = createAuthStubRepositories();

  const passwordHash = await hasher.hashPassword('Str0ng-Pass!');
  await repositories.users.createUser({
    id: 'user-auth-http-001',
    email: 'admin@example.com',
    role: 'admin',
    status: 'active',
    passwordHash,
    passwordAlgo: hasher.passwordAlgorithm,
  });

  const runtime = createAuthHttpRuntime({
    repositories,
    passwordHashing: hasher,
    sessionCookies,
    now: () => new Date('2026-04-24T10:00:00.000Z'),
    idGenerator: { nextSessionId: () => 'session-auth-http-001' },
    sessionTtlMs: 60 * 60 * 1000,
  });

  const loginRequest = new MockIncomingMessage({
    method: 'POST',
    url: '/auth/login',
    headers: { 'user-agent': 'test-agent/1.0' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'Str0ng-Pass!' }),
    remoteAddress: '127.0.0.1',
  });
  const loginResponse = new MockServerResponse();

  await runtime.handleRequest(
    loginRequest as unknown as IncomingMessage,
    loginResponse as unknown as ServerResponse,
  );

  assert.equal(loginResponse.statusCode, 200);
  const loginBody = loginResponse.jsonBody();
  assert.equal(loginBody.ok, true);

  const setCookieHeader = loginResponse.getHeader('set-cookie');
  assert.ok(setCookieHeader);
  const setCookieValue = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  assert.ok(typeof setCookieValue === 'string');

  const cookieHeader = typeof setCookieValue === 'string'
    ? (setCookieValue.split(';')[0] ?? '')
    : '';

  const sessionRequest = new MockIncomingMessage({
    method: 'GET',
    url: '/auth/session',
    headers: { cookie: cookieHeader },
  });
  const sessionResponse = new MockServerResponse();

  await runtime.handleRequest(
    sessionRequest as unknown as IncomingMessage,
    sessionResponse as unknown as ServerResponse,
  );

  assert.equal(sessionResponse.statusCode, 200);
  const sessionBody = sessionResponse.jsonBody();
  assert.equal(sessionBody.ok, true);
  assert.equal((sessionBody.data as { authenticated: boolean }).authenticated, true);

  const logoutRequest = new MockIncomingMessage({
    method: 'POST',
    url: '/auth/logout',
    headers: { cookie: cookieHeader },
  });
  const logoutResponse = new MockServerResponse();

  await runtime.handleRequest(
    logoutRequest as unknown as IncomingMessage,
    logoutResponse as unknown as ServerResponse,
  );

  assert.equal(logoutResponse.statusCode, 204);

  const sessionAfterLogoutRequest = new MockIncomingMessage({
    method: 'GET',
    url: '/auth/session',
    headers: { cookie: cookieHeader },
  });
  const sessionAfterLogoutResponse = new MockServerResponse();

  await runtime.handleRequest(
    sessionAfterLogoutRequest as unknown as IncomingMessage,
    sessionAfterLogoutResponse as unknown as ServerResponse,
  );

  assert.equal(sessionAfterLogoutResponse.statusCode, 401);
  const sessionAfterLogoutBody = sessionAfterLogoutResponse.jsonBody();
  assert.equal(sessionAfterLogoutBody.ok, false);
});

test('auth HTTP runtime rejects invalid credentials', async () => {
  const hasher = createDefaultPasswordHashRuntime();
  const repositories = createAuthStubRepositories();

  await repositories.users.createUser({
    id: 'user-auth-http-002',
    email: 'member@example.com',
    role: 'member',
    status: 'active',
    passwordHash: await hasher.hashPassword('Valid-Pass-2'),
    passwordAlgo: hasher.passwordAlgorithm,
  });

  const runtime = createAuthHttpRuntime({
    repositories,
    passwordHashing: hasher,
    sessionCookies: createDefaultSessionCookieRuntime(),
  });

  const loginRequest = new MockIncomingMessage({
    method: 'POST',
    url: '/auth/login',
    body: JSON.stringify({ email: 'member@example.com', password: 'wrong-pass' }),
  });
  const loginResponse = new MockServerResponse();

  await runtime.handleRequest(
    loginRequest as unknown as IncomingMessage,
    loginResponse as unknown as ServerResponse,
  );

  assert.equal(loginResponse.statusCode, 401);
  const body = loginResponse.jsonBody();
  assert.equal(body.ok, false);
});

test('auth HTTP runtime supports admin users CRUD operations', async () => {
  const hasher = createDefaultPasswordHashRuntime();
  const repositories = createAuthStubRepositories();
  const sessionCookies = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });

  await repositories.users.createUser({
    id: 'admin-crud-001',
    email: 'admin-crud@example.com',
    role: 'admin',
    status: 'active',
    passwordHash: await hasher.hashPassword('Admin-Crud-Password-1'),
    passwordAlgo: hasher.passwordAlgorithm,
  });

  const runtime = createAuthHttpRuntime({
    repositories,
    passwordHashing: hasher,
    sessionCookies,
    now: () => new Date('2026-04-24T10:00:00.000Z'),
    idGenerator: { nextSessionId: () => 'session-admin-crud-001' },
  });

  const loginRequest = new MockIncomingMessage({
    method: 'POST',
    url: '/auth/login',
    body: JSON.stringify({ email: 'admin-crud@example.com', password: 'Admin-Crud-Password-1' }),
  });
  const loginResponse = new MockServerResponse();

  await runtime.handleRequest(
    loginRequest as unknown as IncomingMessage,
    loginResponse as unknown as ServerResponse,
  );

  assert.equal(loginResponse.statusCode, 200);
  const setCookieHeader = loginResponse.getHeader('set-cookie');
  assert.ok(setCookieHeader);
  const setCookieValue = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  const cookieHeader = typeof setCookieValue === 'string'
    ? (setCookieValue.split(';')[0] ?? '')
    : '';

  const createUserRequest = new MockIncomingMessage({
    method: 'POST',
    url: '/admin/users',
    headers: { cookie: cookieHeader },
    body: JSON.stringify({
      email: 'member-new@example.com',
      role: 'member',
      status: 'active',
      password: 'Member-Password-2',
    }),
  });
  const createUserResponse = new MockServerResponse();

  await runtime.handleRequest(
    createUserRequest as unknown as IncomingMessage,
    createUserResponse as unknown as ServerResponse,
  );

  assert.equal(createUserResponse.statusCode, 201);
  const createdUserPayload = createUserResponse.jsonBody();
  assert.equal(createdUserPayload.ok, true);
  const createdUser = (createdUserPayload.data as { user: { id: string; email: string } }).user;
  assert.equal(createdUser.email, 'member-new@example.com');

  const listUsersRequest = new MockIncomingMessage({
    method: 'GET',
    url: '/admin/users?q=member-new@example.com',
    headers: { cookie: cookieHeader },
  });
  const listUsersResponse = new MockServerResponse();

  await runtime.handleRequest(
    listUsersRequest as unknown as IncomingMessage,
    listUsersResponse as unknown as ServerResponse,
  );

  assert.equal(listUsersResponse.statusCode, 200);
  const listBody = listUsersResponse.jsonBody();
  assert.equal(listBody.ok, true);
  const listedUsers = (listBody.data as { users: Array<{ email: string }> }).users;
  assert.ok(listedUsers.some((user) => user.email === 'member-new@example.com'));

  const patchUserRequest = new MockIncomingMessage({
    method: 'PATCH',
    url: `/admin/users/${createdUser.id}`,
    headers: { cookie: cookieHeader },
    body: JSON.stringify({ role: 'admin', monthlyQuota: 250 }),
  });
  const patchUserResponse = new MockServerResponse();

  await runtime.handleRequest(
    patchUserRequest as unknown as IncomingMessage,
    patchUserResponse as unknown as ServerResponse,
  );

  assert.equal(patchUserResponse.statusCode, 200);
  const patchBody = patchUserResponse.jsonBody();
  assert.equal(patchBody.ok, true);
  const patchedUser = (patchBody.data as { user: { role: string; monthlyQuota: number } }).user;
  assert.equal(patchedUser.role, 'admin');
  assert.equal(patchedUser.monthlyQuota, 250);

  const deleteUserRequest = new MockIncomingMessage({
    method: 'DELETE',
    url: `/admin/users/${createdUser.id}`,
    headers: { cookie: cookieHeader },
  });
  const deleteUserResponse = new MockServerResponse();

  await runtime.handleRequest(
    deleteUserRequest as unknown as IncomingMessage,
    deleteUserResponse as unknown as ServerResponse,
  );

  assert.equal(deleteUserResponse.statusCode, 204);

  const getDeletedUserRequest = new MockIncomingMessage({
    method: 'GET',
    url: `/admin/users/${createdUser.id}`,
    headers: { cookie: cookieHeader },
  });
  const getDeletedUserResponse = new MockServerResponse();

  await runtime.handleRequest(
    getDeletedUserRequest as unknown as IncomingMessage,
    getDeletedUserResponse as unknown as ServerResponse,
  );

  assert.equal(getDeletedUserResponse.statusCode, 200);
  const getDeletedUserBody = getDeletedUserResponse.jsonBody();
  const deletedUser = (getDeletedUserBody.data as { user: { status: string } }).user;
  assert.equal(deletedUser.status, 'disabled');
});

test('auth HTTP runtime denies admin CRUD to non-admin session', async () => {
  const hasher = createDefaultPasswordHashRuntime();
  const repositories = createAuthStubRepositories();
  const sessionCookies = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });

  await repositories.users.createUser({
    id: 'member-crud-001',
    email: 'member-crud@example.com',
    role: 'member',
    status: 'active',
    passwordHash: await hasher.hashPassword('Member-Crud-Password-1'),
    passwordAlgo: hasher.passwordAlgorithm,
  });

  const runtime = createAuthHttpRuntime({
    repositories,
    passwordHashing: hasher,
    sessionCookies,
    now: () => new Date('2026-04-24T10:00:00.000Z'),
    idGenerator: { nextSessionId: () => 'session-member-crud-001' },
  });

  const loginRequest = new MockIncomingMessage({
    method: 'POST',
    url: '/auth/login',
    body: JSON.stringify({ email: 'member-crud@example.com', password: 'Member-Crud-Password-1' }),
  });
  const loginResponse = new MockServerResponse();

  await runtime.handleRequest(
    loginRequest as unknown as IncomingMessage,
    loginResponse as unknown as ServerResponse,
  );

  const setCookieHeader = loginResponse.getHeader('set-cookie');
  assert.ok(setCookieHeader);
  const setCookieValue = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  const cookieHeader = typeof setCookieValue === 'string'
    ? (setCookieValue.split(';')[0] ?? '')
    : '';

  const adminCreateRequest = new MockIncomingMessage({
    method: 'POST',
    url: '/admin/users',
    headers: { cookie: cookieHeader },
    body: JSON.stringify({ email: 'blocked@example.com', role: 'member' }),
  });
  const adminCreateResponse = new MockServerResponse();

  await runtime.handleRequest(
    adminCreateRequest as unknown as IncomingMessage,
    adminCreateResponse as unknown as ServerResponse,
  );

  assert.equal(adminCreateResponse.statusCode, 403);
  const body = adminCreateResponse.jsonBody();
  assert.equal(body.ok, false);
});

test('auth HTTP runtime supports Google OAuth start/callback login flow', async () => {
  const repositories = createAuthStubRepositories();
  const hasher = createDefaultPasswordHashRuntime();
  const sessionCookies = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });

  await repositories.users.createUser({
    id: 'google-user-001',
    email: 'google.user@example.com',
    role: 'member',
    status: 'active',
  });

  const capturedStart: { state?: string; codeVerifier?: string } = {};
  const googleOAuthStub: GoogleOAuthRuntime = {
    redirectUri: 'http://localhost/auth/google/callback',
    buildAuthorizationUrl(input) {
      capturedStart.state = input.state;
      capturedStart.codeVerifier = input.codeVerifier;
      return `https://accounts.google.test/auth?state=${encodeURIComponent(input.state)}`;
    },
    async exchangeCodeForIdentity(input) {
      assert.equal(input.codeVerifier, capturedStart.codeVerifier);
      return {
        providerSubject: 'google-subject-001',
        email: 'google.user@example.com',
        emailVerified: true,
        profile: {
          sub: 'google-subject-001',
          email: 'google.user@example.com',
          email_verified: true,
        },
      };
    },
  };

  const runtime = createAuthHttpRuntime({
    repositories,
    passwordHashing: hasher,
    sessionCookies,
    googleOAuth: googleOAuthStub,
    googleOAuthSuccessRedirectPath: '/app',
    now: () => new Date('2026-04-24T10:00:00.000Z'),
    idGenerator: { nextSessionId: () => 'session-google-001' },
  });

  const startRequest = new MockIncomingMessage({
    method: 'GET',
    url: '/auth/google/start',
  });
  const startResponse = new MockServerResponse();

  await runtime.handleRequest(
    startRequest as unknown as IncomingMessage,
    startResponse as unknown as ServerResponse,
  );

  assert.equal(startResponse.statusCode, 302);
  const location = startResponse.getHeader('location');
  assert.ok(typeof location === 'string');
  assert.ok(location.includes('https://accounts.google.test/auth?state='));
  assert.ok(capturedStart.state);
  assert.ok(capturedStart.codeVerifier);

  const callbackRequest = new MockIncomingMessage({
    method: 'GET',
    url: `/auth/google/callback?state=${encodeURIComponent(capturedStart.state ?? '')}&code=oauth-code-001`,
    headers: { 'user-agent': 'test-google/1.0' },
  });
  const callbackResponse = new MockServerResponse();

  await runtime.handleRequest(
    callbackRequest as unknown as IncomingMessage,
    callbackResponse as unknown as ServerResponse,
  );

  assert.equal(callbackResponse.statusCode, 302);
  assert.equal(callbackResponse.getHeader('location'), '/app');

  const setCookieHeader = callbackResponse.getHeader('set-cookie');
  assert.ok(setCookieHeader);
  const setCookieValue = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  const cookieHeader = typeof setCookieValue === 'string'
    ? (setCookieValue.split(';')[0] ?? '')
    : '';

  const sessionRequest = new MockIncomingMessage({
    method: 'GET',
    url: '/auth/session',
    headers: { cookie: cookieHeader },
  });
  const sessionResponse = new MockServerResponse();

  await runtime.handleRequest(
    sessionRequest as unknown as IncomingMessage,
    sessionResponse as unknown as ServerResponse,
  );

  assert.equal(sessionResponse.statusCode, 200);
  const sessionBody = sessionResponse.jsonBody();
  const sessionData = sessionBody.data as {
    authenticated: boolean;
    session: { authMethod: string };
    user: { email: string };
  };
  assert.equal(sessionData.authenticated, true);
  assert.equal(sessionData.session.authMethod, 'google');
  assert.equal(sessionData.user.email, 'google.user@example.com');
});

test('auth HTTP runtime auto-provisions user on Google OAuth callback when user is missing', async () => {
  const repositories = createAuthStubRepositories();
  const hasher = createDefaultPasswordHashRuntime();
  const sessionCookies = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });

  const capturedStart: { state?: string; codeVerifier?: string } = {};
  const googleOAuthStub: GoogleOAuthRuntime = {
    redirectUri: 'http://localhost/auth/google/callback',
    buildAuthorizationUrl(input) {
      capturedStart.state = input.state;
      capturedStart.codeVerifier = input.codeVerifier;
      return `https://accounts.google.test/auth?state=${encodeURIComponent(input.state)}`;
    },
    async exchangeCodeForIdentity(input) {
      assert.equal(input.codeVerifier, capturedStart.codeVerifier);
      return {
        providerSubject: 'google-subject-new-001',
        email: 'new.google.user@example.com',
        emailVerified: true,
        profile: {
          sub: 'google-subject-new-001',
          email: 'new.google.user@example.com',
          email_verified: true,
        },
      };
    },
  };

  const runtime = createAuthHttpRuntime({
    repositories,
    passwordHashing: hasher,
    sessionCookies,
    googleOAuth: googleOAuthStub,
    googleOAuthSuccessRedirectPath: '/app',
    now: () => new Date('2026-04-24T10:00:00.000Z'),
    idGenerator: { nextSessionId: () => 'session-google-new-user-001' },
  });

  const startRequest = new MockIncomingMessage({
    method: 'GET',
    url: '/auth/google/start',
  });
  const startResponse = new MockServerResponse();

  await runtime.handleRequest(
    startRequest as unknown as IncomingMessage,
    startResponse as unknown as ServerResponse,
  );

  assert.equal(startResponse.statusCode, 302);
  assert.ok(capturedStart.state);
  assert.ok(capturedStart.codeVerifier);

  const callbackRequest = new MockIncomingMessage({
    method: 'GET',
    url: `/auth/google/callback?state=${encodeURIComponent(capturedStart.state ?? '')}&code=oauth-code-new-user-001`,
    headers: { 'user-agent': 'test-google/1.0' },
  });
  const callbackResponse = new MockServerResponse();

  await runtime.handleRequest(
    callbackRequest as unknown as IncomingMessage,
    callbackResponse as unknown as ServerResponse,
  );

  assert.equal(callbackResponse.statusCode, 302);
  assert.equal(callbackResponse.getHeader('location'), '/app');

  const createdUser = await repositories.users.findUserByEmail('new.google.user@example.com');
  assert.ok(createdUser);
  assert.equal(createdUser.role, 'member');
  assert.equal(createdUser.status, 'active');

  const bySubject = await repositories.users.findUserByOAuthSubject('google', 'google-subject-new-001');
  assert.ok(bySubject);
  assert.equal(bySubject.id, createdUser.id);
});

test('auth HTTP runtime supports /api/projects endpoints for authenticated user', async () => {
  const hasher = createDefaultPasswordHashRuntime();
  const repositories = createAuthStubRepositories();
  const sessionCookies = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });
  const projectQueries = new ProjectQueryRepositoryStub({
    randomId: () => 'project-test-001',
    now: () => new Date('2026-04-24T10:00:00.000Z'),
  });

  await repositories.users.createUser({
    id: 'user-projects-001',
    email: 'projects@example.com',
    role: 'member',
    status: 'active',
    passwordHash: await hasher.hashPassword('Projects-Pass-1'),
    passwordAlgo: hasher.passwordAlgorithm,
  });

  const runtime = createAuthHttpRuntime({
    repositories,
    queryRepositories: {
      projects: projectQueries,
      artifacts: new ArtifactQueryRepositoryStub(),
    },
    passwordHashing: hasher,
    sessionCookies,
    now: () => new Date('2026-04-24T10:00:00.000Z'),
    idGenerator: { nextSessionId: () => 'session-projects-001' },
  });

  const loginRequest = new MockIncomingMessage({
    method: 'POST',
    url: '/auth/login',
    body: JSON.stringify({ email: 'projects@example.com', password: 'Projects-Pass-1' }),
  });
  const loginResponse = new MockServerResponse();
  await runtime.handleRequest(
    loginRequest as unknown as IncomingMessage,
    loginResponse as unknown as ServerResponse,
  );

  const cookie = (Array.isArray(loginResponse.getHeader('set-cookie'))
    ? loginResponse.getHeader('set-cookie')?.[0]
    : loginResponse.getHeader('set-cookie')) as string;
  const cookieHeader = cookie.split(';')[0] ?? '';

  const createRequest = new MockIncomingMessage({
    method: 'POST',
    url: '/api/projects',
    headers: { cookie: cookieHeader },
    body: JSON.stringify({ name: 'Project API' }),
  });
  const createResponse = new MockServerResponse();
  await runtime.handleRequest(
    createRequest as unknown as IncomingMessage,
    createResponse as unknown as ServerResponse,
  );

  assert.equal(createResponse.statusCode, 201);
  const createdProject = (createResponse.jsonBody().data as {
    project: { id: string; name: string };
  }).project;
  assert.equal(createdProject.name, 'Project API');

  const listRequest = new MockIncomingMessage({
    method: 'GET',
    url: '/api/projects',
    headers: { cookie: cookieHeader },
  });
  const listResponse = new MockServerResponse();
  await runtime.handleRequest(
    listRequest as unknown as IncomingMessage,
    listResponse as unknown as ServerResponse,
  );

  assert.equal(listResponse.statusCode, 200);
  const projects = (listResponse.jsonBody().data as { projects: Array<{ id: string }> }).projects;
  assert.equal(projects.length, 1);

  const byIdRequest = new MockIncomingMessage({
    method: 'GET',
    url: `/api/projects/${createdProject.id}`,
    headers: { cookie: cookieHeader },
  });
  const byIdResponse = new MockServerResponse();
  await runtime.handleRequest(
    byIdRequest as unknown as IncomingMessage,
    byIdResponse as unknown as ServerResponse,
  );

  assert.equal(byIdResponse.statusCode, 200);
});

test('auth HTTP runtime returns 401/404/400 for projects and artifacts constraints', async () => {
  const hasher = createDefaultPasswordHashRuntime();
  const repositories = createAuthStubRepositories();
  const sessionCookies = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });
  const projectQueries = new ProjectQueryRepositoryStub({
    randomId: () => 'project-test-002',
    now: () => new Date('2026-04-24T10:00:00.000Z'),
  });
  const artifactQueries = new ArtifactQueryRepositoryStub();

  await repositories.users.createUser({
    id: 'user-projects-002',
    email: 'constraints@example.com',
    role: 'member',
    status: 'active',
    passwordHash: await hasher.hashPassword('Constraints-Pass-1'),
    passwordAlgo: hasher.passwordAlgorithm,
  });

  const runtime = createAuthHttpRuntime({
    repositories,
    queryRepositories: {
      projects: projectQueries,
      artifacts: artifactQueries,
    },
    passwordHashing: hasher,
    sessionCookies,
    now: () => new Date('2026-04-24T10:00:00.000Z'),
    idGenerator: { nextSessionId: () => 'session-projects-002' },
  });

  const unauthorizedResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({ method: 'GET', url: '/api/projects' }) as unknown as IncomingMessage,
    unauthorizedResponse as unknown as ServerResponse,
  );
  assert.equal(unauthorizedResponse.statusCode, 401);

  const loginRequest = new MockIncomingMessage({
    method: 'POST',
    url: '/auth/login',
    body: JSON.stringify({ email: 'constraints@example.com', password: 'Constraints-Pass-1' }),
  });
  const loginResponse = new MockServerResponse();
  await runtime.handleRequest(
    loginRequest as unknown as IncomingMessage,
    loginResponse as unknown as ServerResponse,
  );
  const cookie = (Array.isArray(loginResponse.getHeader('set-cookie'))
    ? loginResponse.getHeader('set-cookie')?.[0]
    : loginResponse.getHeader('set-cookie')) as string;
  const cookieHeader = cookie.split(';')[0] ?? '';

  const missingProjectResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'GET',
      url: '/api/projects/not-found',
      headers: { cookie: cookieHeader },
    }) as unknown as IncomingMessage,
    missingProjectResponse as unknown as ServerResponse,
  );
  assert.equal(missingProjectResponse.statusCode, 404);

  const invalidArtifactsFilterResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'GET',
      url: '/api/artifacts?status=invalid_status',
      headers: { cookie: cookieHeader },
    }) as unknown as IncomingMessage,
    invalidArtifactsFilterResponse as unknown as ServerResponse,
  );
  assert.equal(invalidArtifactsFilterResponse.statusCode, 400);

  const missingArtifactResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'GET',
      url: '/api/artifacts/not-found',
      headers: { cookie: cookieHeader },
    }) as unknown as IncomingMessage,
    missingArtifactResponse as unknown as ServerResponse,
  );
  assert.equal(missingArtifactResponse.statusCode, 404);
});

test('auth HTTP runtime supports /api/tools/briefs upload with parser for markdown files', async () => {
  const hasher = createDefaultPasswordHashRuntime();
  const repositories = createAuthStubRepositories();
  const sessionCookies = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });
  const projectQueries = new ProjectQueryRepositoryStub({
    randomId: () => 'project-brief-001',
    now: () => new Date('2026-04-25T10:00:00.000Z'),
  });

  await repositories.users.createUser({
    id: 'user-brief-001',
    email: 'briefs@example.com',
    role: 'member',
    status: 'active',
    passwordHash: await hasher.hashPassword('Brief-Pass-1'),
    passwordAlgo: hasher.passwordAlgorithm,
  });

  const runtime = createAuthHttpRuntime({
    repositories,
    queryRepositories: {
      projects: projectQueries,
      artifacts: new ArtifactQueryRepositoryStub(),
    },
    passwordHashing: hasher,
    sessionCookies,
    now: () => new Date('2026-04-25T10:00:00.000Z'),
    idGenerator: { nextSessionId: () => 'session-brief-001' },
  });

  const loginRequest = new MockIncomingMessage({
    method: 'POST',
    url: '/auth/login',
    body: JSON.stringify({ email: 'briefs@example.com', password: 'Brief-Pass-1' }),
  });
  const loginResponse = new MockServerResponse();
  await runtime.handleRequest(
    loginRequest as unknown as IncomingMessage,
    loginResponse as unknown as ServerResponse,
  );

  const cookie = (Array.isArray(loginResponse.getHeader('set-cookie'))
    ? loginResponse.getHeader('set-cookie')?.[0]
    : loginResponse.getHeader('set-cookie')) as string;
  const cookieHeader = cookie.split(';')[0] ?? '';

  const createProjectRequest = new MockIncomingMessage({
    method: 'POST',
    url: '/api/projects',
    headers: { cookie: cookieHeader },
    body: JSON.stringify({ name: 'Brief Project' }),
  });
  const createProjectResponse = new MockServerResponse();
  await runtime.handleRequest(
    createProjectRequest as unknown as IncomingMessage,
    createProjectResponse as unknown as ServerResponse,
  );

  const projectId = ((createProjectResponse.jsonBody().data as { project: { id: string } }).project.id);
  const markdown = '# Brief\n\nTarget: PMI B2B\n\nOfferta: Audit.';

  const uploadRequest = new MockIncomingMessage({
    method: 'POST',
    url: '/api/tools/briefs',
    headers: { cookie: cookieHeader },
    body: JSON.stringify({
      projectId,
      toolKey: 'funnel-pages',
      fileName: 'brief.md',
      mimeType: 'text/markdown',
      contentBase64: Buffer.from(markdown, 'utf8').toString('base64'),
    }),
  });
  const uploadResponse = new MockServerResponse();
  await runtime.handleRequest(
    uploadRequest as unknown as IncomingMessage,
    uploadResponse as unknown as ServerResponse,
  );

  assert.equal(uploadResponse.statusCode, 201);
  const payload = uploadResponse.jsonBody();
  assert.equal(payload.ok, true);

  const briefing = (payload.data as {
    briefing: {
      briefingId: string;
      fileName: string;
      parsedFormat: string;
      normalizedText: string;
    };
  }).briefing;

  assert.match(briefing.briefingId, /^brief_/);
  assert.equal(briefing.fileName, 'brief.md');
  assert.equal(briefing.parsedFormat, 'md');
  assert.match(briefing.normalizedText, /Target: PMI B2B/);
});

test('auth HTTP runtime rejects /api/tools/briefs when format is not supported', async () => {
  const hasher = createDefaultPasswordHashRuntime();
  const repositories = createAuthStubRepositories();
  const sessionCookies = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });
  const projectQueries = new ProjectQueryRepositoryStub({
    randomId: () => 'project-brief-002',
    now: () => new Date('2026-04-25T10:00:00.000Z'),
  });

  await repositories.users.createUser({
    id: 'user-brief-002',
    email: 'briefs-invalid@example.com',
    role: 'member',
    status: 'active',
    passwordHash: await hasher.hashPassword('Brief-Pass-2'),
    passwordAlgo: hasher.passwordAlgorithm,
  });

  const runtime = createAuthHttpRuntime({
    repositories,
    queryRepositories: {
      projects: projectQueries,
      artifacts: new ArtifactQueryRepositoryStub(),
    },
    passwordHashing: hasher,
    sessionCookies,
    now: () => new Date('2026-04-25T10:00:00.000Z'),
    idGenerator: { nextSessionId: () => 'session-brief-002' },
  });

  const loginRequest = new MockIncomingMessage({
    method: 'POST',
    url: '/auth/login',
    body: JSON.stringify({ email: 'briefs-invalid@example.com', password: 'Brief-Pass-2' }),
  });
  const loginResponse = new MockServerResponse();
  await runtime.handleRequest(
    loginRequest as unknown as IncomingMessage,
    loginResponse as unknown as ServerResponse,
  );

  const cookie = (Array.isArray(loginResponse.getHeader('set-cookie'))
    ? loginResponse.getHeader('set-cookie')?.[0]
    : loginResponse.getHeader('set-cookie')) as string;
  const cookieHeader = cookie.split(';')[0] ?? '';

  const createProjectRequest = new MockIncomingMessage({
    method: 'POST',
    url: '/api/projects',
    headers: { cookie: cookieHeader },
    body: JSON.stringify({ name: 'Invalid Brief Project' }),
  });
  const createProjectResponse = new MockServerResponse();
  await runtime.handleRequest(
    createProjectRequest as unknown as IncomingMessage,
    createProjectResponse as unknown as ServerResponse,
  );

  const projectId = ((createProjectResponse.jsonBody().data as { project: { id: string } }).project.id);

  const uploadRequest = new MockIncomingMessage({
    method: 'POST',
    url: '/api/tools/briefs',
    headers: { cookie: cookieHeader },
    body: JSON.stringify({
      projectId,
      fileName: 'brief.pdf',
      mimeType: 'application/pdf',
      contentBase64: Buffer.from('fake-pdf', 'utf8').toString('base64'),
    }),
  });
  const uploadResponse = new MockServerResponse();
  await runtime.handleRequest(
    uploadRequest as unknown as IncomingMessage,
    uploadResponse as unknown as ServerResponse,
  );

  assert.equal(uploadResponse.statusCode, 400);
  const body = uploadResponse.jsonBody();
  assert.equal(body.ok, false);
});

test('auth HTTP runtime enforces project ownership for /api/tools/briefs', async () => {
  const hasher = createDefaultPasswordHashRuntime();
  const repositories = createAuthStubRepositories();
  const sessionCookies = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });
  const projectQueries = new ProjectQueryRepositoryStub({
    randomId: () => 'project-brief-003',
    now: () => new Date('2026-04-25T10:00:00.000Z'),
  });

  await repositories.users.createUser({
    id: 'user-brief-003',
    email: 'briefs-owner@example.com',
    role: 'member',
    status: 'active',
    passwordHash: await hasher.hashPassword('Brief-Pass-3'),
    passwordAlgo: hasher.passwordAlgorithm,
  });

  const runtime = createAuthHttpRuntime({
    repositories,
    queryRepositories: {
      projects: projectQueries,
      artifacts: new ArtifactQueryRepositoryStub(),
    },
    passwordHashing: hasher,
    sessionCookies,
    now: () => new Date('2026-04-25T10:00:00.000Z'),
    idGenerator: { nextSessionId: () => 'session-brief-003' },
  });

  const foreignProject = await projectQueries.createProjectForUser('another-user', {
    name: 'Foreign Project',
  });

  const loginRequest = new MockIncomingMessage({
    method: 'POST',
    url: '/auth/login',
    body: JSON.stringify({ email: 'briefs-owner@example.com', password: 'Brief-Pass-3' }),
  });
  const loginResponse = new MockServerResponse();
  await runtime.handleRequest(
    loginRequest as unknown as IncomingMessage,
    loginResponse as unknown as ServerResponse,
  );

  const cookie = (Array.isArray(loginResponse.getHeader('set-cookie'))
    ? loginResponse.getHeader('set-cookie')?.[0]
    : loginResponse.getHeader('set-cookie')) as string;
  const cookieHeader = cookie.split(';')[0] ?? '';

  const uploadRequest = new MockIncomingMessage({
    method: 'POST',
    url: '/api/tools/briefs',
    headers: { cookie: cookieHeader },
    body: JSON.stringify({
      projectId: foreignProject.id,
      fileName: 'brief.txt',
      mimeType: 'text/plain',
      contentBase64: Buffer.from('brief text', 'utf8').toString('base64'),
    }),
  });
  const uploadResponse = new MockServerResponse();
  await runtime.handleRequest(
    uploadRequest as unknown as IncomingMessage,
    uploadResponse as unknown as ServerResponse,
  );

  assert.equal(uploadResponse.statusCode, 403);
  const body = uploadResponse.jsonBody();
  assert.equal(body.ok, false);
});

test('auth HTTP runtime hydrates extraction artifact from fenced JSON payload', async () => {
  const hasher = createDefaultPasswordHashRuntime();
  const repositories = createAuthStubRepositories();
  const sessionCookies = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });
  const projectQueries = new ProjectQueryRepositoryStub({
    randomId: () => 'project-hydrate-001',
    now: () => new Date('2026-05-05T10:00:00.000Z'),
  });
  const artifactQueries = new ArtifactQueryRepositoryStub();

  await repositories.users.createUser({
    id: 'user-hydrate-001',
    email: 'hydrate@example.com',
    role: 'member',
    status: 'active',
    passwordHash: await hasher.hashPassword('Hydrate-Pass-1'),
    passwordAlgo: hasher.passwordAlgorithm,
  });

  artifactQueries.seed([
    {
      artifactId: 'artifact-extract-fenced-001',
      requestId: 'req-extract-fenced-001',
      userId: 'user-hydrate-001',
      projectId: 'project-hydrate-001',
      artifactType: 'extraction',
      status: 'completed',
      model: 'openrouter/auto',
      workflowType: 'extraction',
      input: {
        briefingId: 'brief-hydrate-001',
        briefingText: 'brief fenced text',
      },
      content: '```json\n{"payload":{"offer":"audit","audience":"b2b"}}\n```',
      failureReason: null,
      createdAt: '2026-05-05T10:00:00.000Z',
      updatedAt: '2026-05-05T10:00:00.000Z',
    },
  ]);

  const runtime = createAuthHttpRuntime({
    repositories,
    queryRepositories: {
      projects: projectQueries,
      artifacts: artifactQueries,
    },
    passwordHashing: hasher,
    sessionCookies,
    now: () => new Date('2026-05-05T10:00:00.000Z'),
    idGenerator: { nextSessionId: () => 'session-hydrate-001' },
  });

  const loginRequest = new MockIncomingMessage({
    method: 'POST',
    url: '/auth/login',
    body: JSON.stringify({ email: 'hydrate@example.com', password: 'Hydrate-Pass-1' }),
  });
  const loginResponse = new MockServerResponse();
  await runtime.handleRequest(
    loginRequest as unknown as IncomingMessage,
    loginResponse as unknown as ServerResponse,
  );

  const cookie = (Array.isArray(loginResponse.getHeader('set-cookie'))
    ? loginResponse.getHeader('set-cookie')?.[0]
    : loginResponse.getHeader('set-cookie')) as string;
  const cookieHeader = cookie.split(';')[0] ?? '';

  const hydrateRequest = new MockIncomingMessage({
    method: 'POST',
    url: '/api/tools/hydrate',
    headers: { cookie: cookieHeader },
    body: JSON.stringify({
      projectId: 'project-hydrate-001',
      sourceArtifactId: 'artifact-extract-fenced-001',
      intent: 'regenerate',
    }),
  });
  const hydrateResponse = new MockServerResponse();
  await runtime.handleRequest(
    hydrateRequest as unknown as IncomingMessage,
    hydrateResponse as unknown as ServerResponse,
  );

  assert.equal(hydrateResponse.statusCode, 200);
  const payload = hydrateResponse.jsonBody();
  assert.equal(payload.ok, true);
  assert.deepEqual((payload.data as { hydration: { extractionPayload: Record<string, unknown> } }).hydration.extractionPayload, {
    offer: 'audit',
    audience: 'b2b',
  });
});
