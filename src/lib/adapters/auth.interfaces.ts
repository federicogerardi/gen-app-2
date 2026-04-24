import type { ProductionAdapterRuntime } from './postgres-redis.interfaces';
import type {
  ArtifactQueryRepository,
  ProjectQueryRepository,
} from './postgres-redis.interfaces';

import type {
  AuthSessionPrincipal,
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

export interface AuthUserRepository {
  findUserByEmail(email: string): Promise<AuthUserRecord | null>;
  findUserById(userId: string): Promise<AuthUserRecord | null>;
  listUsers(filters?: AuthUserListFilters): Promise<AuthUserRecord[]>;
  createUser(input: CreateAuthUserInput): Promise<AuthUserRecord>;
  updateUser(userId: string, input: UpdateAuthUserInput): Promise<AuthUserRecord | null>;
  setPassword(userId: string, input: SetAuthUserPasswordInput): Promise<void>;
  recordSuccessfulLogin(userId: string, at?: Date): Promise<void>;
  findUserByOAuthSubject(provider: OAuthProvider, providerSubject: string): Promise<AuthUserRecord | null>;
  linkOAuthAccount(input: LinkOAuthAccountInput): Promise<OAuthAccountRecord>;
}

export interface AuthSessionRepository {
  createSession(input: CreateAuthSessionInput): Promise<AuthSessionPrincipal>;
  getSessionByTokenHash(sessionTokenHash: string): Promise<AuthSessionPrincipal | null>;
  revokeSession(sessionId: string, revokedAt?: Date): Promise<void>;
  revokeUserSessions(input: RevokeAuthSessionsInput): Promise<number>;
  touchSession(sessionId: string, seenAt?: Date): Promise<void>;
}

export interface OAuthStateRepository {
  createStateToken(input: CreateOAuthStateTokenInput): Promise<OAuthStateTokenRecord>;
  consumeStateToken(state: string, provider: OAuthProvider, consumedAt?: Date): Promise<OAuthStateTokenRecord | null>;
}

export interface AuthRepositoryBundle {
  users: AuthUserRepository;
  sessions: AuthSessionRepository;
  oauthState: OAuthStateRepository;
}

export interface UserQueryRepositoryBundle {
  projects: ProjectQueryRepository;
  artifacts: ArtifactQueryRepository;
}

export type AuthProductionOptions = {
  runtime?: ProductionAdapterRuntime;
  users?: {
    usersTableName?: string;
    usersSchema?: string;
    oauthAccountsTableName?: string;
    oauthAccountsSchema?: string;
  };
  sessions?: {
    usersTableName?: string;
    usersSchema?: string;
    authSessionsTableName?: string;
    authSessionsSchema?: string;
  };
  oauthState?: {
    oauthStateTokensTableName?: string;
    oauthStateTokensSchema?: string;
  };
};