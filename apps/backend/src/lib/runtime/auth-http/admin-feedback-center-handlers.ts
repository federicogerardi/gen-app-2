import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Pool } from 'pg';
import { z } from 'zod';

import { type AuthRepositoryBundle } from '../../adapters';
import {
  archiveProductChangelog,
  createProductChangelog,
  getUserReportById,
  listProductChangelogs,
  listUserReports,
  publishProductChangelog,
  publishUserReportIssueTransaction,
  updateUserReportStatus,
} from '../../adapters';
import type { AuthSessionPrincipal } from '../../types/auth';
import {
  canPublishUserReportIssue,
  normalizeProductChangelogStatus,
  normalizeUserReportCategory,
  normalizeUserReportStatus,
} from '../feedback-center-policy';
import type { GitHubApiConfig } from '../integrations/github-config';
import { PublishGitHubIssueError, publishGitHubIssue } from '../integrations/github-issues';
import type {
  AuthHttpWriteErrorFn,
  AuthHttpWriteSuccessFn,
} from './support';
import { formatZodIssuesForBadRequest, optionalTrimmedString } from './zod-support';

export type CreateAdminFeedbackCenterHandlersDependencies = {
  repositories: Pick<AuthRepositoryBundle, 'sessions'>;
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
  writeError: AuthHttpWriteErrorFn;
  writeSuccess: AuthHttpWriteSuccessFn;
};

