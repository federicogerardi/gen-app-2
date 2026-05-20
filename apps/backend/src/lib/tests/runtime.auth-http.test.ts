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

type FeedbackCenterUserReportRecord = {
  id: string;
  category: 'issue' | 'feature-request' | 'other';
  status: 'submitted' | 'triaged' | 'github-published' | 'closed';
  title: string;
  description: string;
  created_by_user_id: string;
  triaged_by_user_id: string | null;
  triaged_at: Date | null;
  closed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type FeedbackCenterProductChangelogRecord = {
  id: string;
  title: string;
  body: string;
  status: 'draft' | 'published';
  created_by_user_id: string;
  published_by_user_id: string | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

class FeedbackCenterDbStub {
  readonly userReports: FeedbackCenterUserReportRecord[] = [];
  readonly changelogs: FeedbackCenterProductChangelogRecord[] = [];

  seedUserReport(record: FeedbackCenterUserReportRecord): void {
    this.userReports.push(record);
  }

  async query<T = unknown>(sqlText: string, values: unknown[] = []): Promise<{ rows: T[] }> {
    if (sqlText.includes('INSERT INTO user_reports')) {
      const createdAt = new Date('2026-05-16T10:00:00.000Z');
      const row: FeedbackCenterUserReportRecord = {
        id: String(values[0]),
        category: String(values[1]) as FeedbackCenterUserReportRecord['category'],
        status: 'submitted',
        title: String(values[2]),
        description: String(values[3]),
        created_by_user_id: String(values[4]),
        triaged_by_user_id: null,
        triaged_at: null,
        closed_at: null,
        created_at: createdAt,
        updated_at: createdAt,
      };
      this.userReports.push(row);
      return { rows: [row as unknown as T] };
    }

    if (
      (
        sqlText.includes('SELECT id, category, status, title, description')
        && sqlText.includes('FROM user_reports')
        && sqlText.includes('WHERE id = $1')
      )
      || (sqlText.includes('FROM user_reports ur') && sqlText.includes('WHERE ur.id = $1'))
    ) {
      const id = String(values[0]);
      const row = this.userReports.find((report) => report.id === id);
      if (!row) {
        return { rows: [] };
      }
      return { rows: [{ ...row, github_issue_url: null } as unknown as T] };
    }

    if (
      (
        sqlText.includes('SELECT id, category, status, title, description')
        && sqlText.includes('FROM user_reports')
        && sqlText.includes('ORDER BY created_at DESC')
      )
      || (sqlText.includes('FROM user_reports ur') && sqlText.includes('ORDER BY ur.created_at DESC'))
    ) {
      let filtered = [...this.userReports];

      const statusFilterClause = sqlText.includes('status = $1') || sqlText.includes('ur.status = $1');
      const categoryFilterClauseAsSecond = sqlText.includes('category = $2') || sqlText.includes('ur.category = $2');
      const categoryFilterClauseAsFirst = sqlText.includes('category = $1') || sqlText.includes('ur.category = $1');

      if (statusFilterClause && categoryFilterClauseAsSecond) {
        filtered = filtered.filter((report) => report.status === values[0] && report.category === values[1]);
      } else if (statusFilterClause) {
        filtered = filtered.filter((report) => report.status === values[0]);
      } else if (categoryFilterClauseAsFirst) {
        filtered = filtered.filter((report) => report.category === values[0]);
      }

      const rowsWithJoinProjection = filtered.map((report) => ({
        ...report,
        github_issue_url: null,
      }));

      return { rows: rowsWithJoinProjection as unknown as T[] };
    }

    if (sqlText.includes('UPDATE user_reports') && sqlText.includes('RETURNING id, category, status, title, description')) {
      const id = String(values[0]);
      const status = String(values[1]) as FeedbackCenterUserReportRecord['status'];
      const actedByUserId = values.length > 2 ? String(values[2]) : null;
      const row = this.userReports.find((report) => report.id === id);
      if (!row) {
        return { rows: [] };
      }

      row.status = status;
      row.updated_at = new Date('2026-05-16T11:00:00.000Z');

      if (status === 'triaged' && actedByUserId) {
        row.triaged_by_user_id = actedByUserId;
        row.triaged_at = new Date('2026-05-16T11:00:00.000Z');
      }

      if (status === 'closed') {
        row.closed_at = new Date('2026-05-16T11:00:00.000Z');
      }

      return { rows: [row as unknown as T] };
    }

    if (sqlText.includes('INSERT INTO product_changelogs')) {
      const createdAt = new Date('2026-05-16T12:00:00.000Z');
      const row: FeedbackCenterProductChangelogRecord = {
        id: String(values[0]),
        title: String(values[1]),
        body: String(values[2]),
        status: 'draft',
        created_by_user_id: String(values[3]),
        published_by_user_id: null,
        published_at: null,
        created_at: createdAt,
        updated_at: createdAt,
      };
      this.changelogs.push(row);
      return { rows: [row as unknown as T] };
    }

    if (sqlText.includes('UPDATE product_changelogs') && sqlText.includes('RETURNING id, title, body, status')) {
      const id = String(values[0]);
      const publishedByUserId = String(values[1]);
      const row = this.changelogs.find((entry) => entry.id === id);
      if (!row) {
        return { rows: [] };
      }

      row.status = 'published';
      row.published_by_user_id = publishedByUserId;
      row.published_at = new Date('2026-05-16T12:30:00.000Z');
      row.updated_at = new Date('2026-05-16T12:30:00.000Z');
      return { rows: [row as unknown as T] };
    }

    if (sqlText.includes('FROM product_changelogs') && sqlText.includes("WHERE status = 'published'")) {
      const rows = this.changelogs.filter((entry) => entry.status === 'published');
      return { rows: rows as unknown as T[] };
    }

    if (sqlText === 'BEGIN' || sqlText === 'COMMIT' || sqlText === 'ROLLBACK') {
      return { rows: [] };
    }

    throw new Error(`Unsupported SQL in FeedbackCenterDbStub: ${sqlText}`);
  }

  async connect(): Promise<{ query: <T = unknown>(sqlText: string, values?: unknown[]) => Promise<{ rows: T[] }>; release: () => void }> {
    return {
      query: <T = unknown>(sqlText: string, values: unknown[] = []) => this.query<T>(sqlText, values),
      release: () => {},
    };
  }
}

const loginAndReadCookie = async (
  runtime: { handleRequest(request: IncomingMessage, response: ServerResponse): Promise<{ handled: boolean }> },
  payload: { email: string; password: string },
): Promise<string> => {
  const loginRequest = new MockIncomingMessage({
    method: 'POST',
    url: '/auth/login',
    body: JSON.stringify(payload),
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
  return (typeof setCookieValue === 'string' ? setCookieValue.split(';')[0] : '') ?? '';
};

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

test('auth HTTP runtime applies session role scope on /api/artifacts listing', async () => {
  const hasher = createDefaultPasswordHashRuntime();
  const repositories = createAuthStubRepositories();
  const sessionCookies = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });
  const projectQueries = new ProjectQueryRepositoryStub({
    randomId: () => 'project-artifacts-scope-001',
    now: () => new Date('2026-04-24T10:30:00.000Z'),
  });
  const artifactQueries = new ArtifactQueryRepositoryStub();
  let sessionOrdinal = 0;

  await repositories.users.createUser({
    id: 'admin-artifacts-001',
    email: 'admin.artifacts@example.com',
    role: 'admin',
    status: 'active',
    passwordHash: await hasher.hashPassword('Admin-Artifacts-1'),
    passwordAlgo: hasher.passwordAlgorithm,
  });

  await repositories.users.createUser({
    id: 'member-artifacts-001',
    email: 'member.artifacts@example.com',
    role: 'member',
    status: 'active',
    passwordHash: await hasher.hashPassword('Member-Artifacts-1'),
    passwordAlgo: hasher.passwordAlgorithm,
  });

  const project = await projectQueries.createProjectForUser('user-hydrate-001', {
    name: 'Hydrate Project',
  });

  artifactQueries.seed([
    {
      artifactId: 'artifact-member-001',
      requestId: 'req-member-001',
      userId: 'member-artifacts-001',
      projectId: 'project-artifacts-scope-001',
      artifactType: 'content',
      status: 'completed',
      model: 'openrouter/auto',
      workflowType: 'funnel_pages',
      input: {},
      content: 'member artifact',
      failureReason: null,
      createdAt: '2026-04-24T10:30:00.000Z',
      updatedAt: '2026-04-24T10:30:00.000Z',
    },
    {
      artifactId: 'artifact-other-001',
      requestId: 'req-other-001',
      userId: 'user-other-001',
      projectId: 'project-artifacts-scope-001',
      artifactType: 'content',
      status: 'completed',
      model: 'openrouter/auto',
      workflowType: 'nextland',
      input: {},
      content: 'other artifact',
      failureReason: null,
      createdAt: '2026-04-24T10:31:00.000Z',
      updatedAt: '2026-04-24T10:31:00.000Z',
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
    now: () => new Date('2026-04-24T10:30:00.000Z'),
    idGenerator: { nextSessionId: () => `session-artifacts-scope-${++sessionOrdinal}` },
  });

  const adminLoginResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'POST',
      url: '/auth/login',
      body: JSON.stringify({ email: 'admin.artifacts@example.com', password: 'Admin-Artifacts-1' }),
    }) as unknown as IncomingMessage,
    adminLoginResponse as unknown as ServerResponse,
  );
  const adminCookie = (Array.isArray(adminLoginResponse.getHeader('set-cookie'))
    ? adminLoginResponse.getHeader('set-cookie')?.[0]
    : adminLoginResponse.getHeader('set-cookie')) as string;
  const adminCookieHeader = adminCookie.split(';')[0] ?? '';

  const memberLoginResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'POST',
      url: '/auth/login',
      body: JSON.stringify({ email: 'member.artifacts@example.com', password: 'Member-Artifacts-1' }),
    }) as unknown as IncomingMessage,
    memberLoginResponse as unknown as ServerResponse,
  );
  const memberCookie = (Array.isArray(memberLoginResponse.getHeader('set-cookie'))
    ? memberLoginResponse.getHeader('set-cookie')?.[0]
    : memberLoginResponse.getHeader('set-cookie')) as string;
  const memberCookieHeader = memberCookie.split(';')[0] ?? '';

  const memberListResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'GET',
      url: '/api/artifacts',
      headers: { cookie: memberCookieHeader },
    }) as unknown as IncomingMessage,
    memberListResponse as unknown as ServerResponse,
  );
  assert.equal(memberListResponse.statusCode, 200);
  const memberPayload = memberListResponse.jsonBody().data as {
    artifacts: Array<{ artifactId: string }>;
    totalResults: number;
  };
  assert.equal(memberPayload.totalResults, 1);
  assert.deepEqual(memberPayload.artifacts.map((artifact) => artifact.artifactId), ['artifact-member-001']);

  const adminListResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'GET',
      url: '/api/artifacts',
      headers: { cookie: adminCookieHeader },
    }) as unknown as IncomingMessage,
    adminListResponse as unknown as ServerResponse,
  );
  assert.equal(adminListResponse.statusCode, 200);
  const adminPayload = adminListResponse.jsonBody().data as {
    artifacts: Array<{ artifactId: string }>;
    totalResults: number;
  };
  assert.equal(adminPayload.totalResults, 2);
  assert.deepEqual(
    adminPayload.artifacts.map((artifact) => artifact.artifactId),
    ['artifact-other-001', 'artifact-member-001'],
  );
});

