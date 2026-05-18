import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

import {
  archiveProductChangelog,
  createProductChangelog,
  createUserReport,
  getUserReportById,
  listProductChangelogs,
  listPublishedProductChangelogs,
  listUserReports,
  publishProductChangelog,
  publishUserReportIssueTransaction,
  updateUserReportStatus,
  type AuthRepositoryBundle,
} from '../../adapters';
import {
  createModel,
  deleteModel,
  listAllModels,
  listEnabledModels,
  updateModel,
} from '../../adapters/llm-model.adapter';
import type { AuthSessionPrincipal, AuthUserRole, AuthUserStatus, UpdateAuthUserInput } from '../../types/auth';
import type { LlmModelStatus } from '../../types/llm-model';
import type { PasswordHashRuntime } from '../auth-contract';
import {
  canPublishUserReportIssue,
  normalizeProductChangelogStatus,
  normalizeUserReportCategory,
  normalizeUserReportStatus,
} from '../feedback-center-policy';
import type { GitHubApiConfig } from '../integrations/github-config';
import { PublishGitHubIssueError, publishGitHubIssue } from '../integrations/github-issues';
import type { Pool } from 'pg';
import type { CreateUserReportRequestBody } from './support';

type AdminCreateUserRequestBody = {
  email?: unknown;
  role?: unknown;
  status?: unknown;
  monthlyQuota?: unknown;
  monthlyUsed?: unknown;
  password?: unknown;
};

type AdminUpdateUserRequestBody = {
  email?: unknown;
  role?: unknown;
  status?: unknown;
  monthlyQuota?: unknown;
  monthlyUsed?: unknown;
  password?: unknown;
};

type AdminCreateChangelogRequestBody = {
  title?: unknown;
  body?: unknown;
  status?: unknown;
};

type AdminUpdateUserReportRequestBody = {
  status?: unknown;
};

type AdminPublishUserReportIssueRequestBody = {
  owner?: unknown;
  repo?: unknown;
  title?: unknown;
  body?: unknown;
};

type WriteError = (
  response: ServerResponse,
  statusCode: number,
  code:
    | 'bad_request'
    | 'unauthorized'
    | 'forbidden'
    | 'method_not_allowed'
    | 'not_found'
    | 'conflict'
    | 'service_unavailable'
    | 'internal',
  message: string,
) => void;

type WriteSuccess = (response: ServerResponse, statusCode: number, data: Record<string, unknown>) => void;

export type CreateAdminHandlersDependencies = {
  repositories: AuthRepositoryBundle;
  passwordHashing: PasswordHashRuntime;
  now: () => Date;
  githubApiConfig: GitHubApiConfig | null;
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
  writeError: WriteError;
  writeSuccess: WriteSuccess;
};

