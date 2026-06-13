import type { IncomingMessage, ServerResponse } from 'node:http';

import type { AuthRepositoryBundle } from '../../adapters';
import type { AuthSessionPrincipal, AuthUserRole, AuthUserStatus } from '../../types/auth';
import type { PasswordHashRuntime } from '../auth-contract';
import type { GitHubApiConfig } from '../integrations/github-config';
import type { Pool } from 'pg';
import type {
  AuthHttpWriteErrorFn,
  AuthHttpWriteSuccessFn,
} from './support';
import {
  createAdminApiServiceHandlers,
  type AdminApiServiceHandlers,
} from './admin-api-service-handlers';
import {
  createAdminApiServiceBindingHandlers,
  type AdminApiServiceBindingHandlers,
} from './admin-api-service-binding-handlers';
import {
  createAdminFeedbackCenterHandlers,
  type AdminFeedbackCenterHandlers,
} from './admin-feedback-center-handlers';
import {
  createAdminLlmModelHandlers,
  type AdminLlmModelHandlers,
} from './admin-llm-model-handlers';
import {
  createAdminUserHandlers,
  type AdminUserHandlers,
} from './admin-user-handlers';
import {
  createAdminGeometricHandlers,
  type AdminGeometricHandlers,
} from './admin-geometric-handlers';
import type { ScreenshotStorageAdapter } from '../integrations/screenshot-storage';

export type CreateAdminHandlersDependencies = {
  repositories: AuthRepositoryBundle;
  passwordHashing: PasswordHashRuntime;
  now: () => Date;
  githubApiConfig: GitHubApiConfig | null;
  screenshotStorage: ScreenshotStorageAdapter | null;
  requireAdminPrincipal: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => Promise<AuthSessionPrincipal | null>;
  requireDb: (response: ServerResponse) => Pool | null;
  parseJsonBody: <T>(request: IncomingMessage) => Promise<T>;
  parseOptionalNonEmptyString: (value: unknown) => string | undefined;
  parseRequestUrl: (request: IncomingMessage) => URL;
  parseAuthUserRole: (value: unknown) => AuthUserRole | null;
  parseAuthUserStatus: (value: unknown) => AuthUserStatus | null;
  userToResponseData: (user: Awaited<ReturnType<AuthRepositoryBundle['users']['findUserById']>> extends infer U ? (U extends null ? never : U) : never) => Record<string, unknown>;
  writeError: AuthHttpWriteErrorFn;
  writeSuccess: AuthHttpWriteSuccessFn;
};

export type AdminHandlers =
  & AdminLlmModelHandlers
  & AdminApiServiceHandlers
  & AdminApiServiceBindingHandlers
  & AdminFeedbackCenterHandlers
  & AdminUserHandlers
  & AdminGeometricHandlers;

export const createAdminHandlers = (deps: CreateAdminHandlersDependencies): AdminHandlers => {
  const {
    repositories,
    passwordHashing,
    now,
    githubApiConfig,
    screenshotStorage,
    requireAdminPrincipal,
    requireDb,
    parseJsonBody,
    parseOptionalNonEmptyString,
    parseRequestUrl,
    parseAuthUserRole,
    parseAuthUserStatus,
    userToResponseData,
    writeError,
    writeSuccess,
  } = deps;
  const llmModelHandlers = createAdminLlmModelHandlers({
    repositories,
    now,
    requireAdminPrincipal,
    requireDb,
    parseJsonBody,
    writeError,
    writeSuccess,
  });

  const apiServiceHandlers = createAdminApiServiceHandlers({
    repositories,
    now,
    requireAdminPrincipal,
    requireDb,
    parseJsonBody,
    writeError,
    writeSuccess,
  });

  const apiServiceBindingHandlers = createAdminApiServiceBindingHandlers({
    repositories,
    now,
    requireAdminPrincipal,
    requireDb,
    parseJsonBody,
    writeError,
    writeSuccess,
  });

  const feedbackCenterHandlers = createAdminFeedbackCenterHandlers({
    repositories,
    now,
    githubApiConfig,
    requireAdminPrincipal,
    requireDb,
    parseJsonBody,
    parseOptionalNonEmptyString,
    parseRequestUrl,
    writeError,
    writeSuccess,
  });

  const userHandlers = createAdminUserHandlers({
    repositories,
    passwordHashing,
    now,
    requireAdminPrincipal,
    parseJsonBody,
    parseRequestUrl,
    parseAuthUserRole,
    parseAuthUserStatus,
    userToResponseData,
    writeError,
    writeSuccess,
  });

  const geometricHandlers = createAdminGeometricHandlers({
    requireAdminPrincipal,
    requireDb,
    writeError,
    writeSuccess,
    screenshotStorage,
  });

  return {
    ...llmModelHandlers,
    ...apiServiceHandlers,
    ...apiServiceBindingHandlers,
    ...feedbackCenterHandlers,
    ...userHandlers,
    ...geometricHandlers,
  };
};