test('auth HTTP runtime applies session role scope on /api/artifacts/:id detail', async () => {
  const hasher = createDefaultPasswordHashRuntime();
  const repositories = createAuthStubRepositories();
  const sessionCookies = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });
  const projectQueries = new ProjectQueryRepositoryStub({
    randomId: () => 'project-artifacts-detail-scope-001',
    now: () => new Date('2026-04-24T10:30:00.000Z'),
  });
  const artifactQueries = new ArtifactQueryRepositoryStub();
  let sessionOrdinal = 0;

  await repositories.users.createUser({
    id: 'admin-artifacts-detail-001',
    email: 'admin.artifacts.detail@example.com',
    role: 'admin',
    status: 'active',
    passwordHash: await hasher.hashPassword('Admin-Artifacts-Detail-1'),
    passwordAlgo: hasher.passwordAlgorithm,
  });

  await repositories.users.createUser({
    id: 'member-artifacts-detail-001',
    email: 'member.artifacts.detail@example.com',
    role: 'member',
    status: 'active',
    passwordHash: await hasher.hashPassword('Member-Artifacts-Detail-1'),
    passwordAlgo: hasher.passwordAlgorithm,
  });

  const project = await projectQueries.createProjectForUser('user-hydrate-001', {
    name: 'Hydrate Project',
  });

  artifactQueries.seed([
    {
      artifactId: 'artifact-member-detail-001',
      requestId: 'req-member-detail-001',
      userId: 'member-artifacts-detail-001',
      projectId: 'project-artifacts-detail-scope-001',
      artifactType: 'content',
      status: 'completed',
      model: 'openrouter/auto',
      workflowType: 'funnel_pages',
      input: {},
      content: 'member artifact detail',
      failureReason: null,
      createdAt: '2026-04-24T10:30:00.000Z',
      updatedAt: '2026-04-24T10:30:00.000Z',
    },
    {
      artifactId: 'artifact-other-detail-001',
      requestId: 'req-other-detail-001',
      userId: 'user-other-detail-001',
      projectId: 'project-artifacts-detail-scope-001',
      artifactType: 'content',
      status: 'completed',
      model: 'openrouter/auto',
      workflowType: 'nextland',
      input: {},
      content: 'other artifact detail',
      failureReason: null,
      createdAt: '2026-04-24T10:31:00.000Z',
      updatedAt: '2026-04-24T10:31:00.000Z',
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
    now: () => new Date('2026-04-24T10:30:00.000Z'),
    idGenerator: { nextSessionId: () => `session-artifacts-detail-scope-${++sessionOrdinal}` },
  });

  const adminLoginResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'POST',
      url: '/auth/login',
      body: JSON.stringify({ email: 'admin.artifacts.detail@example.com', password: 'Admin-Artifacts-Detail-1' }),
    }) as unknown as IncomingMessage,
    adminLoginResponse as unknown as ServerResponse,
  );
  const adminCookie = (Array.isArray(adminLoginResponse.getHeader('set-cookie'))
    ? adminLoginResponse.getHeader('set-cookie')?.[0]
    : adminLoginResponse.getHeader('set-cookie')) as string;
  const adminCookieHeader = adminCookie.split(';')[0] ?? '';

  const memberLoginResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'POST',
      url: '/auth/login',
      body: JSON.stringify({ email: 'member.artifacts.detail@example.com', password: 'Member-Artifacts-Detail-1' }),
    }) as unknown as IncomingMessage,
    memberLoginResponse as unknown as ServerResponse,
  );
  const memberCookie = (Array.isArray(memberLoginResponse.getHeader('set-cookie'))
    ? memberLoginResponse.getHeader('set-cookie')?.[0]
    : memberLoginResponse.getHeader('set-cookie')) as string;
  const memberCookieHeader = memberCookie.split(';')[0] ?? '';

  const memberOwnDetailResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'GET',
      url: '/api/artifacts/artifact-member-detail-001',
      headers: { cookie: memberCookieHeader },
    }) as unknown as IncomingMessage,
    memberOwnDetailResponse as unknown as ServerResponse,
  );
  assert.equal(memberOwnDetailResponse.statusCode, 200);

  const memberOtherDetailResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'GET',
      url: '/api/artifacts/artifact-other-detail-001',
      headers: { cookie: memberCookieHeader },
    }) as unknown as IncomingMessage,
    memberOtherDetailResponse as unknown as ServerResponse,
  );
  assert.equal(memberOtherDetailResponse.statusCode, 404);

  const adminOtherDetailResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'GET',
      url: '/api/artifacts/artifact-other-detail-001',
      headers: { cookie: adminCookieHeader },
    }) as unknown as IncomingMessage,
    adminOtherDetailResponse as unknown as ServerResponse,
  );
  assert.equal(adminOtherDetailResponse.statusCode, 200);
  const adminDetailPayload = adminOtherDetailResponse.jsonBody().data as {
    artifact: { artifactId: string };
  };
  assert.equal(adminDetailPayload.artifact.artifactId, 'artifact-other-detail-001');
});

