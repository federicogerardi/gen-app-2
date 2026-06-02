import { Kysely, sql } from 'kysely';
import type { Pool } from 'pg';

import type {
  AuthSessionPrincipal,
  AuthSessionRecord,
  AuthUserListFilters,
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
  AuthProductionOptions,
  AuthRepositoryBundle,
  AuthSessionRepository,
  AuthUserRepository,
  OAuthStateRepository,
} from './auth.interfaces';
import type { ProductionAdapterRuntime } from './postgres-redis.interfaces';
import { createKyselyDb } from './postgres-kysely.dialect';
import type { DB } from './postgres-kysely.types';

/**
 * Escape hatch: Kysely has no typed builder API for PostgreSQL server-side timestamp functions.
 * NOW() must be expressed via the sql template tag.
 */
const dbNow = sql<Date>`NOW()`;

const nowDate = (runtime?: ProductionAdapterRuntime): Date =>
  runtime?.now?.() ?? new Date();

const toIsoTimestamp = (value: Date | string | null): string | null => {
  if (value === null) {
    return null;
  }

  return typeof value === 'string' ? value : value.toISOString();
};

type AuthUserRow = {
  id: string;
  email: string;
  role: AuthUserRecord['role'];
  status: AuthUserRecord['status'];
  monthly_quota: number;
  monthly_used: number;
  password_hash: string | null;
  password_algo: string | null;
  password_changed_at: Date | string | null;
  last_login_at: Date | string | null;
  disabled_at: Date | string | null;
  created_by_admin_user_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type OAuthAccountRow = {
  id: number;
  user_id: string;
  provider: OAuthProvider;
  provider_subject: string;
  email_at_provider: string | null;
  profile_json: Record<string, unknown>;
  created_at: Date | string;
  updated_at: Date | string;
};

type AuthSessionJoinRow = {
  session_id: string;
  user_id: string;
  session_token_hash: string;
  auth_method: AuthSessionRecord['authMethod'];
  ip_address: string | null;
  user_agent: string | null;
  expires_at: Date | string;
  revoked_at: Date | string | null;
  last_seen_at: Date | string;
  session_created_at: Date | string;
  email: string;
  role: AuthUserRecord['role'];
  status: AuthUserRecord['status'];
};

type OAuthStateRow = {
  state: string;
  provider: OAuthProvider;
  code_verifier: string;
  redirect_uri: string;
  requested_by_ip: string | null;
  expires_at: Date | string;
  consumed_at: Date | string | null;
  created_at: Date | string;
};

const mapAuthUserRow = (row: AuthUserRow): AuthUserRecord => {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    monthlyQuota: row.monthly_quota,
    monthlyUsed: row.monthly_used,
    passwordHash: row.password_hash,
    passwordAlgo: row.password_algo,
    passwordChangedAt: toIsoTimestamp(row.password_changed_at),
    lastLoginAt: toIsoTimestamp(row.last_login_at),
    disabledAt: toIsoTimestamp(row.disabled_at),
    createdByAdminUserId: row.created_by_admin_user_id,
    createdAt: toIsoTimestamp(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: toIsoTimestamp(row.updated_at) ?? new Date(0).toISOString(),
  };
};

const mapOAuthAccountRow = (row: OAuthAccountRow): OAuthAccountRecord => {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    providerSubject: row.provider_subject,
    emailAtProvider: row.email_at_provider,
    profileJson: row.profile_json ?? {},
    createdAt: toIsoTimestamp(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: toIsoTimestamp(row.updated_at) ?? new Date(0).toISOString(),
  };
};

const mapAuthSessionPrincipalRow = (row: AuthSessionJoinRow): AuthSessionPrincipal => {
  return {
    session: {
      id: row.session_id,
      userId: row.user_id,
      sessionTokenHash: row.session_token_hash,
      authMethod: row.auth_method,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      expiresAt: toIsoTimestamp(row.expires_at) ?? new Date(0).toISOString(),
      revokedAt: toIsoTimestamp(row.revoked_at),
      lastSeenAt: toIsoTimestamp(row.last_seen_at) ?? new Date(0).toISOString(),
      createdAt: toIsoTimestamp(row.session_created_at) ?? new Date(0).toISOString(),
    },
    user: {
      id: row.user_id,
      email: row.email,
      role: row.role,
      status: row.status,
    },
  };
};

const mapOAuthStateRow = (row: OAuthStateRow): OAuthStateTokenRecord => {
  return {
    state: row.state,
    provider: row.provider,
    codeVerifier: row.code_verifier,
    redirectUri: row.redirect_uri,
    requestedByIp: row.requested_by_ip,
    expiresAt: toIsoTimestamp(row.expires_at) ?? new Date(0).toISOString(),
    consumedAt: toIsoTimestamp(row.consumed_at),
    createdAt: toIsoTimestamp(row.created_at) ?? new Date(0).toISOString(),
  };
};

export class PostgresAuthUserRepository implements AuthUserRepository {
  private readonly db: Kysely<DB>;
  private readonly usersSchema: string | undefined;
  private readonly oauthAccountsSchema: string | undefined;

  constructor(
    pg: Pool,
    options: NonNullable<AuthProductionOptions['users']> = {},
  ) {
    this.db = createKyselyDb(pg);
    this.usersSchema = options.usersSchema;
    this.oauthAccountsSchema = options.oauthAccountsSchema;
  }

  private getUsersDb(): Kysely<DB> {
    return this.usersSchema ? this.db.withSchema(this.usersSchema) : this.db;
  }

  private getOAuthDb(): Kysely<DB> {
    return this.oauthAccountsSchema ? this.db.withSchema(this.oauthAccountsSchema) : this.db;
  }

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const row = await this.getUsersDb()
      .selectFrom('users')
      .selectAll()
      // Escape hatch: lower() is a PostgreSQL string function; Kysely has no typed
      // builder equivalent for case-insensitive column comparison via LOWER().
      .where(sql<boolean>`lower(email) = lower(${email})`)
      .limit(1)
      .executeTakeFirst() as unknown as AuthUserRow | undefined;

    return row ? mapAuthUserRow(row) : null;
  }

  async findUserById(userId: string): Promise<AuthUserRecord | null> {
    const row = await this.getUsersDb()
      .selectFrom('users')
      .selectAll()
      .where('id', '=', userId)
      .limit(1)
      .executeTakeFirst() as unknown as AuthUserRow | undefined;

    return row ? mapAuthUserRow(row) : null;
  }

  async listUsers(filters?: AuthUserListFilters): Promise<AuthUserRecord[]> {
    let query = this.getUsersDb()
      .selectFrom('users')
      .selectAll();

    if (filters?.status) {
      query = query.where('status', '=', filters.status);
    }

    if (filters?.query) {
      const pattern = `%${filters.query.toLowerCase()}%`;
      // Escape hatch: lower(email) LIKE — same reason as findUserByEmail.
      query = query.where(sql<boolean>`lower(email) LIKE ${pattern}`);
    }

    const rows = await query
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .execute() as unknown as AuthUserRow[];

    return rows.map(mapAuthUserRow);
  }

  async createUser(input: CreateAuthUserInput): Promise<AuthUserRecord> {
    const row = await this.getUsersDb()
      .insertInto('users')
      .values({
        id: input.id,
        email: input.email,
        role: input.role,
        status: input.status,
        monthly_quota: input.monthlyQuota ?? 100,
        monthly_used: input.monthlyUsed ?? 0,
        password_hash: input.passwordHash ?? null,
        password_algo: input.passwordAlgo ?? null,
        password_changed_at: input.passwordChangedAt ?? null,
        disabled_at: input.disabledAt ?? null,
        created_by_admin_user_id: input.createdByAdminUserId ?? null,
        created_at: dbNow,
        updated_at: dbNow,
      })
      .returningAll()
      .executeTakeFirstOrThrow() as unknown as AuthUserRow;

    return mapAuthUserRow(row);
  }

  async updateUser(userId: string, input: UpdateAuthUserInput): Promise<AuthUserRecord | null> {
    const setValues: Record<string, unknown> = {
      updated_at: sql`NOW()`,
    };

    if (input.email !== undefined) {
      setValues.email = input.email;
    }
    if (input.role !== undefined) {
      setValues.role = input.role;
    }
    if (input.status !== undefined) {
      setValues.status = input.status;
    }
    if (input.monthlyQuota !== undefined) {
      setValues.monthly_quota = input.monthlyQuota;
    }
    if (input.monthlyUsed !== undefined) {
      setValues.monthly_used = input.monthlyUsed;
    }
    if (input.disabledAt !== undefined) {
      setValues.disabled_at = input.disabledAt;
    }

    if (Object.keys(setValues).length <= 1) {
      return this.findUserById(userId);
    }

    const row = await this.getUsersDb()
      .updateTable('users')
      .set(setValues as any)
      .where('id', '=', userId)
      .returningAll()
      .executeTakeFirst() as unknown as AuthUserRow | undefined;

    return row ? mapAuthUserRow(row) : null;
  }

  async setPassword(userId: string, input: SetAuthUserPasswordInput): Promise<void> {
    await this.getUsersDb()
      .updateTable('users')
      .set({
        password_hash: input.passwordHash,
        password_algo: input.passwordAlgo,
        password_changed_at: input.passwordChangedAt ?? new Date(),
        // Escape hatch: COALESCE mixing a parameterized value with a bare column reference.
        // Kysely's typed .set() has no API for COALESCE(param, column) expressions.
        status: sql`COALESCE(${input.nextStatus ?? null}, status)`,
        updated_at: dbNow,
      })
      .where('id', '=', userId)
      .execute();
  }

  async recordSuccessfulLogin(userId: string, at?: Date): Promise<void> {
    await this.getUsersDb()
      .updateTable('users')
      .set({
        last_login_at: at ?? new Date(),
        updated_at: dbNow,
      })
      .where('id', '=', userId)
      .execute();
  }

  async findUserByOAuthSubject(
    provider: OAuthProvider,
    providerSubject: string,
  ): Promise<AuthUserRecord | null> {
    const db = this.getUsersDb();
    const row = await db
      .selectFrom('users as u')
      .innerJoin('oauth_accounts as oa', 'oa.user_id', 'u.id')
      .selectAll('u')
      .where('oa.provider', '=', provider)
      .where('oa.provider_subject', '=', providerSubject)
      .limit(1)
      .executeTakeFirst() as unknown as AuthUserRow | undefined;

    return row ? mapAuthUserRow(row) : null;
  }

  async linkOAuthAccount(input: LinkOAuthAccountInput): Promise<OAuthAccountRecord> {
    const db = this.getOAuthDb();
    const row = await db
      .insertInto('oauth_accounts')
      .values({
        user_id: input.userId,
        provider: input.provider,
        provider_subject: input.providerSubject,
        email_at_provider: input.emailAtProvider ?? null,
        profile_json: input.profileJson ?? {},
        created_at: dbNow,
        updated_at: dbNow,
      })
      .onConflict((oc) => oc
        .columns(['provider', 'provider_subject'])
        .doUpdateSet({
          user_id: input.userId,
          email_at_provider: input.emailAtProvider ?? null,
          profile_json: input.profileJson ?? {},
          updated_at: dbNow,
        }))
      .returningAll()
      .executeTakeFirstOrThrow() as unknown as OAuthAccountRow;

    return mapOAuthAccountRow(row);
  }
}

