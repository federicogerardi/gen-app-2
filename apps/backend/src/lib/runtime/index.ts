export * from './generation-handler';
export type { BackendGenerationRequest } from './request-contract';
export type { BackendError } from './error-contract';
export type { BackendStreamEvent } from './stream-contract';
export type { BackendJsonSessionResult } from './backend-session';
export {
  createAuthHttpRuntime,
  type AuthHttpResponseBody,
  type AuthHttpRuntimeOptions,
  type HandleAuthHttpRequestResult,
} from './auth-http';
export {
  createDefaultAuthIdGenerator,
  createGoogleOAuthRuntime,
  createGoogleOAuthRuntimeFromEnv,
  createDefaultPasswordHashRuntime,
  createDefaultSessionCookieRuntime,
  type AuthIdGenerator,
  type AuthRuntimeContracts,
  type GoogleOAuthIdentity,
  type GoogleOAuthRuntime,
  type GoogleOAuthRuntimeOptions,
  type PasswordHashRuntime,
  type SessionCookieRuntime,
  type PasswordHashRuntimeOptions,
  type SessionCookieRuntimeOptions,
} from './auth-contract';
export {
  applySseHeaders,
  pipeSseStreamToNodeResponse,
  type NodeSsePipeOptions,
} from './http-sse';
export {
  createNodeRuntimeRequestHandler,
  createNodeRuntimeServer,
  type AuthHttpRequestHandler,
  type NodeRuntimeServerOptions,
} from './node-server';
export {
  BriefParseError,
  parseBriefInput,
  type ParseBriefInput,
  type ParseBriefOutput,
  type SupportedBriefFormat,
} from './brief-parser';
export {
  resolveToolPrompt,
  type ResolvedToolPrompt,
} from './tool-prompts';