test('auth HTTP runtime artifact detail uses slim projection by default and expands when requested', async () => {
  const hasher = createDefaultPasswordHashRuntime();
  const repositories = createAuthStubRepositories();
  const sessionCookies = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });
  const projectQueries = new ProjectQueryRepositoryStub();
  const artifactQueries = new ArtifactQueryRepositoryStub();

  await repositories.users.createUser({
    id: 'member-artifacts-projection-001',
    email: 'member.artifacts.projection@example.com',
    role: 'member',
    status: 'active',
    passwordHash: await hasher.hashPassword('Member-Artifacts-Projection-1'),
    passwordAlgo: hasher.passwordAlgorithm,
  });

  artifactQueries.seed([
    {
      artifactId: 'artifact-projection-001',
      requestId: 'req-projection-001',
      userId: 'member-artifacts-projection-001',
      projectId: 'project-artifacts-projection-001',
      artifactType: 'content',
      status: 'completed',
      model: 'openrouter/auto',
      workflowType: 'funnel_pages',
      input: { briefingText: 'full input payload' },
      content: 'full content payload',
      failureReason: null,
      createdAt: '2026-04-24T10:30:00.000Z',
      updatedAt: '2026-04-24T10:30:00.000Z',
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
    now: () => new Date('2026-04-24T10:30:00.000Z'),
    idGenerator: { nextSessionId: () => 'session-artifacts-projection-001' },
  });

  const loginResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'POST',
      url: '/auth/login',
      body: JSON.stringify({
        email: 'member.artifacts.projection@example.com',
        password: 'Member-Artifacts-Projection-1',
      }),
    }) as unknown as IncomingMessage,
    loginResponse as unknown as ServerResponse,
  );

  const cookie = (Array.isArray(loginResponse.getHeader('set-cookie'))
    ? loginResponse.getHeader('set-cookie')?.[0]
    : loginResponse.getHeader('set-cookie')) as string;
  const cookieHeader = cookie.split(';')[0] ?? '';

  const slimResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'GET',
      url: '/api/artifacts/artifact-projection-001',
      headers: { cookie: cookieHeader },
    }) as unknown as IncomingMessage,
    slimResponse as unknown as ServerResponse,
  );
  assert.equal(slimResponse.statusCode, 200);
  const slimArtifact = (slimResponse.jsonBody().data as { artifact: { input: Record<string, unknown>; content: string } }).artifact;
  assert.deepEqual(slimArtifact.input, {});
  assert.equal(slimArtifact.content, '');

  const fullResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'GET',
      url: '/api/artifacts/artifact-projection-001?includeInput=1&includeContent=1',
      headers: { cookie: cookieHeader },
    }) as unknown as IncomingMessage,
    fullResponse as unknown as ServerResponse,
  );
  assert.equal(fullResponse.statusCode, 200);
  const fullArtifact = (fullResponse.jsonBody().data as { artifact: { input: Record<string, unknown>; content: string } }).artifact;
  assert.deepEqual(fullArtifact.input, { briefingText: 'full input payload' });
  assert.equal(fullArtifact.content, 'full content payload');
});