export type AdminFeedbackCenterHandlers = {
  handleAdminCreateChangelog(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleAdminListChangelog(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleAdminArchiveChangelog(request: IncomingMessage, response: ServerResponse, changelogId: string): Promise<void>;
  handleAdminListUserReports(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleAdminUpdateUserReport(request: IncomingMessage, response: ServerResponse, reportId: string): Promise<void>;
  handleAdminPublishUserReportIssue(request: IncomingMessage, response: ServerResponse, reportId: string): Promise<void>;
};

export const createAdminFeedbackCenterHandlers = (
  deps: CreateAdminFeedbackCenterHandlersDependencies,
): AdminFeedbackCenterHandlers => {
  const {
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
  } = deps;

  const optionalRequestString = z.preprocess(
    (value) => typeof value === 'string' ? value : undefined,
    optionalTrimmedString(),
  );

  const adminCreateChangelogRequestSchema = z.object({
    title: optionalRequestString,
    body: optionalRequestString,
    status: optionalRequestString,
  });

  const adminUpdateUserReportRequestSchema = z.object({
    status: optionalRequestString,
  });

  const adminPublishUserReportIssueRequestSchema = z.object({
    owner: optionalRequestString,
    repo: optionalRequestString,
    title: optionalRequestString,
    body: optionalRequestString,
  });

  // Gated debug logging utility
  const debugLog = (message: string, data?: unknown): void => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(message, data ?? '');
    }
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

    let rawBody: unknown;
    try {
      rawBody = await parseJsonBody<unknown>(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const parsedBody = adminCreateChangelogRequestSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      writeError(response, 400, 'bad_request', formatZodIssuesForBadRequest(parsedBody.error.issues));
      return;
    }

    const body = parsedBody.data;

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

    let rawBody: unknown;
    try {
      rawBody = await parseJsonBody<unknown>(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const parsedBody = adminUpdateUserReportRequestSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      writeError(response, 400, 'bad_request', formatZodIssuesForBadRequest(parsedBody.error.issues));
      return;
    }

    const body = parsedBody.data;

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
    debugLog('[POST /api/admin/user-reports/:id/publish-issue] handleAdminPublishUserReportIssue called', { reportId });
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for user report issue publish');
      return;
    }

    const adminPrincipal = await requireAdminPrincipal(request, response);
    if (!adminPrincipal) {
      debugLog('[POST /api/admin/user-reports/:id/publish-issue] No admin principal found');
      return;
    }
    debugLog('[POST /api/admin/user-reports/:id/publish-issue] Admin principal:', { userId: adminPrincipal.user.id, email: adminPrincipal.user.email });

    const pool = requireDb(response);
    if (!pool) {
      debugLog('[POST /api/admin/user-reports/:id/publish-issue] No database pool available');
      return;
    }

    let rawBody: unknown;
    try {
      rawBody = await parseJsonBody<unknown>(request);
    } catch (error) {
      debugLog('[POST /api/admin/user-reports/:id/publish-issue] JSON parsing error:', error);
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const parsedBody = adminPublishUserReportIssueRequestSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      writeError(response, 400, 'bad_request', formatZodIssuesForBadRequest(parsedBody.error.issues));
      return;
    }

    const body = parsedBody.data;
    debugLog('[POST /api/admin/user-reports/:id/publish-issue] Request body parsed:', { body });

    const report = await getUserReportById(pool, reportId);
    if (!report) {
      debugLog('[POST /api/admin/user-reports/:id/publish-issue] Report not found:', { reportId });
      writeError(response, 404, 'not_found', 'User report not found');
      return;
    }
    debugLog('[POST /api/admin/user-reports/:id/publish-issue] Report found:', { id: report.id, category: report.category, status: report.status });

    if (!canPublishUserReportIssue(report.category, report.status)) {
      debugLog('[POST /api/admin/user-reports/:id/publish-issue] Report cannot be published from current state:', { category: report.category, status: report.status });
      writeError(response, 409, 'conflict', 'User report cannot be published as GitHub issue from current state');
      return;
    }

    if (!githubApiConfig) {
      debugLog('[POST /api/admin/user-reports/:id/publish-issue] GitHub API config not available');
      writeError(response, 503, 'service_unavailable', 'GitHub integration is not configured');
      return;
    }
    debugLog('[POST /api/admin/user-reports/:id/publish-issue] GitHub API config loaded');

    const owner = parseOptionalNonEmptyString(body.owner) ?? githubApiConfig.owner;
    const repo = parseOptionalNonEmptyString(body.repo) ?? githubApiConfig.repo;
    if (!owner || !repo) {
      debugLog('[POST /api/admin/user-reports/:id/publish-issue] Missing owner or repo:', { owner, repo });
      writeError(response, 400, 'bad_request', 'owner and repo are required');
      return;
    }
    debugLog('[POST /api/admin/user-reports/:id/publish-issue] GitHub target repo resolved:', { owner, repo });

    const issueTitle = parseOptionalNonEmptyString(body.title) ?? `[${report.category}] ${report.title}`;
    const issueBody = parseOptionalNonEmptyString(body.body)
      ?? [
        `User report id: ${report.id}`,
        `Category: ${report.category}`,
        '',
        report.description,
      ].join('\n');

    debugLog('[POST /api/admin/user-reports/:id/publish-issue] Issue content prepared:', { titleLength: issueTitle.length, bodyLength: issueBody.length });

    try {
      const requestId = typeof request.headers['x-request-id'] === 'string'
        ? request.headers['x-request-id']
        : undefined;
      debugLog('[POST /api/admin/user-reports/:id/publish-issue] Publishing to GitHub...', { owner, repo, requestId });

      const issue = await publishGitHubIssue(githubApiConfig, {
        owner,
        repo,
        title: issueTitle,
        body: issueBody,
        ...(requestId ? { requestId } : {}),
      });
      debugLog('[POST /api/admin/user-reports/:id/publish-issue] GitHub issue published successfully:', { issueNumber: issue.issueNumber, issueUrl: issue.issueUrl });

      debugLog('[POST /api/admin/user-reports/:id/publish-issue] Creating database transaction for GitHub link...', { reportId, issueNumber: issue.issueNumber });
      const githubLink = await publishUserReportIssueTransaction(pool, {
        userReportId: report.id,
        repository: `${owner}/${repo}`,
        issueNumber: issue.issueNumber,
        issueUrl: issue.issueUrl,
        publishedByUserId: adminPrincipal.user.id,
      });
      debugLog('[POST /api/admin/user-reports/:id/publish-issue] GitHub link transaction completed:', { linkId: githubLink.userReportId });

      await repositories.sessions.touchSession(adminPrincipal.session.id, now());
      debugLog('[POST /api/admin/user-reports/:id/publish-issue] Session touched, returning success response');
      writeSuccess(response, 200, {
        githubLink,
      });
    } catch (error) {
      console.error('[POST /api/admin/user-reports/:id/publish-issue] Error during publication:', error instanceof Error ? { message: error.message, stack: error.stack } : error);
      if (error instanceof PublishGitHubIssueError) {
        debugLog('[POST /api/admin/user-reports/:id/publish-issue] PublishGitHubIssueError:', { code: error.code, statusCode: error.statusCode, message: error.message });
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

  return {
    handleAdminCreateChangelog,
    handleAdminListChangelog,
    handleAdminArchiveChangelog,
    handleAdminListUserReports,
    handleAdminUpdateUserReport,
    handleAdminPublishUserReportIssue,
  };
};