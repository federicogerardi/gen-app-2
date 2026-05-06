import type {
  AuthMethod,
  AuthSessionPrincipal,
  AuthSessionRecord,
  AuthUserRecord,
  CreateAuthSessionInput,
  CreateAuthUserInput,
  CreateOAuthStateTokenInput,
  LinkOAuthAccountInput,
  OAuthAccountRecord,
  OAuthProvider,
  OAuthStateTokenRecord,
  RevokeAuthSessionsInput,
  SetAuthUserPasswordInput,
  UpdateAuthUserInput,
} from '../types/auth';

import type {
  AuthRepositoryBundle,
  AuthSessionRepository,
  AuthUserRepository,
  OAuthStateRepository,
} from './auth.interfaces';
import type { ProductionAdapterRuntime } from './postgres-redis.interfaces';

const toIsoNow = (runtime?: ProductionAdapterRuntime): string =>
  (runtime?.now ?? (() => new Date()))().toISOString();

const maybeDateToIso = (value: Date | null | undefined, runtime?: ProductionAdapterRuntime): string | null => {
  if (value === null) {
    return null;
  }

  if (value === undefined) {
    return toIsoNow(runtime);
  }

  return value.toISOString();
};

const normalizePrincipal = (
  session: AuthSessionRecord,
  user: AuthUserRecord,
): AuthSessionPrincipal => {
  return {
    session,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    },
  };
};

export class AuthUserRepositoryStub implements AuthUserRepository {
  private readonly users = new Map<string, AuthUserRecord>();
  private readonly oauthAccounts = new Map<string, OAuthAccountRecord>();
  private oauthAccountSequence = 0;