test('auth HTTP runtime session detail includes content only when requested via projection flag', async () => {
  const hasher = createDefaultPasswordHashRuntime();
  const repositories = createAuthStubRepositories();
  const sessionCookies = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });
  const projectQueries = new ProjectQueryRepositoryStub();
  const artifactQueries = new ArtifactQueryRepositoryStub();

  await repositories.users.createUser({
    id: 'member-session-projection-001',
    email: 'member.session.projection@example.com',
    role: 'member',
    status: 'active',
    passwordHash: await hasher.hashPassword('Member-Session-Projection-1'),
    passwordAlgo: hasher.passwordAlgorithm,
  });

  artifactQueries.seed([
    {
      artifactId: 'artifact-session-projection-001',
      requestId: 'req-session-projection-001',
      userId: 'member-session-projection-001',
      projectId: 'project-session-projection-001',
      artifactType: 'content',
      status: 'completed',
      model: 'openrouter/auto',
      workflowType: 'funnel_pages',
      sessionId: 'sess-projection-001',
      stepKey: 'optin',
      artifactRole: 'step',
      runMode: 'new',
      input: {
        toolWorkflow: {
          toolKey: 'funnel-pages',
          stepKey: 'optin',
        },
      },
      content: 'session content payload',
      failureReason: null,
      createdAt: '2026-04-24T10:30:00.000Z',
      updatedAt: '2026-04-24T10:30:00.000Z',
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
    now: () => new Date('2026-04-24T10:30:00.000Z'),
    idGenerator: { nextSessionId: () => 'session-session-projection-001' },
  });

  const loginResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'POST',
      url: '/auth/login',
      body: JSON.stringify({
        email: 'member.session.projection@example.com',
        password: 'Member-Session-Projection-1',
      }),
    }) as unknown as IncomingMessage,
    loginResponse as unknown as ServerResponse,
  );

  const cookie = (Array.isArray(loginResponse.getHeader('set-cookie'))
    ? loginResponse.getHeader('set-cookie')?.[0]
    : loginResponse.getHeader('set-cookie')) as string;
  const cookieHeader = cookie.split(';')[0] ?? '';

  const slimResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'GET',
      url: '/api/tools/sessions/sess-projection-001',
      headers: { cookie: cookieHeader },
    }) as unknown as IncomingMessage,
    slimResponse as unknown as ServerResponse,
  );
  assert.equal(slimResponse.statusCode, 200);
  const slimSession = (slimResponse.jsonBody().data as {
    session: { artifacts: Array<{ content: string }> };
  }).session;
  assert.equal(slimSession.artifacts[0]?.content, '');

  const fullResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'GET',
      url: '/api/tools/sessions/sess-projection-001?includeContent=1',
      headers: { cookie: cookieHeader },
    }) as unknown as IncomingMessage,
    fullResponse as unknown as ServerResponse,
  );
  assert.equal(fullResponse.statusCode, 200);
  const fullSession = (fullResponse.jsonBody().data as {
    session: { artifacts: Array<{ content: string }> };
  }).session;
  assert.equal(fullSession.artifacts[0]?.content, 'session content payload');
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
      toolKey: string | null;
      fileName: string;
      parsedFormat: string;
      normalizedText: string;
    };
  }).briefing;

  assert.match(briefing.briefingId, /^brief_/);
  assert.equal(briefing.fileName, 'brief.md');
  assert.equal(briefing.parsedFormat, 'md');
  assert.match(briefing.normalizedText, /Target: PMI B2B/);
  assert.equal(briefing.toolKey, 'funnel-pages');
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

test('auth HTTP runtime accepts /api/tools/briefs toolKey from query and body takes precedence', async () => {
  const hasher = createDefaultPasswordHashRuntime();
  const repositories = createAuthStubRepositories();
  const sessionCookies = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });
  const projectQueries = new ProjectQueryRepositoryStub({
    randomId: () => 'project-brief-004',
    now: () => new Date('2026-04-25T10:00:00.000Z'),
  });

  await repositories.users.createUser({
    id: 'user-brief-004',
    email: 'briefs-precedence@example.com',
    role: 'member',
    status: 'active',
    passwordHash: await hasher.hashPassword('Brief-Pass-4'),
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
    idGenerator: { nextSessionId: () => 'session-brief-004' },
  });

  const loginRequest = new MockIncomingMessage({
    method: 'POST',
    url: '/auth/login',
    body: JSON.stringify({ email: 'briefs-precedence@example.com', password: 'Brief-Pass-4' }),
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
    body: JSON.stringify({ name: 'Brief Precedence Project' }),
  });
  const createProjectResponse = new MockServerResponse();
  await runtime.handleRequest(
    createProjectRequest as unknown as IncomingMessage,
    createProjectResponse as unknown as ServerResponse,
  );

  const projectId = ((createProjectResponse.jsonBody().data as { project: { id: string } }).project.id);

  const uploadRequest = new MockIncomingMessage({
    method: 'POST',
    url: '/api/tools/briefs?toolKey=nextland',
    headers: { cookie: cookieHeader },
    body: JSON.stringify({
      projectId,
      toolKey: 'youtube-lf-script',
      fileName: 'brief.md',
      mimeType: 'text/markdown',
      contentBase64: Buffer.from('# Brief', 'utf8').toString('base64'),
    }),
  });
  const uploadResponse = new MockServerResponse();
  await runtime.handleRequest(
    uploadRequest as unknown as IncomingMessage,
    uploadResponse as unknown as ServerResponse,
  );

  assert.equal(uploadResponse.statusCode, 201);
  const briefing = (uploadResponse.jsonBody().data as { briefing: { toolKey: string } }).briefing;
  assert.equal(briefing.toolKey, 'youtube-lf-script');
});