export type AdminHandlers = {
  handleModelsList(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleAdminModelsList(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleAdminModelsCreate(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleAdminModelsUpdate(request: IncomingMessage, response: ServerResponse, modelId: string): Promise<void>;
  handleAdminModelsDelete(request: IncomingMessage, response: ServerResponse, modelId: string): Promise<void>;
  handleCreateUserReport(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleListPublishedChangelog(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleAdminCreateChangelog(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleAdminListChangelog(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleAdminArchiveChangelog(request: IncomingMessage, response: ServerResponse, changelogId: string): Promise<void>;
  handleAdminListUserReports(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleAdminUpdateUserReport(request: IncomingMessage, response: ServerResponse, reportId: string): Promise<void>;
  handleAdminPublishUserReportIssue(request: IncomingMessage, response: ServerResponse, reportId: string): Promise<void>;
  handleAdminListUsers(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleAdminCreateUser(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleAdminGetUser(request: IncomingMessage, response: ServerResponse, userId: string): Promise<void>;
  handleAdminUpdateUser(request: IncomingMessage, response: ServerResponse, userId: string): Promise<void>;
  handleAdminDeleteUser(request: IncomingMessage, response: ServerResponse, userId: string): Promise<void>;
};

export const createAdminHandlers = (deps: CreateAdminHandlersDependencies): AdminHandlers => {
  const {
    repositories,
    passwordHashing,
    now,
    githubApiConfig,
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

  const LLM_MODEL_KEY_REGEX = /^[a-zA-Z0-9/_\-.]+$/;

  const handleModelsList = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for models list');
      return;
    }

    const principal = await requireAdminPrincipal(request, response);
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

  const handleAdminModelsList = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for admin models list');
      return;
    }

    const principal = await requireAdminPrincipal(request, response);
    if (!principal) {
      return;
    }

    const pool = requireDb(response);
    if (!pool) {
      return;
    }

    const models = await listAllModels(pool);
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

    const principal = await requireAdminPrincipal(request, response);
    if (!principal) {
      return;
    }

    const pool = requireDb(response);
    if (!pool) {
      return;
    }

    let body: CreateUserReportRequestBody;
    try {
      body = await parseJsonBody<CreateUserReportRequestBody>(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

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

    const principal = await requireAdminPrincipal(request, response);
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

  const handleAdminModelsCreate = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for admin model create');
      return;
    }

    const principal = await requireAdminPrincipal(request, response);
    if (!principal) {
      return;
    }

    const pool = requireDb(response);
    if (!pool) {
      return;
    }

    let body: Record<string, unknown>;
    try {
      body = await parseJsonBody<Record<string, unknown>>(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const key = typeof body.key === 'string' ? body.key.trim() : '';
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    const status = typeof body.status === 'string' ? body.status.trim() : 'enabled';
    const sortOrder = typeof body.sortOrder === 'number' ? body.sortOrder : undefined;
    const isDefault = typeof body.isDefault === 'boolean' ? body.isDefault : false;

    if (!key || key.length > 128 || !LLM_MODEL_KEY_REGEX.test(key)) {
      writeError(response, 400, 'bad_request', 'key must be 1-128 chars matching [a-zA-Z0-9/_-.]');
      return;
    }

    if (!label || label.length > 256) {
      writeError(response, 400, 'bad_request', 'label must be 1-256 chars');
      return;
    }

    if (status !== 'enabled' && status !== 'disabled') {
      writeError(response, 400, 'bad_request', 'status must be enabled or disabled');
      return;
    }

    const model = await createModel(pool, {
      key,
      label,
      status: status as LlmModelStatus,
      isDefault,
      ...(sortOrder !== undefined ? { sortOrder } : {}),
    });
    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 201, { model });
  };

  const handleAdminModelsUpdate = async (
    request: IncomingMessage,
    response: ServerResponse,
    modelId: string,
  ): Promise<void> => {
    if (request.method !== 'PUT') {
      writeError(response, 405, 'method_not_allowed', 'Use PUT for admin model update');
      return;
    }

    const principal = await requireAdminPrincipal(request, response);
    if (!principal) {
      return;
    }

    const pool = requireDb(response);
    if (!pool) {
      return;
    }

    let body: Record<string, unknown>;
    try {
      body = await parseJsonBody<Record<string, unknown>>(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const payload: Partial<{ key: string; label: string; status: LlmModelStatus; isDefault: boolean; sortOrder: number }> = {};

    if (body.key !== undefined) {
      const key = typeof body.key === 'string' ? body.key.trim() : '';
      if (!key || key.length > 128 || !LLM_MODEL_KEY_REGEX.test(key)) {
        writeError(response, 400, 'bad_request', 'key must be 1-128 chars matching [a-zA-Z0-9/_-.]');
        return;
      }
      payload.key = key;
    }

    if (body.label !== undefined) {
      const label = typeof body.label === 'string' ? body.label.trim() : '';
      if (!label || label.length > 256) {
        writeError(response, 400, 'bad_request', 'label must be 1-256 chars');
        return;
      }
      payload.label = label;
    }

    if (body.status !== undefined) {
      const status = typeof body.status === 'string' ? body.status.trim() : '';
      if (status !== 'enabled' && status !== 'disabled') {
        writeError(response, 400, 'bad_request', 'status must be enabled or disabled');
        return;
      }
      payload.status = status as LlmModelStatus;
    }

    if (body.sortOrder !== undefined) {
      if (typeof body.sortOrder !== 'number') {
        writeError(response, 400, 'bad_request', 'sortOrder must be a number');
        return;
      }
      payload.sortOrder = body.sortOrder;
    }

    if (body.isDefault !== undefined) {
      if (typeof body.isDefault !== 'boolean') {
        writeError(response, 400, 'bad_request', 'isDefault must be a boolean');
        return;
      }
      payload.isDefault = body.isDefault;
    }

    const model = await updateModel(pool, modelId, payload);
    if (!model) {
      writeError(response, 404, 'not_found', 'Model not found');
      return;
    }

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 200, { model });
  };

  const handleAdminModelsDelete = async (
    request: IncomingMessage,
    response: ServerResponse,
    modelId: string,
  ): Promise<void> => {
    if (request.method !== 'DELETE') {
      writeError(response, 405, 'method_not_allowed', 'Use DELETE for admin model delete');
      return;
    }

    const principal = await requireAdminPrincipal(request, response);
    if (!principal) {
      return;
    }

    const pool = requireDb(response);
    if (!pool) {
      return;
    }

    const deleted = await deleteModel(pool, modelId);
    if (!deleted) {
      writeError(response, 404, 'not_found', 'Model not found');
      return;
    }

    await repositories.sessions.touchSession(principal.session.id, now());
    response.statusCode = 204;
    response.end('');
  };

  const handleAdminCreateChangelog = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for changelog create');
      return;
    }

    const adminPrincipal = await requireAdminPrincipal(request, response);
    if (!adminPrincipal) {
      return;
    }

    const pool = requireDb(response);
    if (!pool) {
      return;
    }

    let body: AdminCreateChangelogRequestBody;
    try {
      body = await parseJsonBody<AdminCreateChangelogRequestBody>(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const title = parseOptionalNonEmptyString(body.title) ?? '';
    const changelogBody = parseOptionalNonEmptyString(body.body) ?? '';
    const requestedStatus = normalizeProductChangelogStatus(parseOptionalNonEmptyString(body.status));

    if (!title) {
      writeError(response, 400, 'bad_request', 'title is required');
      return;
    }

    if (!changelogBody) {
      writeError(response, 400, 'bad_request', 'body is required');
      return;
    }

    let changelog = await createProductChangelog(pool, {
      title,
      body: changelogBody,
      createdByUserId: adminPrincipal.user.id,
    });

    if (requestedStatus === 'published') {
      const published = await publishProductChangelog(pool, {
        id: changelog.id,
        publishedByUserId: adminPrincipal.user.id,
      });

      if (published) {
        changelog = published;
      }
    }

    await repositories.sessions.touchSession(adminPrincipal.session.id, now());
    writeSuccess(response, 201, { changelog });
  };

  const handleAdminListChangelog = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for changelog list');
      return;
    }

    const adminPrincipal = await requireAdminPrincipal(request, response);
    if (!adminPrincipal) {
      return;
    }

    const pool = requireDb(response);
    if (!pool) {
      return;
    }

    const changelogs = await listProductChangelogs(pool);
    await repositories.sessions.touchSession(adminPrincipal.session.id, now());
    writeSuccess(response, 200, { changelogs });
  };

  const handleAdminArchiveChangelog = async (
    request: IncomingMessage,
    response: ServerResponse,
    changelogId: string,
  ): Promise<void> => {
    if (request.method !== 'PATCH') {
      writeError(response, 405, 'method_not_allowed', 'Use PATCH for changelog archive');
      return;
    }

    const adminPrincipal = await requireAdminPrincipal(request, response);
    if (!adminPrincipal) {
      return;
    }

    const pool = requireDb(response);
    if (!pool) {
      return;
    }

    const archived = await archiveProductChangelog(pool, {
      id: changelogId,
      archivedByUserId: adminPrincipal.user.id,
    });

    if (!archived) {
      writeError(response, 404, 'not_found', 'Product changelog not found');
      return;
    }

    await repositories.sessions.touchSession(adminPrincipal.session.id, now());
    writeSuccess(response, 200, { changelog: archived });
  };

  const handleAdminListUserReports = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for user reports list');
      return;
    }

    const adminPrincipal = await requireAdminPrincipal(request, response);
    if (!adminPrincipal) {
      return;
    }

    const pool = requireDb(response);
    if (!pool) {
      return;
    }

    const url = parseRequestUrl(request);
    const status = normalizeUserReportStatus(url.searchParams.get('status') ?? undefined);
    const category = normalizeUserReportCategory(url.searchParams.get('category') ?? undefined);

    if (url.searchParams.has('status') && !status) {
      writeError(response, 400, 'bad_request', 'Invalid status filter');
      return;
    }

    if (url.searchParams.has('category') && !category) {
      writeError(response, 400, 'bad_request', 'Invalid category filter');
      return;
    }

    const reports = await listUserReports(pool, {
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
    });

    await repositories.sessions.touchSession(adminPrincipal.session.id, now());
    writeSuccess(response, 200, { reports });
  };

  const handleAdminUpdateUserReport = async (
    request: IncomingMessage,
    response: ServerResponse,
    reportId: string,
  ): Promise<void> => {
    if (request.method !== 'PATCH') {
      writeError(response, 405, 'method_not_allowed', 'Use PATCH for user report update');
      return;
    }

    const adminPrincipal = await requireAdminPrincipal(request, response);
    if (!adminPrincipal) {
      return;
    }

    const pool = requireDb(response);
    if (!pool) {
      return;
    }

    let body: AdminUpdateUserReportRequestBody;
    try {
      body = await parseJsonBody<AdminUpdateUserReportRequestBody>(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const status = normalizeUserReportStatus(parseOptionalNonEmptyString(body.status));
    if (!status) {
      writeError(response, 400, 'bad_request', 'Invalid status');
      return;
    }

    if (status !== 'triaged' && status !== 'closed') {
      writeError(response, 400, 'bad_request', 'Only triaged and closed transitions are supported by this endpoint');
      return;
    }

    const report = await updateUserReportStatus(pool, {
      id: reportId,
      status,
      actedByUserId: adminPrincipal.user.id,
    });

    if (!report) {
      writeError(response, 404, 'not_found', 'User report not found');
      return;
    }

    await repositories.sessions.touchSession(adminPrincipal.session.id, now());
    writeSuccess(response, 200, { report });
  };

  const handleAdminPublishUserReportIssue = async (
    request: IncomingMessage,
    response: ServerResponse,
    reportId: string,
  ): Promise<void> => {
    console.debug('[POST /api/admin/user-reports/:id/publish-issue] handleAdminPublishUserReportIssue called', { reportId });
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for user report issue publish');
      return;
    }

    const adminPrincipal = await requireAdminPrincipal(request, response);
    if (!adminPrincipal) {
      console.debug('[POST /api/admin/user-reports/:id/publish-issue] No admin principal found');
      return;
    }
    console.debug('[POST /api/admin/user-reports/:id/publish-issue] Admin principal:', { userId: adminPrincipal.user.id, email: adminPrincipal.user.email });

    const pool = requireDb(response);
    if (!pool) {
      console.debug('[POST /api/admin/user-reports/:id/publish-issue] No database pool available');
      return;
    }

    let body: AdminPublishUserReportIssueRequestBody;
    try {
      body = await parseJsonBody<AdminPublishUserReportIssueRequestBody>(request);
    } catch (error) {
      console.debug('[POST /api/admin/user-reports/:id/publish-issue] JSON parsing error:', error);
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }
    console.debug('[POST /api/admin/user-reports/:id/publish-issue] Request body parsed:', { body });

    const report = await getUserReportById(pool, reportId);
    if (!report) {
      console.debug('[POST /api/admin/user-reports/:id/publish-issue] Report not found:', { reportId });
      writeError(response, 404, 'not_found', 'User report not found');
      return;
    }
    console.debug('[POST /api/admin/user-reports/:id/publish-issue] Report found:', { id: report.id, category: report.category, status: report.status });

    if (!canPublishUserReportIssue(report.category, report.status)) {
      console.debug('[POST /api/admin/user-reports/:id/publish-issue] Report cannot be published from current state:', { category: report.category, status: report.status });
      writeError(response, 409, 'conflict', 'User report cannot be published as GitHub issue from current state');
      return;
    }

    if (!githubApiConfig) {
      console.debug('[POST /api/admin/user-reports/:id/publish-issue] GitHub API config not available');
      writeError(response, 503, 'service_unavailable', 'GitHub integration is not configured');
      return;
    }
    console.debug('[POST /api/admin/user-reports/:id/publish-issue] GitHub API config loaded');

    const owner = parseOptionalNonEmptyString(body.owner) ?? githubApiConfig.owner;
    const repo = parseOptionalNonEmptyString(body.repo) ?? githubApiConfig.repo;
    if (!owner || !repo) {
      console.debug('[POST /api/admin/user-reports/:id/publish-issue] Missing owner or repo:', { owner, repo });
      writeError(response, 400, 'bad_request', 'owner and repo are required');
      return;
    }
    console.debug('[POST /api/admin/user-reports/:id/publish-issue] GitHub target repo resolved:', { owner, repo });

    const issueTitle = parseOptionalNonEmptyString(body.title) ?? `[${report.category}] ${report.title}`;
    const issueBody = parseOptionalNonEmptyString(body.body)
      ?? [
        `User report id: ${report.id}`,
        `Category: ${report.category}`,
        '',
        report.description,
      ].join('\n');

    console.debug('[POST /api/admin/user-reports/:id/publish-issue] Issue content prepared:', { titleLength: issueTitle.length, bodyLength: issueBody.length });

    try {
      const requestId = typeof request.headers['x-request-id'] === 'string'
        ? request.headers['x-request-id']
        : undefined;
      console.debug('[POST /api/admin/user-reports/:id/publish-issue] Publishing to GitHub...', { owner, repo, requestId });

      const issue = await publishGitHubIssue(githubApiConfig, {
        owner,
        repo,
        title: issueTitle,
        body: issueBody,
        ...(requestId ? { requestId } : {}),
      });
      console.debug('[POST /api/admin/user-reports/:id/publish-issue] GitHub issue published successfully:', { issueNumber: issue.issueNumber, issueUrl: issue.issueUrl });

      console.debug('[POST /api/admin/user-reports/:id/publish-issue] Creating database transaction for GitHub link...', { reportId, issueNumber: issue.issueNumber });
      const githubLink = await publishUserReportIssueTransaction(pool, {
        userReportId: report.id,
        repository: `${owner}/${repo}`,
        issueNumber: issue.issueNumber,
        issueUrl: issue.issueUrl,
        publishedByUserId: adminPrincipal.user.id,
      });
      console.debug('[POST /api/admin/user-reports/:id/publish-issue] GitHub link transaction completed:', { linkId: githubLink.userReportId });

      await repositories.sessions.touchSession(adminPrincipal.session.id, now());
      console.debug('[POST /api/admin/user-reports/:id/publish-issue] Session touched, returning success response');
      writeSuccess(response, 200, {
        githubLink,
      });
    } catch (error) {
      console.error('[POST /api/admin/user-reports/:id/publish-issue] Error during publication:', error instanceof Error ? { message: error.message, stack: error.stack } : error);
      if (error instanceof PublishGitHubIssueError) {
        console.debug('[POST /api/admin/user-reports/:id/publish-issue] PublishGitHubIssueError:', { code: error.code, statusCode: error.statusCode, message: error.message });
        if (error.code === 'auth_error') {
          writeError(response, 401, 'unauthorized', error.message);
          return;
        }

        if (error.code === 'forbidden') {
          writeError(response, 403, 'forbidden', error.message);
          return;
        }

        if (error.code === 'not_found') {
          writeError(response, 404, 'not_found', error.message);
          return;
        }

        if (error.code === 'validation_error') {
          writeError(response, 400, 'bad_request', error.message);
          return;
        }

        writeError(response, 503, 'service_unavailable', error.message);
        return;
      }

      writeError(response, 500, 'internal', 'Unexpected error while publishing GitHub issue');
    }
  };

  const handleAdminListUsers = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for users list');
      return;
    }

    const adminPrincipal = await requireAdminPrincipal(request, response);
    if (!adminPrincipal) {
      return;
    }

    const url = parseRequestUrl(request);
    const query = url.searchParams.get('q') ?? undefined;
    const statusRaw = url.searchParams.get('status');
    const status = statusRaw ? parseAuthUserStatus(statusRaw) : undefined;
    if (statusRaw && !status) {
      writeError(response, 400, 'bad_request', 'Invalid status filter');
      return;
    }

    const users = await repositories.users.listUsers({
      ...(status ? { status } : {}),
      ...(query ? { query } : {}),
    });

    await repositories.sessions.touchSession(adminPrincipal.session.id, now());
    writeSuccess(response, 200, {
      users: users.map(userToResponseData),
    });
  };

  const handleAdminCreateUser = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for create user');
      return;
    }

    const adminPrincipal = await requireAdminPrincipal(request, response);
    if (!adminPrincipal) {
      return;
    }

    let body: AdminCreateUserRequestBody;
    try {
      body = await parseJsonBody<AdminCreateUserRequestBody>(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const email = typeof body.email === 'string' ? body.email.trim() : '';
    if (!email) {
      writeError(response, 400, 'bad_request', 'Email is required');
      return;
    }

    const role = body.role === undefined
      ? 'member'
      : parseAuthUserRole(body.role);
    if (!role) {
      writeError(response, 400, 'bad_request', 'Invalid role');
      return;
    }

    const status = body.status === undefined
      ? 'active'
      : parseAuthUserStatus(body.status);
    if (!status) {
      writeError(response, 400, 'bad_request', 'Invalid status');
      return;
    }

    const existing = await repositories.users.findUserByEmail(email);
    if (existing) {
      writeError(response, 409, 'conflict', 'User already exists');
      return;
    }

    const password = typeof body.password === 'string' ? body.password : null;
    const passwordHash = password
      ? await passwordHashing.hashPassword(password)
      : null;

    const created = await repositories.users.createUser({
      id: `usr_${randomUUID()}`,
      email,
      role,
      status,
      ...(typeof body.monthlyQuota === 'number' ? { monthlyQuota: body.monthlyQuota } : {}),
      ...(typeof body.monthlyUsed === 'number' ? { monthlyUsed: body.monthlyUsed } : {}),
      ...(passwordHash
        ? {
            passwordHash,
            passwordAlgo: passwordHashing.passwordAlgorithm,
            passwordChangedAt: now(),
          }
        : {}),
      createdByAdminUserId: adminPrincipal.user.id,
    });

    await repositories.sessions.touchSession(adminPrincipal.session.id, now());
    writeSuccess(response, 201, {
      user: userToResponseData(created),
    });
  };

  const handleAdminGetUser = async (
    request: IncomingMessage,
    response: ServerResponse,
    userId: string,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for user details');
      return;
    }

    const adminPrincipal = await requireAdminPrincipal(request, response);
    if (!adminPrincipal) {
      return;
    }

    const user = await repositories.users.findUserById(userId);
    if (!user) {
      writeError(response, 404, 'not_found', 'User not found');
      return;
    }

    await repositories.sessions.touchSession(adminPrincipal.session.id, now());
    writeSuccess(response, 200, {
      user: userToResponseData(user),
    });
  };

  const handleAdminUpdateUser = async (
    request: IncomingMessage,
    response: ServerResponse,
    userId: string,
  ): Promise<void> => {
    if (request.method !== 'PATCH') {
      writeError(response, 405, 'method_not_allowed', 'Use PATCH for update user');
      return;
    }

    const adminPrincipal = await requireAdminPrincipal(request, response);
    if (!adminPrincipal) {
      return;
    }

    let body: AdminUpdateUserRequestBody;
    try {
      body = await parseJsonBody<AdminUpdateUserRequestBody>(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const parsedRole = body.role === undefined ? undefined : parseAuthUserRole(body.role);
    if (body.role !== undefined && !parsedRole) {
      writeError(response, 400, 'bad_request', 'Invalid role');
      return;
    }

    const parsedStatus = body.status === undefined ? undefined : parseAuthUserStatus(body.status);
    if (body.status !== undefined && !parsedStatus) {
      writeError(response, 400, 'bad_request', 'Invalid status');
      return;
    }

    const nextEmail = typeof body.email === 'string' ? body.email.trim() : undefined;
    if (body.email !== undefined && !nextEmail) {
      writeError(response, 400, 'bad_request', 'Invalid email');
      return;
    }

    const password = typeof body.password === 'string' ? body.password : undefined;

    const updateInput: UpdateAuthUserInput = {};
    if (nextEmail !== undefined) {
      updateInput.email = nextEmail;
    }
    if (parsedRole !== undefined && parsedRole !== null) {
      updateInput.role = parsedRole;
    }
    if (parsedStatus !== undefined && parsedStatus !== null) {
      updateInput.status = parsedStatus;
    }
    if (typeof body.monthlyQuota === 'number') {
      updateInput.monthlyQuota = body.monthlyQuota;
    }
    if (typeof body.monthlyUsed === 'number') {
      updateInput.monthlyUsed = body.monthlyUsed;
    }
    if (parsedStatus === 'disabled') {
      updateInput.disabledAt = now();
    }

    const updated = await repositories.users.updateUser(userId, updateInput);

    if (!updated) {
      writeError(response, 404, 'not_found', 'User not found');
      return;
    }

    if (password) {
      const passwordHash = await passwordHashing.hashPassword(password);
      await repositories.users.setPassword(userId, {
        passwordHash,
        passwordAlgo: passwordHashing.passwordAlgorithm,
        passwordChangedAt: now(),
        ...(parsedStatus ? { nextStatus: parsedStatus } : {}),
      });
    }

    const reloaded = await repositories.users.findUserById(userId);
    if (!reloaded) {
      writeError(response, 404, 'not_found', 'User not found');
      return;
    }

    await repositories.sessions.touchSession(adminPrincipal.session.id, now());
    writeSuccess(response, 200, {
      user: userToResponseData(reloaded),
    });
  };

  const handleAdminDeleteUser = async (
    request: IncomingMessage,
    response: ServerResponse,
    userId: string,
  ): Promise<void> => {
    if (request.method !== 'DELETE') {
      writeError(response, 405, 'method_not_allowed', 'Use DELETE for disable user');
      return;
    }

    const adminPrincipal = await requireAdminPrincipal(request, response);
    if (!adminPrincipal) {
      return;
    }

    const updated = await repositories.users.updateUser(userId, {
      status: 'disabled',
      disabledAt: now(),
    });

    if (!updated) {
      writeError(response, 404, 'not_found', 'User not found');
      return;
    }

    await repositories.sessions.revokeUserSessions({
      userId,
      revokedAt: now(),
    });
    await repositories.sessions.touchSession(adminPrincipal.session.id, now());

    response.statusCode = 204;
    response.end('');
  };

  return {
    handleModelsList,
    handleAdminModelsList,
    handleAdminModelsCreate,
    handleAdminModelsUpdate,
    handleAdminModelsDelete,
    handleCreateUserReport,
    handleListPublishedChangelog,
    handleAdminCreateChangelog,
    handleAdminListChangelog,
    handleAdminArchiveChangelog,
    handleAdminListUserReports,
    handleAdminUpdateUserReport,
    handleAdminPublishUserReportIssue,
    handleAdminListUsers,
    handleAdminCreateUser,
    handleAdminGetUser,
    handleAdminUpdateUser,
    handleAdminDeleteUser,
  };
};