  constructor(private readonly runtime?: ProductionAdapterRuntime) {}

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === email.toLowerCase()) {
        return { ...user };
      }
    }

    return null;
  }

  async findUserById(userId: string): Promise<AuthUserRecord | null> {
    const user = this.users.get(userId);
    return user ? { ...user } : null;
  }

  async listUsers(filters?: { status?: AuthUserRecord['status']; query?: string }): Promise<AuthUserRecord[]> {
    return [...this.users.values()]
      .filter((user) => {
        if (filters?.status && user.status !== filters.status) {
          return false;
        }

        if (filters?.query && !user.email.toLowerCase().includes(filters.query.toLowerCase())) {
          return false;
        }

        return true;
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((user) => ({ ...user }));
  }

  async createUser(input: CreateAuthUserInput): Promise<AuthUserRecord> {
    const timestamp = toIsoNow(this.runtime);
    const record: AuthUserRecord = {
      id: input.id,
      email: input.email,
      role: input.role,
      status: input.status,
      monthlyQuota: input.monthlyQuota ?? 100,
      monthlyUsed: input.monthlyUsed ?? 0,
      passwordHash: input.passwordHash ?? null,
      passwordAlgo: input.passwordAlgo ?? null,
      passwordChangedAt: input.passwordChangedAt?.toISOString() ?? null,
      lastLoginAt: null,
      disabledAt: input.disabledAt === undefined ? null : input.disabledAt?.toISOString() ?? null,
      createdByAdminUserId: input.createdByAdminUserId ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.users.set(record.id, record);
    return { ...record };
  }

  async updateUser(userId: string, input: UpdateAuthUserInput): Promise<AuthUserRecord | null> {
    const current = this.users.get(userId);
    if (!current) {
      return null;
    }

    const updated: AuthUserRecord = {
      ...current,
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.monthlyQuota !== undefined ? { monthlyQuota: input.monthlyQuota } : {}),
      ...(input.monthlyUsed !== undefined ? { monthlyUsed: input.monthlyUsed } : {}),
      ...(input.disabledAt !== undefined ? { disabledAt: input.disabledAt?.toISOString() ?? null } : {}),
      updatedAt: toIsoNow(this.runtime),
    };

    this.users.set(userId, updated);
    return { ...updated };
  }

  async setPassword(userId: string, input: SetAuthUserPasswordInput): Promise<void> {
    const current = this.users.get(userId);
    if (!current) {
      return;
    }

    this.users.set(userId, {
      ...current,
      passwordHash: input.passwordHash,
      passwordAlgo: input.passwordAlgo,
      passwordChangedAt: (input.passwordChangedAt ?? new Date()).toISOString(),
      status: input.nextStatus ?? current.status,
      updatedAt: toIsoNow(this.runtime),
    });
  }

  async recordSuccessfulLogin(userId: string, at?: Date): Promise<void> {
    const current = this.users.get(userId);
    if (!current) {
      return;
    }

    this.users.set(userId, {
      ...current,
      lastLoginAt: (at ?? new Date()).toISOString(),
      updatedAt: toIsoNow(this.runtime),
    });
  }

  async findUserByOAuthSubject(provider: OAuthProvider, providerSubject: string): Promise<AuthUserRecord | null> {
    const key = `${provider}:${providerSubject}`;
    const account = this.oauthAccounts.get(key);
    if (!account) {
      return null;
    }

    return this.findUserById(account.userId);
  }

  async linkOAuthAccount(input: LinkOAuthAccountInput): Promise<OAuthAccountRecord> {
    const key = `${input.provider}:${input.providerSubject}`;
    const existing = this.oauthAccounts.get(key);
    const timestamp = toIsoNow(this.runtime);

    const record: OAuthAccountRecord = {
      id: existing?.id ?? ++this.oauthAccountSequence,
      userId: input.userId,
      provider: input.provider,
      providerSubject: input.providerSubject,
      emailAtProvider: input.emailAtProvider ?? null,
      profileJson: input.profileJson ?? {},
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    this.oauthAccounts.set(key, record);
    return { ...record, profileJson: { ...record.profileJson } };
  }
}

export class AuthSessionRepositoryStub implements AuthSessionRepository {
  private readonly sessions = new Map<string, AuthSessionRecord>();
  private readonly sessionLookupByTokenHash = new Map<string, string>();

  constructor(
    private readonly users: AuthUserRepositoryStub,
    private readonly runtime?: ProductionAdapterRuntime,
  ) {}

  async createSession(input: CreateAuthSessionInput): Promise<AuthSessionPrincipal> {
    const timestamp = toIsoNow(this.runtime);
    const record: AuthSessionRecord = {
      id: input.id,
      userId: input.userId,
      sessionTokenHash: input.sessionTokenHash,
      authMethod: input.authMethod,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      expiresAt: input.expiresAt.toISOString(),
      revokedAt: null,
      lastSeenAt: timestamp,
      createdAt: timestamp,
    };

    this.sessions.set(record.id, record);
    this.sessionLookupByTokenHash.set(record.sessionTokenHash, record.id);

    const user = await this.users.findUserById(record.userId);
    if (!user) {
      throw new Error(`Cannot create stub auth session for missing user ${record.userId}`);
    }

    return normalizePrincipal(record, user);
  }

  async getSessionByTokenHash(sessionTokenHash: string): Promise<AuthSessionPrincipal | null> {
    const sessionId = this.sessionLookupByTokenHash.get(sessionTokenHash);
    if (!sessionId) {
      return null;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const user = await this.users.findUserById(session.userId);
    if (!user) {
      return null;
    }

    return normalizePrincipal({ ...session }, user);
  }

  async revokeSession(sessionId: string, revokedAt?: Date): Promise<void> {
    const current = this.sessions.get(sessionId);
    if (!current) {
      return;
    }

    this.sessions.set(sessionId, {
      ...current,
      revokedAt: current.revokedAt ?? maybeDateToIso(revokedAt, this.runtime),
    });
  }

  async revokeUserSessions(input: RevokeAuthSessionsInput): Promise<number> {
    let revokedCount = 0;
    const revokedAt = maybeDateToIso(input.revokedAt, this.runtime);

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId !== input.userId) {
        continue;
      }

      if (input.authMethod && session.authMethod !== input.authMethod) {
        continue;
      }

      if (session.revokedAt) {
        continue;
      }

      this.sessions.set(sessionId, {
        ...session,
        revokedAt,
      });
      revokedCount += 1;
    }

    return revokedCount;
  }

  async touchSession(sessionId: string, seenAt?: Date): Promise<void> {
    const current = this.sessions.get(sessionId);
    if (!current) {
      return;
    }

    this.sessions.set(sessionId, {
      ...current,
      lastSeenAt: (seenAt ?? new Date()).toISOString(),
    });
  }
}

export class OAuthStateRepositoryStub implements OAuthStateRepository {
  private readonly tokens = new Map<string, OAuthStateTokenRecord>();

  constructor(private readonly runtime?: ProductionAdapterRuntime) {}

  async createStateToken(input: CreateOAuthStateTokenInput): Promise<OAuthStateTokenRecord> {
    const record: OAuthStateTokenRecord = {
      state: input.state,
      provider: input.provider,
      codeVerifier: input.codeVerifier,
      redirectUri: input.redirectUri,
      requestedByIp: input.requestedByIp ?? null,
      expiresAt: input.expiresAt.toISOString(),
      consumedAt: null,
      createdAt: toIsoNow(this.runtime),
    };

    this.tokens.set(`${input.provider}:${input.state}`, record);
    return { ...record };
  }

  async consumeStateToken(
    state: string,
    provider: OAuthProvider,
    consumedAt?: Date,
  ): Promise<OAuthStateTokenRecord | null> {
    const key = `${provider}:${state}`;
    const current = this.tokens.get(key);
    if (!current || current.consumedAt) {
      return null;
    }

    const updated: OAuthStateTokenRecord = {
      ...current,
      consumedAt: (consumedAt ?? new Date()).toISOString(),
    };

    this.tokens.set(key, updated);
    return { ...updated };
  }
}

export type AuthStubOptions = {
  runtime?: ProductionAdapterRuntime;
  seedUsers?: AuthUserRecord[];
  seedSessions?: Array<{
    session: AuthSessionRecord;
    user: AuthUserRecord;
  }>;
};

export const createAuthStubRepositories = (
  options: AuthStubOptions = {},
): AuthRepositoryBundle => {
  const users = new AuthUserRepositoryStub(options.runtime);
  const sessions = new AuthSessionRepositoryStub(users, options.runtime);
  const oauthState = new OAuthStateRepositoryStub(options.runtime);

  if (options.seedUsers) {
    for (const user of options.seedUsers) {
      void users.createUser({
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        monthlyQuota: user.monthlyQuota,
        monthlyUsed: user.monthlyUsed,
        passwordHash: user.passwordHash,
        passwordAlgo: user.passwordAlgo,
        disabledAt: user.disabledAt ? new Date(user.disabledAt) : null,
        createdByAdminUserId: user.createdByAdminUserId,
        ...(user.passwordChangedAt
          ? { passwordChangedAt: new Date(user.passwordChangedAt) }
          : {}),
      });
    }
  }

  if (options.seedSessions) {
    for (const seed of options.seedSessions) {
      void users.createUser({
        id: seed.user.id,
        email: seed.user.email,
        role: seed.user.role,
        status: seed.user.status,
        monthlyQuota: seed.user.monthlyQuota,
        monthlyUsed: seed.user.monthlyUsed,
        passwordHash: seed.user.passwordHash,
        passwordAlgo: seed.user.passwordAlgo,
        disabledAt: seed.user.disabledAt ? new Date(seed.user.disabledAt) : null,
        createdByAdminUserId: seed.user.createdByAdminUserId,
        ...(seed.user.passwordChangedAt
          ? { passwordChangedAt: new Date(seed.user.passwordChangedAt) }
          : {}),
      });
      void sessions.createSession({
        id: seed.session.id,
        userId: seed.session.userId,
        sessionTokenHash: seed.session.sessionTokenHash,
        authMethod: seed.session.authMethod as AuthMethod,
        expiresAt: new Date(seed.session.expiresAt),
        ipAddress: seed.session.ipAddress,
        userAgent: seed.session.userAgent,
      });
    }
  }

  return { users, sessions, oauthState };
};