export class PostgresAuthSessionRepository implements AuthSessionRepository {
  private readonly db: Kysely<DB>;
  private readonly authSessionsSchema: string | undefined;

  constructor(
    pg: Pool,
    options: NonNullable<AuthProductionOptions['sessions']> = {},
  ) {
    this.db = createKyselyDb(pg);
    this.authSessionsSchema = options.authSessionsSchema;
  }

  private getSessionsDb(): Kysely<DB> {
    return this.authSessionsSchema ? this.db.withSchema(this.authSessionsSchema) : this.db;
  }

  async createSession(input: CreateAuthSessionInput): Promise<AuthSessionPrincipal> {
    await this.getSessionsDb()
      .insertInto('auth_sessions')
      .values({
        id: input.id,
        user_id: input.userId,
        session_token_hash: input.sessionTokenHash,
        auth_method: input.authMethod,
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
        expires_at: input.expiresAt,
        created_at: dbNow,
        last_seen_at: dbNow,
      })
      .execute();

    const session = await this.getSessionByTokenHash(input.sessionTokenHash);
    if (!session) {
      throw new Error(`Auth session ${input.id} was not readable after insert`);
    }

    return session;
  }

  async getSessionByTokenHash(sessionTokenHash: string): Promise<AuthSessionPrincipal | null> {
    const row = await this.getSessionsDb()
      .selectFrom('auth_sessions as s')
      .innerJoin('users as u', 'u.id', 's.user_id')
      .select([
        // Escape hatch: aliasing a joined column requires sql tag — Kysely's typed
        // string select does not support renaming columns across joined tables.
        sql<string>`s.id`.as('session_id'),
        's.user_id',
        's.session_token_hash',
        's.auth_method',
        // Escape hatch: ::text cast is PostgreSQL-specific; no typed Kysely builder equivalent.
        sql<string>`s.ip_address::text`.as('ip_address'),
        's.user_agent',
        's.expires_at',
        's.revoked_at',
        's.last_seen_at',
        // Escape hatch: explicit type annotation needed for the session_created_at alias.
        sql<Date>`s.created_at`.as('session_created_at'),
        'u.email',
        'u.role',
        'u.status',
      ])
      .where('s.session_token_hash', '=', sessionTokenHash)
      .limit(1)
      .executeTakeFirst() as unknown as AuthSessionJoinRow | undefined;

    return row ? mapAuthSessionPrincipalRow(row) : null;
  }