test('auth HTTP runtime rejects /api/tools/briefs when toolKey is missing in query and body', async () => {
  const hasher = createDefaultPasswordHashRuntime();
  const repositories = createAuthStubRepositories();
  const sessionCookies = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });
  const projectQueries = new ProjectQueryRepositoryStub({
    randomId: () => 'project-brief-005',
    now: () => new Date('2026-04-25T10:00:00.000Z'),
  });

  await repositories.users.createUser({
    id: 'user-brief-005',
    email: 'briefs-missing-tool@example.com',
    role: 'member',
    status: 'active',
    passwordHash: await hasher.hashPassword('Brief-Pass-5'),
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
    idGenerator: { nextSessionId: () => 'session-brief-005' },
  });

  const loginRequest = new MockIncomingMessage({
    method: 'POST',
    url: '/auth/login',
    body: JSON.stringify({ email: 'briefs-missing-tool@example.com', password: 'Brief-Pass-5' }),
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
    body: JSON.stringify({ name: 'Brief Missing Tool Project' }),
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
      fileName: 'brief.md',
      mimeType: 'text/markdown',
      contentBase64: Buffer.from('# Brief', 'utf8').toString('base64'),
    }),
  });
  const uploadResponse = new MockServerResponse();
  await runtime.handleRequest(
    uploadRequest as unknown as IncomingMessage,
    uploadResponse as unknown as ServerResponse,
  );

  assert.equal(uploadResponse.statusCode, 400);
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
      toolKey: 'funnel-pages',
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

  const project = await projectQueries.createProjectForUser('user-hydrate-001', {
    name: 'Hydrate Project',
  });

  artifactQueries.seed([
    {
      artifactId: 'artifact-extract-fenced-001',
      requestId: 'req-extract-fenced-001',
      userId: 'user-hydrate-001',
      projectId: project.id,
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
      projectId: project.id,
      sourceArtifactId: 'artifact-extract-fenced-001',
      resolvedBriefingId: 'brief-hydrate-001',
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

test('auth HTTP runtime hydrate filters by resolvedBriefingId and ignores newer unrelated extraction artifacts', async () => {
  const hasher = createDefaultPasswordHashRuntime();
  const repositories = createAuthStubRepositories();
  const sessionCookies = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });
  const projectQueries = new ProjectQueryRepositoryStub({
    randomId: () => 'project-hydrate-002',
    now: () => new Date('2026-05-06T10:00:00.000Z'),
  });
  const artifactQueries = new ArtifactQueryRepositoryStub();

  await repositories.users.createUser({
    id: 'user-hydrate-002',
    email: 'hydrate2@example.com',
    role: 'member',
    status: 'active',
    passwordHash: await hasher.hashPassword('Hydrate-Pass-2'),
    passwordAlgo: hasher.passwordAlgorithm,
  });

  const project = await projectQueries.createProjectForUser('user-hydrate-002', {
    name: 'Hydrate Project 2',
  });

  artifactQueries.seed([
    {
      artifactId: 'artifact-extract-brief-a-older',
      requestId: 'req-extract-brief-a-older',
      userId: 'user-hydrate-002',
      projectId: project.id,
      artifactType: 'extraction',
      status: 'completed',
      model: 'openrouter/auto',
      workflowType: 'extraction',
      input: {
        briefingId: 'brief-a',
        briefingText: 'brief a text',
      },
      content: '{"payload":{"topic":"A"}}',
      failureReason: null,
      createdAt: '2026-05-06T09:00:00.000Z',
      updatedAt: '2026-05-06T09:00:00.000Z',
    },
    {
      artifactId: 'artifact-extract-brief-b-newer',
      requestId: 'req-extract-brief-b-newer',
      userId: 'user-hydrate-002',
      projectId: project.id,
      artifactType: 'extraction',
      status: 'completed',
      model: 'openrouter/auto',
      workflowType: 'extraction',
      input: {
        briefingId: 'brief-b',
        briefingText: 'brief b text',
      },
      content: '{"payload":{"topic":"B"}}',
      failureReason: null,
      createdAt: '2026-05-06T10:00:00.000Z',
      updatedAt: '2026-05-06T10:00:00.000Z',
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
    now: () => new Date('2026-05-06T10:00:00.000Z'),
    idGenerator: { nextSessionId: () => 'session-hydrate-002' },
  });

  const cookieHeader = await loginAndReadCookie(runtime, {
    email: 'hydrate2@example.com',
    password: 'Hydrate-Pass-2',
  });

  const hydrateResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'POST',
      url: '/api/tools/hydrate',
      headers: { cookie: cookieHeader },
      body: JSON.stringify({
        projectId: project.id,
        resolvedBriefingId: 'brief-a',
        intent: 'regenerate',
      }),
    }) as unknown as IncomingMessage,
    hydrateResponse as unknown as ServerResponse,
  );

  assert.equal(hydrateResponse.statusCode, 200);
  const payload = hydrateResponse.jsonBody();
  const hydration = (payload.data as {
    hydration: { extractionArtifactId: string; briefingId: string; extractionPayload: Record<string, unknown> };
  }).hydration;
  assert.equal(hydration.extractionArtifactId, 'artifact-extract-brief-a-older');
  assert.equal(hydration.briefingId, 'brief-a');
  assert.deepEqual(hydration.extractionPayload, { topic: 'A' });
});

test('auth HTTP runtime hydrate returns no_extraction_for_briefing when resolvedBriefingId has no coherent candidate', async () => {
  const hasher = createDefaultPasswordHashRuntime();
  const repositories = createAuthStubRepositories();
  const sessionCookies = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });
  const projectQueries = new ProjectQueryRepositoryStub({
    randomId: () => 'project-hydrate-003',
    now: () => new Date('2026-05-07T10:00:00.000Z'),
  });
  const artifactQueries = new ArtifactQueryRepositoryStub();

  await repositories.users.createUser({
    id: 'user-hydrate-003',
    email: 'hydrate3@example.com',
    role: 'member',
    status: 'active',
    passwordHash: await hasher.hashPassword('Hydrate-Pass-3'),
    passwordAlgo: hasher.passwordAlgorithm,
  });

  const project = await projectQueries.createProjectForUser('user-hydrate-003', {
    name: 'Hydrate Project 3',
  });

  artifactQueries.seed([
    {
      artifactId: 'artifact-extract-brief-x',
      requestId: 'req-extract-brief-x',
      userId: 'user-hydrate-003',
      projectId: project.id,
      artifactType: 'extraction',
      status: 'completed',
      model: 'openrouter/auto',
      workflowType: 'extraction',
      input: {
        briefingId: 'brief-x',
        briefingText: 'brief x text',
      },
      content: '{"payload":{"topic":"X"}}',
      failureReason: null,
      createdAt: '2026-05-07T10:00:00.000Z',
      updatedAt: '2026-05-07T10:00:00.000Z',
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
    now: () => new Date('2026-05-07T10:00:00.000Z'),
    idGenerator: { nextSessionId: () => 'session-hydrate-003' },
  });

  const cookieHeader = await loginAndReadCookie(runtime, {
    email: 'hydrate3@example.com',
    password: 'Hydrate-Pass-3',
  });

  const hydrateResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'POST',
      url: '/api/tools/hydrate',
      headers: { cookie: cookieHeader },
      body: JSON.stringify({
        projectId: project.id,
        resolvedBriefingId: 'brief-missing',
        intent: 'regenerate',
      }),
    }) as unknown as IncomingMessage,
    hydrateResponse as unknown as ServerResponse,
  );

  assert.equal(hydrateResponse.statusCode, 404);
  const payload = hydrateResponse.jsonBody();
  assert.equal(payload.ok, false);
  assert.equal((payload.error as { code: string }).code, 'no_extraction_for_briefing');
});

