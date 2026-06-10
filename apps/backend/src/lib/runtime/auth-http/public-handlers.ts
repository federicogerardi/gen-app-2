import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  createUserReport,
  listPublishedProductChangelogs,
  type AuthRepositoryBundle,
} from '../../adapters';
import { listEnabledModels } from '../../adapters/llm-model.adapter';
import type { AuthSessionPrincipal } from '../../types/auth';
import { normalizeUserReportCategory } from '../feedback-center-policy';
import type { Pool } from 'pg';
import {
  parseJsonBody,
  parseOptionalNonEmptyString,
  writeError,
  writeSuccess,
} from './support';
import { formatZodIssuesForBadRequest, optionalTrimmedString } from './zod-support';
import { z } from 'zod';

export type CreatePublicHandlersDependencies = {
  repositories: AuthRepositoryBundle;
  now: () => Date;
  requireSessionPrincipal: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => Promise<AuthSessionPrincipal | null>;
  requireDb: (response: ServerResponse) => Pool | null;
};

export type PublicHandlers = {
  handleModelsList(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleCreateUserReport(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleListPublishedChangelog(request: IncomingMessage, response: ServerResponse): Promise<void>;
};

const createUserReportRequestSchema = z.object({
  category: z.preprocess(
    (value) => typeof value === 'string' ? value : undefined,
    optionalTrimmedString(),
  ),
  title: z.preprocess(
    (value) => typeof value === 'string' ? value : undefined,
    optionalTrimmedString(),
  ),
  description: z.preprocess(
    (value) => typeof value === 'string' ? value : undefined,
    optionalTrimmedString(),
  ),
});

export const createPublicHandlers = (deps: CreatePublicHandlersDependencies): PublicHandlers => {
  const { repositories, now, requireSessionPrincipal, requireDb } = deps;

  const handleModelsList = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for models list');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) {
      return;
    }

    const pool = requireDb(response);
    if (!pool) {
      return;
    }

    const models = await listEnabledModels(pool);
    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 200, { models });
  };

  const handleCreateUserReport = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for user reports create');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) {
      return;
    }

    const pool = requireDb(response);
    if (!pool) {
      return;
    }

    let rawBody: unknown;
    try {
      rawBody = await parseJsonBody<unknown>(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const parsedBody = createUserReportRequestSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      writeError(response, 400, 'bad_request', formatZodIssuesForBadRequest(parsedBody.error.issues));
      return;
    }

    const body = parsedBody.data;

    const category = normalizeUserReportCategory(parseOptionalNonEmptyString(body.category));
    const title = parseOptionalNonEmptyString(body.title) ?? '';
    const description = parseOptionalNonEmptyString(body.description) ?? '';

    if (!category) {
      writeError(response, 400, 'bad_request', 'Invalid category');
      return;
    }

    if (!title) {
      writeError(response, 400, 'bad_request', 'title is required');
      return;
    }

    if (!description) {
      writeError(response, 400, 'bad_request', 'description is required');
      return;
    }

    const report = await createUserReport(pool, {
      category,
      title,
      description,
      createdByUserId: principal.user.id,
    });

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 201, { report });
  };

  const handleListPublishedChangelog = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for changelog list');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) {
      return;
    }

    const pool = requireDb(response);
    if (!pool) {
      return;
    }

    const changelog = await listPublishedProductChangelogs(pool);
    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 200, { changelog });
  };

  return {
    handleModelsList,
    handleCreateUserReport,
    handleListPublishedChangelog,
  };
};