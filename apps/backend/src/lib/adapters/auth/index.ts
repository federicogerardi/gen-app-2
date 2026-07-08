// Auth Context adapter entry point (DDD-164)

export {
  createAuthProductionRepositories,
  PostgresAuthSessionRepository,
  PostgresAuthUserRepository,
  PostgresOAuthStateRepository,
  type AuthProductionClients,
} from '../auth.production';

export {
  createAuthStubRepositories,
  AuthSessionRepositoryStub,
  AuthUserRepositoryStub,
  OAuthStateRepositoryStub,
  type AuthStubOptions,
} from '../auth.stub';

export type {
  AuthRepositoryBundle,
  AuthSessionRepository,
  AuthUserRepository,
  OAuthStateRepository,
  UserQueryRepositoryBundle,
  AuthProductionOptions,
} from '../auth.interfaces';

export type {
  AuthMethod,
  AuthSessionPrincipal,
  AuthSessionRecord,
  AuthUserRole,
  AuthUserStatus,
  AuthUserRecord,
  CreateAuthUserInput,
  UpdateAuthUserInput,
  CreateAuthSessionInput,
  RevokeAuthSessionsInput,
  CreateOAuthStateTokenInput,
  LinkOAuthAccountInput,
  OAuthAccountRecord,
  OAuthProvider,
  OAuthStateTokenRecord,
  AuthUserListFilters,
  SetAuthUserPasswordInput,
} from '../../types/auth';