test('auth HTTP runtime hydrate supports legacy fallback where resolvedBriefingId matches artifactId', async () => {
  const hasher = createDefaultPasswordHashRuntime();
  const repositories = createAuthStubRepositories();
  const sessionCookies = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });
  const projectQueries = new ProjectQueryRepositoryStub({
    randomId: () => 'project-hydrate-004',
    now: () => new Date('2026-05-08T10:00:00.000Z'),
  });
  const artifactQueries = new ArtifactQueryRepositoryStub();

  await repositories.users.createUser({
    id: 'user-hydrate-004',
    email: 'hydrate4@example.com',
    role: 'member',
    status: 'active',
    passwordHash: await hasher.hashPassword('Hydrate-Pass-4'),
    passwordAlgo: hasher.passwordAlgorithm,
  });

  const project = await projectQueries.createProjectForUser('user-hydrate-004', {
    name: 'Hydrate Project 4',
  });

  artifactQueries.seed([
    {
      artifactId: 'legacy-brief-id',
      requestId: 'req-legacy-brief-id',
      userId: 'user-hydrate-004',
      projectId: project.id,
      artifactType: 'extraction',
      status: 'completed',
      model: 'openrouter/auto',
      workflowType: 'extraction',
      input: {
        briefingText: 'legacy brief text',
      },
      content: '{"payload":{"topic":"legacy"}}',
      failureReason: null,
      createdAt: '2026-05-08T09:00:00.000Z',
      updatedAt: '2026-05-08T09:00:00.000Z',
    },
    {
      artifactId: 'artifact-extract-other-briefing',
      requestId: 'req-extract-other-briefing',
      userId: 'user-hydrate-004',
      projectId: project.id,
      artifactType: 'extraction',
      status: 'completed',
      model: 'openrouter/auto',
      workflowType: 'extraction',
      input: {
        briefingId: 'brief-other',
        briefingText: 'other brief text',
      },
      content: '{"payload":{"topic":"other"}}',
      failureReason: null,
      createdAt: '2026-05-08T10:00:00.000Z',
      updatedAt: '2026-05-08T10:00:00.000Z',
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
    now: () => new Date('2026-05-08T10:00:00.000Z'),
    idGenerator: { nextSessionId: () => 'session-hydrate-004' },
  });

  const cookieHeader = await loginAndReadCookie(runtime, {
    email: 'hydrate4@example.com',
    password: 'Hydrate-Pass-4',
  });

  const hydrateResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'POST',
      url: '/api/tools/hydrate',
      headers: { cookie: cookieHeader },
      body: JSON.stringify({
        projectId: project.id,
        resolvedBriefingId: 'legacy-brief-id',
        intent: 'regenerate',
      }),
    }) as unknown as IncomingMessage,
    hydrateResponse as unknown as ServerResponse,
  );

  assert.equal(hydrateResponse.statusCode, 200);
  const payload = hydrateResponse.jsonBody();
  const hydration = (payload.data as {
    hydration: { extractionArtifactId: string; briefingId: string; extractionPayload: Record<string, unknown> };
  }).hydration;
  assert.equal(hydration.extractionArtifactId, 'legacy-brief-id');
  assert.equal(hydration.briefingId, 'legacy-brief-id');
  assert.deepEqual(hydration.extractionPayload, { topic: 'legacy' });
});

test('auth HTTP runtime hydrate prioritizes sourceExtractionArtifactId within coherent candidates', async () => {
  const hasher = createDefaultPasswordHashRuntime();
  const repositories = createAuthStubRepositories();
  const sessionCookies = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });
  const projectQueries = new ProjectQueryRepositoryStub({
    randomId: () => 'project-hydrate-005',
    now: () => new Date('2026-05-09T10:00:00.000Z'),
  });
  const artifactQueries = new ArtifactQueryRepositoryStub();

  await repositories.users.createUser({
    id: 'user-hydrate-005',
    email: 'hydrate5@example.com',
    role: 'member',
    status: 'active',
    passwordHash: await hasher.hashPassword('Hydrate-Pass-5'),
    passwordAlgo: hasher.passwordAlgorithm,
  });

  const project = await projectQueries.createProjectForUser('user-hydrate-005', {
    name: 'Hydrate Project 5',
  });

  artifactQueries.seed([
    {
      artifactId: 'artifact-extract-brief-target-old-source',
      requestId: 'req-extract-brief-target-old-source',
      userId: 'user-hydrate-005',
      projectId: project.id,
      artifactType: 'extraction',
      status: 'completed',
      model: 'openrouter/auto',
      workflowType: 'extraction',
      input: {
        briefingId: 'brief-target',
        briefingText: 'brief target source text',
      },
      content: '{"payload":{"topic":"source"}}',
      failureReason: null,
      createdAt: '2026-05-09T08:00:00.000Z',
      updatedAt: '2026-05-09T08:00:00.000Z',
    },
    {
      artifactId: 'artifact-extract-brief-target-newer',
      requestId: 'req-extract-brief-target-newer',
      userId: 'user-hydrate-005',
      projectId: project.id,
      artifactType: 'extraction',
      status: 'completed',
      model: 'openrouter/auto',
      workflowType: 'extraction',
      input: {
        briefingId: 'brief-target',
        briefingText: 'brief target newer text',
      },
      content: '{"payload":{"topic":"newer"}}',
      failureReason: null,
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
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
    now: () => new Date('2026-05-09T10:00:00.000Z'),
    idGenerator: { nextSessionId: () => 'session-hydrate-005' },
  });

  const cookieHeader = await loginAndReadCookie(runtime, {
    email: 'hydrate5@example.com',
    password: 'Hydrate-Pass-5',
  });

  const hydrateResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'POST',
      url: '/api/tools/hydrate',
      headers: { cookie: cookieHeader },
      body: JSON.stringify({
        projectId: project.id,
        resolvedBriefingId: 'brief-target',
        sourceExtractionArtifactId: 'artifact-extract-brief-target-old-source',
        intent: 'regenerate',
      }),
    }) as unknown as IncomingMessage,
    hydrateResponse as unknown as ServerResponse,
  );

  assert.equal(hydrateResponse.statusCode, 200);
  const payload = hydrateResponse.jsonBody();
  const hydration = (payload.data as {
    hydration: { extractionArtifactId: string; briefingId: string; extractionPayload: Record<string, unknown> };
  }).hydration;
  assert.equal(hydration.extractionArtifactId, 'artifact-extract-brief-target-old-source');
  assert.equal(hydration.briefingId, 'brief-target');
  assert.deepEqual(hydration.extractionPayload, { topic: 'source' });
});

