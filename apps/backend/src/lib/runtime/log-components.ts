import { logger } from './logger';

/** Canonical registry of log component names. Replaces all ad-hoc text prefixes. */
export const LogComponent = {
  SERVER: 'server',
  NODE_SERVER: 'node-server',
  BACKEND_SESSION: 'backend-session',
  GENERATION_HANDLER: 'generation-handler',
  GENERATION_STREAM_OBSERVABILITY: 'generation-stream-observability',
  GENERATION_ROUTE_PIPELINE: 'generation-route-pipeline',
  ORCHESTRATE: 'orchestrate',
  HYDRATE: 'hydrate',
  FEEDBACK_CENTER: 'feedback-center',
  GITHUB_ISSUES: 'github-issues',
  GITHUB_CONFIG: 'github-config',
  SERPAPI_RESOLVER: 'serpapi-resolver',
  OPENROUTER: 'openrouter',
  USER_REPORT: 'user-report',
  USER_REPORT_GITHUB_LINK: 'user-report-github-link',
  POSTGRES_REDIS: 'postgres-redis',
  LLM_ADAPTER: 'llm-adapter',
  SMOKE_CLEANUP: 'smoke-cleanup',
  GEOMETRIC: 'geometric',
  IDEMPOTENCY_COORDINATOR: 'idempotency-coordinator',
  JOB_EVENT_BRIDGE: 'job-event-bridge',
  JOB_PROGRESS_SERIALIZER: 'job-progress-serializer',
  ACTOR_INSPECTOR: 'actor-inspector',
  TOOL_WORKFLOW_JOB_QUEUE: 'tool-workflow-job-queue',
  TOOL_WORKFLOW_JOB_PROCESSOR: 'tool-workflow-job-processor',
  TOOL_WORKFLOW_JOB_HANDLERS: 'tool-workflow-job-handlers',
  TOOL_WORKFLOW_JOB_STREAM: 'tool-workflow-job-stream',
} as const;

/** Create a Pino child logger pre-tagged with a component name. */
export const createComponentLogger = (component: string) =>
  logger.child({ component });
