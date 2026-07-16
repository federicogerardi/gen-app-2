// Generation Context adapter entry point (DDD-164)
// Aggregates all generation-related exports for targeted import

export {
  createInMemoryGenerationAdapters,
  type GenerationAdapters,
  type IdempotencyAdapter,
  type LlmGenerateAdapter,
  type LlmGenerateInput,
  type LlmGenerateResult,
  type LlmStreamAdapter,
  type LlmStreamEvent,
  type LlmStreamInput,
  type LlmUsageMetrics,
  type PersistenceAdapter,
  type StreamAdapter,
  type UsageDecision,
  type IdempotencyDecision,
  type UsageAdapter,
  createSyntheticLlmStreamAdapter,
  createSyntheticLlmGenerateAdapter,
} from '../generation.adapters';

export {
  createOpenRouterLlmStreamAdapter,
  createOpenRouterLlmStreamAdapterFromEnv,
  createOpenRouterLlmGenerateAdapter,
  createOpenRouterLlmGenerateAdapterFromEnv,
} from '../openrouter.adapter';

// ApiService belongs to Generation Context (BCM L53, Glossary L74)
export {
  createApiService,
  deleteApiService,
  getApiServiceById,
  listApiServices,
  resolveApiServiceForAcquisition,
  updateApiService,
  type CreateApiServiceInput,
  type UpdateApiServiceInput,
} from '../api-service.adapter';

// Asset Domain (DDD-188 through DDD-207)
export {
  createAsset,
  getAssetById,
  getAssetByIdForProject,
  updateAsset,
  archiveAsset,
  reactivateAsset,
  listAssets,
  countAssets,
  createAssetGroup,
  addAssetToGroup,
  removeAssetFromGroup,
  getAssetGroupById,
  updateAssetGroup,
  listAssetGroups,
  createAssetVersion,
  getAssetVersions,
  getAssetVersion,
  createDerivationLink,
  getDownstreamAssets,
  getUpstreamAssets,
  listCompatibleAssets,
  detectAssetGaps,
  recordFeedback,
  getArtifactFeedbackScore,
} from '../asset.adapter';

export { createPostgresRedisGenerationAdapters } from '../postgres-redis.adapters';

export {
  createPostgresRedisProductionDependencies,
  createPostgresRedisProductionGenerationAdapters,
  PostgresArtifactQueryRepository,
  PostgresRedisIdempotencyRepository,
  PostgresProjectOwnershipRepository,
  PostgresProjectQueryRepository,
  PostgresRedisStreamSessionRepository,
  PostgresRedisUsageRepository,
  PostgresArtifactRepository as PostgresArtifactRepositoryLive,
  type PostgresRedisProductionClients,
  type PostgresRedisProductionOptions,
} from '../postgres-redis.production';

export {
  buildIdempotencyRedisLockKey,
  DEFAULT_IDEMPOTENCY_REDIS_KEY_PREFIX,
} from '../postgres-redis.shared';

export {
  createPostgresRedisStubDependencies,
  createPostgresRedisStubGenerationAdapters,
  ArtifactQueryRepositoryStub,
  PostgresArtifactRepositoryStub,
  ProjectQueryRepositoryStub,
  ProjectOwnershipRepositoryStub,
  RedisIdempotencyRepositoryStub,
  RedisQuotaRepositoryStub,
  RedisStreamSessionRepositoryStub,
  type StubArtifactQueryRecord,
  type PostgresRedisStubOptions,
} from '../postgres-redis.stub';

export type {
  ArtifactQueryRepository,
  OrchestrateArtifactCache,
  PostgresArtifactRepository,
  PostgresRedisAdapterDependencies,
  ProjectQueryRepository,
  ProductionAdapterRuntime,
  RedisIdempotencyRepository,
  RedisQuotaRepository,
  RedisStreamSessionRepository,
} from '../postgres-redis.interfaces';

export type {
  ArtifactDetail,
  ArtifactListFilters,
  ArtifactSummary,
} from '../../types/artifacts';

export type {
  CreateProjectInput,
  ProjectDetail,
  ProjectSummary,
} from '../../types/projects';