test('auth HTTP runtime hydrate keeps coherence on content-artifact resume path', async () => {
  const hasher = createDefaultPasswordHashRuntime();
  const repositories = createAuthStubRepositories();
  const sessionCookies = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });
  const projectQueries = new ProjectQueryRepositoryStub({
    randomId: () => 'project-hydrate-006',
    now: () => new Date('2026-05-10T10:00:00.000Z'),
  });
  const artifactQueries = new ArtifactQueryRepositoryStub();

  await repositories.users.createUser({
    id: 'user-hydrate-006',
    email: 'hydrate6@example.com',
    role: 'member',
    status: 'active',
    passwordHash: await hasher.hashPassword('Hydrate-Pass-6'),
    passwordAlgo: hasher.passwordAlgorithm,
  });

  const project = await projectQueries.createProjectForUser('user-hydrate-006', {
    name: 'Hydrate Project 6',
  });

  artifactQueries.seed([
    {
      artifactId: 'artifact-extract-brief-target',
      requestId: 'req-extract-brief-target',
      userId: 'user-hydrate-006',
      projectId: project.id,
      artifactType: 'extraction',
      status: 'completed',
      model: 'openrouter/auto',
      workflowType: 'extraction',
      input: {
        briefingId: 'brief-target',
        briefingText: 'target briefing text',
      },
      content: '{"payload":{"topic":"target"}}',
      failureReason: null,
      createdAt: '2026-05-10T08:00:00.000Z',
      updatedAt: '2026-05-10T08:00:00.000Z',
    },
    {
      artifactId: 'artifact-extract-brief-other-newer',
      requestId: 'req-extract-brief-other-newer',
      userId: 'user-hydrate-006',
      projectId: project.id,
      artifactType: 'extraction',
      status: 'completed',
      model: 'openrouter/auto',
      workflowType: 'extraction',
      input: {
        briefingId: 'brief-other',
        briefingText: 'other briefing text',
      },
      content: '{"payload":{"topic":"other"}}',
      failureReason: null,
      createdAt: '2026-05-10T10:00:00.000Z',
      updatedAt: '2026-05-10T10:00:00.000Z',
    },
    {
      artifactId: 'artifact-content-resume-source',
      requestId: 'req-content-resume-source',
      userId: 'user-hydrate-006',
      projectId: project.id,
      artifactType: 'content',
      status: 'completed',
      model: 'openrouter/auto',
      workflowType: 'funnel_pages',
      input: {
        briefingId: 'brief-target',
        extractionArtifactId: 'artifact-extract-brief-target',
      },
      content: 'content artifact output',
      failureReason: null,
      createdAt: '2026-05-10T09:00:00.000Z',
      updatedAt: '2026-05-10T09:00:00.000Z',
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
    now: () => new Date('2026-05-10T10:00:00.000Z'),
    idGenerator: { nextSessionId: () => 'session-hydrate-006' },
  });

  const cookieHeader = await loginAndReadCookie(runtime, {
    email: 'hydrate6@example.com',
    password: 'Hydrate-Pass-6',
  });

  const hydrateResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'POST',
      url: '/api/tools/hydrate',
      headers: { cookie: cookieHeader },
      body: JSON.stringify({
        projectId: project.id,
        sourceArtifactId: 'artifact-content-resume-source',
        resolvedBriefingId: 'brief-target',
        intent: 'resume',
      }),
    }) as unknown as IncomingMessage,
    hydrateResponse as unknown as ServerResponse,
  );

  assert.equal(hydrateResponse.statusCode, 200);
  const payload = hydrateResponse.jsonBody();
  const hydration = (payload.data as {
    hydration: { extractionArtifactId: string; briefingId: string; extractionPayload: Record<string, unknown> };
  }).hydration;
  assert.equal(hydration.extractionArtifactId, 'artifact-extract-brief-target');
  assert.equal(hydration.briefingId, 'brief-target');
  assert.deepEqual(hydration.extractionPayload, { topic: 'target' });
});

