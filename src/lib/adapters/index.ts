export {
  createInMemoryGenerationAdapters,
  type GenerationAdapters,
  type IdempotencyAdapter,
  type LlmStreamAdapter,
  type LlmStreamEvent,
  type LlmStreamInput,
  type LlmUsageMetrics,
  type PersistenceAdapter,
  type PersistedArtifactStatus,
  type StreamAdapter,
  type UsageDecision,
  type IdempotencyDecision,
  type UsageAdapter,
  createSyntheticLlmStreamAdapter,
} from './generation.adapters';

export {
  createOpenRouterLlmStreamAdapter,
  createOpenRouterLlmStreamAdapterFromEnv,
} from './openrouter.adapter';

export {
  createAuthProductionRepositories,
  PostgresAuthSessionRepository,
  PostgresAuthUserRepository,
  PostgresOAuthStateRepository,
  type AuthProductionClients,
} from './auth.production';

export {
  createAuthStubRepositories,
  AuthSessionRepositoryStub,
  AuthUserRepositoryStub,
  OAuthStateRepositoryStub,
  type AuthStubOptions,
} from './auth.stub';

export { createPostgresRedisGenerationAdapters } from './postgres-redis.adapters';

export {
  createPostgresRedisProductionDependencies,
  createPostgresRedisProductionGenerationAdapters,
  PostgresArtifactQueryRepository,
  PostgresRedisIdempotencyRepository,
  PostgresProjectQueryRepository,
  PostgresRedisStreamSessionRepository,
  PostgresRedisUsageRepository,
  PostgresArtifactRepository as PostgresArtifactRepositoryLive,
  type PostgresRedisProductionClients,
  type PostgresRedisProductionOptions,
} from './postgres-redis.production';

export {
  buildIdempotencyRedisLockKey,
  DEFAULT_IDEMPOTENCY_REDIS_KEY_PREFIX,
} from './postgres-redis.shared';

export {
  createPostgresRedisStubDependencies,
  createPostgresRedisStubGenerationAdapters,
  ArtifactQueryRepositoryStub,
  PostgresArtifactRepositoryStub,
  ProjectQueryRepositoryStub,
  RedisIdempotencyRepositoryStub,
  RedisQuotaRepositoryStub,
  RedisStreamSessionRepositoryStub,
  type StubArtifactQueryRecord,
  type PostgresRedisStubOptions,
} from './postgres-redis.stub';

export type {
  ArtifactQueryRepository,
  PostgresArtifactRepository,
  PostgresRedisAdapterDependencies,
  ProjectQueryRepository,
  ProductionAdapterRuntime,
  RedisIdempotencyRepository,
  RedisQuotaRepository,
  RedisStreamSessionRepository,
} from './postgres-redis.interfaces';

export type {
  AuthProductionOptions,
  AuthRepositoryBundle,
  AuthSessionRepository,
  AuthUserRepository,
  OAuthStateRepository,
  UserQueryRepositoryBundle,
} from './auth.interfaces';

export type {
  ArtifactDetail,
  ArtifactListFilters,
  ArtifactSummary,
} from '../types/artifacts';

export type {
  CreateProjectInput,
  ProjectDetail,
  ProjectSummary,
} from '../types/projects';

export type {
  AuthMethod,
  AuthSessionPrincipal,
  AuthSessionRecord,
  AuthUserListFilters,
  AuthUserRecord,
  AuthUserRole,
  AuthUserStatus,
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