  async revokeSession(sessionId: string, revokedAt?: Date): Promise<void> {
    await this.getSessionsDb()
      .updateTable('auth_sessions')
      .set({
        // Escape hatch: COALESCE preserves an existing revoked_at if already set.
        // Kysely's typed .set() has no API for COALESCE(column, param) expressions.
        revoked_at: sql`COALESCE(revoked_at, ${revokedAt ?? new Date()})`,
      })
      .where('id', '=', sessionId)
      .execute();
  }

  async revokeUserSessions(input: RevokeAuthSessionsInput): Promise<number> {
    const result = await this.getSessionsDb()
      .updateTable('auth_sessions')
      .set({
        revoked_at: input.revokedAt ?? nowDate(),
      })
      .where('user_id', '=', input.userId)
      .where('revoked_at', 'is', null)
      .$if(input.authMethod !== undefined, (qb) => qb.where('auth_method', '=', input.authMethod!))
      .returning('id')
      .execute();

    return result.length;
  }

  async touchSession(sessionId: string, seenAt?: Date): Promise<void> {
    await this.getSessionsDb()
      .updateTable('auth_sessions')
      .set({
        last_seen_at: seenAt ?? new Date(),
      })
      .where('id', '=', sessionId)
      .execute();
  }
}

export class PostgresOAuthStateRepository implements OAuthStateRepository {
  private readonly db: Kysely<DB>;
  private readonly oauthStateTokensSchema: string | undefined;