test('auth HTTP runtime supports feedback-center report/changelog endpoints with auth and normalization', async () => {
  const hasher = createDefaultPasswordHashRuntime();
  const repositories = createAuthStubRepositories();
  const sessionCookies = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });
  const db = new FeedbackCenterDbStub();

  await repositories.users.createUser({
    id: 'admin-feedback-001',
    email: 'admin.feedback@example.com',
    role: 'admin',
    status: 'active',
    passwordHash: await hasher.hashPassword('Admin-Feedback-1'),
    passwordAlgo: hasher.passwordAlgorithm,
  });

  await repositories.users.createUser({
    id: 'member-feedback-001',
    email: 'member.feedback@example.com',
    role: 'member',
    status: 'active',
    passwordHash: await hasher.hashPassword('Member-Feedback-1'),
    passwordAlgo: hasher.passwordAlgorithm,
  });

  const runtime = createAuthHttpRuntime({
    repositories,
    db: db as never,
    passwordHashing: hasher,
    sessionCookies,
    now: () => new Date('2026-05-16T10:00:00.000Z'),
    idGenerator: { nextSessionId: () => `session-feedback-${Math.random().toString(16).slice(2)}` },
  });

  const unauthorizedCreateResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'POST',
      url: '/api/user-reports',
      body: JSON.stringify({ category: 'issue', title: 'T', description: 'D' }),
    }) as unknown as IncomingMessage,
    unauthorizedCreateResponse as unknown as ServerResponse,
  );
  assert.equal(unauthorizedCreateResponse.statusCode, 401);

  const memberCookie = await loginAndReadCookie(runtime, {
    email: 'member.feedback@example.com',
    password: 'Member-Feedback-1',
  });

  const createReportResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'POST',
      url: '/api/user-reports',
      headers: { cookie: memberCookie },
      body: JSON.stringify({
        category: 'ISSUE',
        title: 'Cannot save project',
        description: 'Save action fails with 500.',
      }),
    }) as unknown as IncomingMessage,
    createReportResponse as unknown as ServerResponse,
  );

  assert.equal(createReportResponse.statusCode, 201);
  const createdReport = (createReportResponse.jsonBody().data as {
    report: { category: string; status: string; id: string };
  }).report;
  assert.equal(createdReport.category, 'issue');
  assert.equal(createdReport.status, 'submitted');

  const invalidCategoryResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'POST',
      url: '/api/user-reports',
      headers: { cookie: memberCookie },
      body: JSON.stringify({
        category: 'bug',
        title: 'Invalid category',
        description: 'Should fail',
      }),
    }) as unknown as IncomingMessage,
    invalidCategoryResponse as unknown as ServerResponse,
  );
  assert.equal(invalidCategoryResponse.statusCode, 400);

  const forbiddenListResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'GET',
      url: '/api/admin/user-reports',
      headers: { cookie: memberCookie },
    }) as unknown as IncomingMessage,
    forbiddenListResponse as unknown as ServerResponse,
  );
  assert.equal(forbiddenListResponse.statusCode, 403);

  const adminCookie = await loginAndReadCookie(runtime, {
    email: 'admin.feedback@example.com',
    password: 'Admin-Feedback-1',
  });

  const publishChangelogResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'POST',
      url: '/api/admin/changelog',
      headers: { cookie: adminCookie },
      body: JSON.stringify({ title: 'Release 1.2.0', body: 'Published changes', status: 'published' }),
    }) as unknown as IncomingMessage,
    publishChangelogResponse as unknown as ServerResponse,
  );
  assert.equal(publishChangelogResponse.statusCode, 201);

  const listChangelogResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'GET',
      url: '/api/changelog',
      headers: { cookie: memberCookie },
    }) as unknown as IncomingMessage,
    listChangelogResponse as unknown as ServerResponse,
  );
  assert.equal(listChangelogResponse.statusCode, 200);
  const listedChangelog = (listChangelogResponse.jsonBody().data as { changelog: Array<{ status: string }> }).changelog;
  assert.equal(listedChangelog.length, 1);
  assert.equal(listedChangelog[0]?.status, 'published');
});

test('auth HTTP runtime enforces user-report admin validation, triage updates, and issue policy rejection', async () => {
  const hasher = createDefaultPasswordHashRuntime();
  const repositories = createAuthStubRepositories();
  const sessionCookies = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });
  const db = new FeedbackCenterDbStub();

  await repositories.users.createUser({
    id: 'admin-feedback-002',
    email: 'admin.feedback2@example.com',
    role: 'admin',
    status: 'active',
    passwordHash: await hasher.hashPassword('Admin-Feedback-2'),
    passwordAlgo: hasher.passwordAlgorithm,
  });

  db.seedUserReport({
    id: 'rpt_seed_issue_001',
    category: 'issue',
    status: 'submitted',
    title: 'Issue seed',
    description: 'Issue report',
    created_by_user_id: 'member-feedback-xxx',
    triaged_by_user_id: null,
    triaged_at: null,
    closed_at: null,
    created_at: new Date('2026-05-16T09:00:00.000Z'),
    updated_at: new Date('2026-05-16T09:00:00.000Z'),
  });

  db.seedUserReport({
    id: 'rpt_seed_other_001',
    category: 'other',
    status: 'submitted',
    title: 'Other seed',
    description: 'Other report',
    created_by_user_id: 'member-feedback-yyy',
    triaged_by_user_id: null,
    triaged_at: null,
    closed_at: null,
    created_at: new Date('2026-05-16T09:10:00.000Z'),
    updated_at: new Date('2026-05-16T09:10:00.000Z'),
  });

  const runtime = createAuthHttpRuntime({
    repositories,
    db: db as never,
    passwordHashing: hasher,
    sessionCookies,
    now: () => new Date('2026-05-16T10:00:00.000Z'),
    idGenerator: { nextSessionId: () => `session-feedback-${Math.random().toString(16).slice(2)}` },
  });

  const adminCookie = await loginAndReadCookie(runtime, {
    email: 'admin.feedback2@example.com',
    password: 'Admin-Feedback-2',
  });

  const invalidStatusFilterResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'GET',
      url: '/api/admin/user-reports?status=invalid',
      headers: { cookie: adminCookie },
    }) as unknown as IncomingMessage,
    invalidStatusFilterResponse as unknown as ServerResponse,
  );
  assert.equal(invalidStatusFilterResponse.statusCode, 400);

  const filteredListResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'GET',
      url: '/api/admin/user-reports?category=issue',
      headers: { cookie: adminCookie },
    }) as unknown as IncomingMessage,
    filteredListResponse as unknown as ServerResponse,
  );
  assert.equal(filteredListResponse.statusCode, 200);
  const filteredReports = (filteredListResponse.jsonBody().data as { reports: Array<{ id: string }> }).reports;
  assert.deepEqual(filteredReports.map((item) => item.id), ['rpt_seed_issue_001']);

  const invalidPatchResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'PATCH',
      url: '/api/admin/user-reports/rpt_seed_issue_001',
      headers: { cookie: adminCookie },
      body: JSON.stringify({ status: 'github-published' }),
    }) as unknown as IncomingMessage,
    invalidPatchResponse as unknown as ServerResponse,
  );
  assert.equal(invalidPatchResponse.statusCode, 400);

  const patchResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'PATCH',
      url: '/api/admin/user-reports/rpt_seed_issue_001',
      headers: { cookie: adminCookie },
      body: JSON.stringify({ status: 'triaged' }),
    }) as unknown as IncomingMessage,
    patchResponse as unknown as ServerResponse,
  );
  assert.equal(patchResponse.statusCode, 200);
  const patchedReport = (patchResponse.jsonBody().data as { report: { status: string } }).report;
  assert.equal(patchedReport.status, 'triaged');

  const publishIssueRejectedResponse = new MockServerResponse();
  await runtime.handleRequest(
    new MockIncomingMessage({
      method: 'POST',
      url: '/api/admin/user-reports/rpt_seed_other_001/publish-issue',
      headers: { cookie: adminCookie },
      body: JSON.stringify({ owner: 'acme', repo: 'platform' }),
    }) as unknown as IncomingMessage,
    publishIssueRejectedResponse as unknown as ServerResponse,
  );
  assert.equal(publishIssueRejectedResponse.statusCode, 409);
});
