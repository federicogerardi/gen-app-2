import type { Pool, QueryResult } from 'pg';

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

const nowDate = (runtime?: ProductionAdapterRuntime): Date =>
  runtime?.now?.() ?? new Date();

const quoteIdentifier = (identifier: string): string => {
  return `"${identifier.replace(/"/g, '""')}"`;
};

const buildQualifiedTableName = (schema: string | undefined, table: string): string => {
  if (!schema) {
    return quoteIdentifier(table);
  }

  return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
};

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
  private readonly usersTableName: string;
  private readonly oauthAccountsTableName: string;

  constructor(
    private readonly pg: Pool,
    options: NonNullable<AuthProductionOptions['users']> = {},
  ) {
    this.usersTableName = buildQualifiedTableName(
      options.usersSchema,
      options.usersTableName ?? 'users',
    );
    this.oauthAccountsTableName = buildQualifiedTableName(
      options.oauthAccountsSchema,
      options.oauthAccountsTableName ?? 'oauth_accounts',
    );
  }

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const query = `
      SELECT
        id,
        email,
        role,
        status,
        monthly_quota,
        monthly_used,
        password_hash,
        password_algo,
        password_changed_at,
        last_login_at,
        disabled_at,
        created_by_admin_user_id,
        created_at,
        updated_at
      FROM ${this.usersTableName}
      WHERE lower(email) = lower($1)
      LIMIT 1
    `;

    const result: QueryResult<AuthUserRow> = await this.pg.query(query, [email]);
    return result.rows[0] ? mapAuthUserRow(result.rows[0]) : null;
  }

  async findUserById(userId: string): Promise<AuthUserRecord | null> {
    const query = `
      SELECT
        id,
        email,
        role,
        status,
        monthly_quota,
        monthly_used,
        password_hash,
        password_algo,
        password_changed_at,
        last_login_at,
        disabled_at,
        created_by_admin_user_id,
        created_at,
        updated_at
      FROM ${this.usersTableName}
      WHERE id = $1
      LIMIT 1
    `;

    const result: QueryResult<AuthUserRow> = await this.pg.query(query, [userId]);
    return result.rows[0] ? mapAuthUserRow(result.rows[0]) : null;
  }

  async listUsers(filters?: AuthUserListFilters): Promise<AuthUserRecord[]> {
    const where: string[] = [];
    const params: unknown[] = [];

    if (filters?.status) {
      params.push(filters.status);
      where.push(`status = $${params.length}`);
    }

    if (filters?.query) {
      params.push(`%${filters.query.toLowerCase()}%`);
      where.push(`lower(email) LIKE $${params.length}`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const query = `
      SELECT
        id,
        email,
        role,
        status,
        monthly_quota,
        monthly_used,
        password_hash,
        password_algo,
        password_changed_at,
        last_login_at,
        disabled_at,
        created_by_admin_user_id,
        created_at,
        updated_at
      FROM ${this.usersTableName}
      ${whereClause}
      ORDER BY created_at DESC, id DESC
    `;

    const result: QueryResult<AuthUserRow> = await this.pg.query(query, params);
    return result.rows.map(mapAuthUserRow);
  }

  async createUser(input: CreateAuthUserInput): Promise<AuthUserRecord> {
    const query = `
      INSERT INTO ${this.usersTableName}
        (
          id,
          email,
          role,
          status,
          monthly_quota,
          monthly_used,
          password_hash,
          password_algo,
          password_changed_at,
          disabled_at,
          created_by_admin_user_id,
          created_at,
          updated_at
        )
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING
        id,
        email,
        role,
        status,
        monthly_quota,
        monthly_used,
        password_hash,
        password_algo,
        password_changed_at,
        last_login_at,
        disabled_at,
        created_by_admin_user_id,
        created_at,
        updated_at
    `;

    const result: QueryResult<AuthUserRow> = await this.pg.query(query, [
      input.id,
      input.email,
      input.role,
      input.status,
      input.monthlyQuota ?? 100,
      input.monthlyUsed ?? 0,
      input.passwordHash ?? null,
      input.passwordAlgo ?? null,
      input.passwordChangedAt ?? null,
      input.disabledAt ?? null,
      input.createdByAdminUserId ?? null,
    ]);

    const row = result.rows[0];
    if (!row) {
      throw new Error(`Auth user ${input.id} was not returned after insert`);
    }

    return mapAuthUserRow(row);
  }

  async updateUser(userId: string, input: UpdateAuthUserInput): Promise<AuthUserRecord | null> {
    const assignments: string[] = [];
    const params: unknown[] = [];

    if (input.email !== undefined) {
      params.push(input.email);
      assignments.push(`email = $${params.length}`);
    }

    if (input.role !== undefined) {
      params.push(input.role);
      assignments.push(`role = $${params.length}`);
    }

    if (input.status !== undefined) {
      params.push(input.status);
      assignments.push(`status = $${params.length}`);
    }

    if (input.monthlyQuota !== undefined) {
      params.push(input.monthlyQuota);
      assignments.push(`monthly_quota = $${params.length}`);
    }

    if (input.monthlyUsed !== undefined) {
      params.push(input.monthlyUsed);
      assignments.push(`monthly_used = $${params.length}`);
    }

    if (input.disabledAt !== undefined) {
      params.push(input.disabledAt);
      assignments.push(`disabled_at = $${params.length}`);
    }

    if (assignments.length === 0) {
      return this.findUserById(userId);
    }

    const query = `
      UPDATE ${this.usersTableName}
      SET
        ${assignments.join(', ')},
        updated_at = NOW()
      WHERE id = $${params.length + 1}
      RETURNING
        id,
        email,
        role,
        status,
        monthly_quota,
        monthly_used,
        password_hash,
        password_algo,
        password_changed_at,
        last_login_at,
        disabled_at,
        created_by_admin_user_id,
        created_at,
        updated_at
    `;

    params.push(userId);
    const result: QueryResult<AuthUserRow> = await this.pg.query(query, params);
    return result.rows[0] ? mapAuthUserRow(result.rows[0]) : null;
  }

  async setPassword(userId: string, input: SetAuthUserPasswordInput): Promise<void> {
    const query = `
      UPDATE ${this.usersTableName}
      SET
        password_hash = $1,
        password_algo = $2,
        password_changed_at = $3,
        status = COALESCE($4, status),
        updated_at = NOW()
      WHERE id = $5
    `;

    await this.pg.query(query, [
      input.passwordHash,
      input.passwordAlgo,
      input.passwordChangedAt ?? new Date(),
      input.nextStatus ?? null,
      userId,
    ]);
  }

  async recordSuccessfulLogin(userId: string, at?: Date): Promise<void> {
    const query = `
      UPDATE ${this.usersTableName}
      SET last_login_at = $1, updated_at = NOW()
      WHERE id = $2
    `;

    await this.pg.query(query, [at ?? new Date(), userId]);
  }

  async findUserByOAuthSubject(
    provider: OAuthProvider,
    providerSubject: string,
  ): Promise<AuthUserRecord | null> {
    const query = `
      SELECT
        u.id,
        u.email,
        u.role,
        u.status,
        u.monthly_quota,
        u.monthly_used,
        u.password_hash,
        u.password_algo,
        u.password_changed_at,
        u.last_login_at,
        u.disabled_at,
        u.created_by_admin_user_id,
        u.created_at,
        u.updated_at
      FROM ${this.usersTableName} AS u
      INNER JOIN ${this.oauthAccountsTableName} AS oa
        ON oa.user_id = u.id
      WHERE oa.provider = $1
        AND oa.provider_subject = $2
      LIMIT 1
    `;

    const result: QueryResult<AuthUserRow> = await this.pg.query(query, [provider, providerSubject]);
    return result.rows[0] ? mapAuthUserRow(result.rows[0]) : null;
  }

  async linkOAuthAccount(input: LinkOAuthAccountInput): Promise<OAuthAccountRecord> {
    const query = `
      INSERT INTO ${this.oauthAccountsTableName}
        (
          user_id,
          provider,
          provider_subject,
          email_at_provider,
          profile_json,
          created_at,
          updated_at
        )
      VALUES
        ($1, $2, $3, $4, $5::jsonb, NOW(), NOW())
      ON CONFLICT (provider, provider_subject)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        email_at_provider = EXCLUDED.email_at_provider,
        profile_json = EXCLUDED.profile_json,
        updated_at = NOW()
      RETURNING
        id,
        user_id,
        provider,
        provider_subject,
        email_at_provider,
        profile_json,
        created_at,
        updated_at
    `;

    const result: QueryResult<OAuthAccountRow> = await this.pg.query(query, [
      input.userId,
      input.provider,
      input.providerSubject,
      input.emailAtProvider ?? null,
      JSON.stringify(input.profileJson ?? {}),
    ]);

    const row = result.rows[0];
    if (!row) {
      throw new Error(
        `OAuth account ${input.provider}:${input.providerSubject} was not returned after upsert`,
      );
    }

    return mapOAuthAccountRow(row);
  }
}

export class PostgresAuthSessionRepository implements AuthSessionRepository {
  private readonly authSessionsTableName: string;
  private readonly usersTableName: string;

  constructor(
    private readonly pg: Pool,
    options: NonNullable<AuthProductionOptions['sessions']> = {},
  ) {
    this.authSessionsTableName = buildQualifiedTableName(
      options.authSessionsSchema,
      options.authSessionsTableName ?? 'auth_sessions',
    );
    this.usersTableName = buildQualifiedTableName(
      options.usersSchema,
      options.usersTableName ?? 'users',
    );
  }

  async createSession(input: CreateAuthSessionInput): Promise<AuthSessionPrincipal> {
    const insertQuery = `
      INSERT INTO ${this.authSessionsTableName}
        (
          id,
          user_id,
          session_token_hash,
          auth_method,
          ip_address,
          user_agent,
          expires_at,
          created_at,
          last_seen_at
        )
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
    `;

    await this.pg.query(insertQuery, [
      input.id,
      input.userId,
      input.sessionTokenHash,
      input.authMethod,
      input.ipAddress ?? null,
      input.userAgent ?? null,
      input.expiresAt,
    ]);

    const session = await this.getSessionByTokenHash(input.sessionTokenHash);
    if (!session) {
      throw new Error(`Auth session ${input.id} was not readable after insert`);
    }

    return session;
  }

  async getSessionByTokenHash(sessionTokenHash: string): Promise<AuthSessionPrincipal | null> {
    const query = `
      SELECT
        s.id AS session_id,
        s.user_id,
        s.session_token_hash,
        s.auth_method,
        s.ip_address::text AS ip_address,
        s.user_agent,
        s.expires_at,
        s.revoked_at,
        s.last_seen_at,
        s.created_at AS session_created_at,
        u.email,
        u.role,
        u.status
      FROM ${this.authSessionsTableName} AS s
      INNER JOIN ${this.usersTableName} AS u
        ON u.id = s.user_id
      WHERE s.session_token_hash = $1
      LIMIT 1
    `;

    const result: QueryResult<AuthSessionJoinRow> = await this.pg.query(query, [sessionTokenHash]);
    return result.rows[0] ? mapAuthSessionPrincipalRow(result.rows[0]) : null;
  }

  async revokeSession(sessionId: string, revokedAt?: Date): Promise<void> {
    const query = `
      UPDATE ${this.authSessionsTableName}
      SET revoked_at = COALESCE(revoked_at, $1)
      WHERE id = $2
    `;

    await this.pg.query(query, [revokedAt ?? new Date(), sessionId]);
  }

  async revokeUserSessions(input: RevokeAuthSessionsInput): Promise<number> {
    const where: string[] = ['user_id = $1', 'revoked_at IS NULL'];
    const params: unknown[] = [input.userId, input.revokedAt ?? nowDate()];

    if (input.authMethod !== undefined) {
      where.push(`auth_method = $${params.length + 1}`);
      params.push(input.authMethod);
    }

    const query = `
      UPDATE ${this.authSessionsTableName}
      SET revoked_at = $2
      WHERE ${where.join(' AND ')}
    `;

    const result = await this.pg.query(query, params);
    return result.rowCount ?? 0;
  }

  async touchSession(sessionId: string, seenAt?: Date): Promise<void> {
    const query = `
      UPDATE ${this.authSessionsTableName}
      SET last_seen_at = $1
      WHERE id = $2
    `;

    await this.pg.query(query, [seenAt ?? new Date(), sessionId]);
  }
}

export class PostgresOAuthStateRepository implements OAuthStateRepository {
  private readonly oauthStateTokensTableName: string;

  constructor(
    private readonly pg: Pool,
    options: NonNullable<AuthProductionOptions['oauthState']> = {},
  ) {
    this.oauthStateTokensTableName = buildQualifiedTableName(
      options.oauthStateTokensSchema,
      options.oauthStateTokensTableName ?? 'oauth_state_tokens',
    );
  }

  async createStateToken(input: CreateOAuthStateTokenInput): Promise<OAuthStateTokenRecord> {
    const query = `
      INSERT INTO ${this.oauthStateTokensTableName}
        (
          state,
          provider,
          code_verifier,
          redirect_uri,
          requested_by_ip,
          expires_at,
          created_at,
          consumed_at
        )
      VALUES
        ($1, $2, $3, $4, $5, $6, NOW(), NULL)
      RETURNING
        state,
        provider,
        code_verifier,
        redirect_uri,
        requested_by_ip,
        expires_at,
        consumed_at,
        created_at
    `;

    const result: QueryResult<OAuthStateRow> = await this.pg.query(query, [
      input.state,
      input.provider,
      input.codeVerifier,
      input.redirectUri,
      input.requestedByIp ?? null,
      input.expiresAt,
    ]);

    const row = result.rows[0];
    if (!row) {
      throw new Error(`OAuth state token ${input.state} was not returned after insert`);
    }

    return mapOAuthStateRow(row);
  }

  async consumeStateToken(
    state: string,
    provider: OAuthProvider,
    consumedAt?: Date,
  ): Promise<OAuthStateTokenRecord | null> {
    const query = `
      UPDATE ${this.oauthStateTokensTableName}
      SET consumed_at = $3
      WHERE state = $1
        AND provider = $2
        AND consumed_at IS NULL
      RETURNING
        state,
        provider,
        code_verifier,
        redirect_uri,
        requested_by_ip,
        expires_at,
        consumed_at,
        created_at
    `;

    const result: QueryResult<OAuthStateRow> = await this.pg.query(query, [
      state,
      provider,
      consumedAt ?? new Date(),
    ]);

    return result.rows[0] ? mapOAuthStateRow(result.rows[0]) : null;
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