  constructor(
    pg: Pool,
    options: NonNullable<AuthProductionOptions['oauthState']> = {},
  ) {
    this.db = createKyselyDb(pg);
    this.oauthStateTokensSchema = options.oauthStateTokensSchema;
  }

  private getDb(): Kysely<DB> {
    return this.oauthStateTokensSchema ? this.db.withSchema(this.oauthStateTokensSchema) : this.db;
  }

  async createStateToken(input: CreateOAuthStateTokenInput): Promise<OAuthStateTokenRecord> {
    const row = await this.getDb()
      .insertInto('oauth_state_tokens')
      .values({
        state: input.state,
        provider: input.provider,
        code_verifier: input.codeVerifier,
        redirect_uri: input.redirectUri,
        requested_by_ip: input.requestedByIp ?? null,
        expires_at: input.expiresAt,
        created_at: dbNow,
        consumed_at: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow() as unknown as OAuthStateRow;

    return mapOAuthStateRow(row);
  }

  async consumeStateToken(
    state: string,
    provider: OAuthProvider,
    consumedAt?: Date,
  ): Promise<OAuthStateTokenRecord | null> {
    const row = await this.getDb()
      .updateTable('oauth_state_tokens')
      .set({
        consumed_at: consumedAt ?? new Date(),
      })
      .where('state', '=', state)
      .where('provider', '=', provider)
      .where('consumed_at', 'is', null)
      .returningAll()
      .executeTakeFirst() as unknown as OAuthStateRow | undefined;

    return row ? mapOAuthStateRow(row) : null;
  }
}

export type AuthProductionClients = {
  pg: Pool;
};

export const createAuthProductionRepositories = (
  clients: AuthProductionClients,
  options: AuthProductionOptions = {},
): AuthRepositoryBundle => {
  return {
    users: new PostgresAuthUserRepository(clients.pg, options.users),
    sessions: new PostgresAuthSessionRepository(clients.pg, options.sessions),
    oauthState: new PostgresOAuthStateRepository(clients.pg, options.oauthState),
  };
};
