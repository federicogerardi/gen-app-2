import type { IncomingMessage, ServerResponse } from 'node:http';

import type { AuthRepositoryBundle, UserQueryRepositoryBundle } from '../../../adapters';
import { SessionQueryAdapter } from '../../../adapters/session-query.adapter';
import type { AuthSessionPrincipal } from '../../../types/auth';
import { contentTypeForFormat, parseDownloadFormat } from '../../downloads/download-format';
import { contentDispositionAttachment, sessionDownloadFilename } from '../../downloads/download-filename';
import { serializeSessionDownload } from '../../downloads/download-serializers';
import { TOOL_WORKFLOW_REGISTRY, isSupportedToolWorkflow } from '../../tool-workflow-registry';
import { parseArtifactReadProjection } from '../projects/projects-handlers';
import type { AuthHttpWriteErrorFn, AuthHttpWriteSuccessFn } from '../support';

export type CreateAdminSessionHandlersDependencies = {
  repositories: Pick<AuthRepositoryBundle, 'sessions'>;
  now: () => Date;
  parseRequestUrl: (request: IncomingMessage) => URL;
  requireAdminPrincipal: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => Promise<AuthSessionPrincipal | null>;
  requireQueryRepositories: (response: ServerResponse) => UserQueryRepositoryBundle | null;
  writeError: AuthHttpWriteErrorFn;
  writeSuccess: AuthHttpWriteSuccessFn;
};

export type AdminSessionHandlers = {
  handleAdminSessionsList(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleAdminSessionArtifacts(request: IncomingMessage, response: ServerResponse, sessionId: string): Promise<void>;
  handleAdminSessionDownload(request: IncomingMessage, response: ServerResponse, sessionId: string): Promise<void>;
};

export const createAdminSessionHandlers = (
  deps: CreateAdminSessionHandlersDependencies,
): AdminSessionHandlers => {
  const {
    repositories,
    now,
    parseRequestUrl,
    requireAdminPrincipal,
    requireQueryRepositories,
    writeError,
    writeSuccess,
  } = deps;

  const handleAdminSessionsList = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for admin sessions list');
      return;
    }

    const principal = await requireAdminPrincipal(request, response);
    if (!principal) {
      return;
    }

    const queries = requireQueryRepositories(response);
    if (!queries) {
      return;
    }

    const searchParams = parseRequestUrl(request).searchParams;
    const projectIdParam = searchParams.get('projectId');
    const projectId = projectIdParam && projectIdParam.trim().length > 0 ? projectIdParam.trim() : null;

    const limitParam = searchParams.get('limit');
    let limit: number | undefined;
    if (limitParam && limitParam.trim().length > 0) {
      const parsed = Number.parseInt(limitParam, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        writeError(response, 400, 'bad_request', 'limit must be a positive integer');
        return;
      }

      limit = Math.min(parsed, 500);
    }

    const cursorParam = searchParams.get('cursor');
    const cursor = cursorParam && cursorParam.trim().length > 0 ? cursorParam.trim() : null;
    if (cursor && !SessionQueryAdapter.decodeCursor(cursor)) {
      writeError(response, 400, 'bad_request', 'Invalid sessions cursor');
      return;
    }

    const adapter = new SessionQueryAdapter(queries.artifacts);
    const page = await adapter.fetchSessionsListAny(projectId, {
      ...(typeof limit === 'number' ? { limit } : {}),
      ...(cursor ? { cursor } : {}),
    });

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 200, {
      sessions: page.sessions,
      ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
    });
  };

  const handleAdminSessionArtifacts = async (
    request: IncomingMessage,
    response: ServerResponse,
    sessionId: string,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for admin session artifacts');
      return;
    }

    const principal = await requireAdminPrincipal(request, response);
    if (!principal) {
      return;
    }

    const queries = requireQueryRepositories(response);
    if (!queries) {
      return;
    }

    const projection = parseArtifactReadProjection(parseRequestUrl(request).searchParams);

    const adapter = new SessionQueryAdapter(queries.artifacts);
    const group = await adapter.fetchSessionArtifactsAny(sessionId, projection);
    if (!group) {
      writeError(response, 404, 'not_found', 'Session not found');
      return;
    }

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 200, { session: group });
  };

  const handleAdminSessionDownload = async (
    request: IncomingMessage,
    response: ServerResponse,
    sessionId: string,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for admin session download');
      return;
    }

    const format = parseDownloadFormat(parseRequestUrl(request).searchParams);
    if (!format) {
      writeError(response, 400, 'bad_request', 'format must be one of: md, txt, docx');
      return;
    }

    const searchParams = parseRequestUrl(request).searchParams;
    const excludeStepsParam = searchParams.get('excludeSteps');
    const excludeSteps = excludeStepsParam
      ? excludeStepsParam.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

    const principal = await requireAdminPrincipal(request, response);
    if (!principal) {
      return;
    }

    const queries = requireQueryRepositories(response);
    if (!queries) {
      return;
    }

    const adapter = new SessionQueryAdapter(queries.artifacts);
    const group = await adapter.fetchSessionArtifactsAny(sessionId, {
      includeContent: true,
    });
    if (!group) {
      writeError(response, 404, 'not_found', 'Session not found');
      return;
    }

    let orderedArtifacts = group.artifacts;
    if (group.toolKey && isSupportedToolWorkflow(group.toolKey)) {
      const plan = TOOL_WORKFLOW_REGISTRY[group.toolKey];
      const stepPosition = new Map<string, number>(
        plan.steps.map((step, index) => [step.key, index]),
      );
      orderedArtifacts = [...group.artifacts].sort((a, b) => {
        const aPos = a.stepKey ? stepPosition.get(a.stepKey) : undefined;
        const bPos = b.stepKey ? stepPosition.get(b.stepKey) : undefined;
        if (aPos === undefined && bPos === undefined) {
          return Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
        }
        if (aPos === undefined) return 1;
        if (bPos === undefined) return -1;
        return aPos - bPos;
      });
    } else {
      orderedArtifacts = [...group.artifacts].sort(
        (a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt),
      );
    }

    const fileBuffer = await serializeSessionDownload(sessionId, group.toolKey, orderedArtifacts, format, {
      ...(excludeSteps && excludeSteps.length > 0 ? { excludeSteps } : {}),
    });
    const filename = sessionDownloadFilename(sessionId, format);

    await repositories.sessions.touchSession(principal.session.id, now());

    response.statusCode = 200;
    response.setHeader('Content-Type', contentTypeForFormat(format));
    response.setHeader('Content-Disposition', contentDispositionAttachment(filename));
    response.setHeader('Content-Length', fileBuffer.length);
    response.end(fileBuffer);
  };

  return {
    handleAdminSessionsList,
    handleAdminSessionArtifacts,
    handleAdminSessionDownload,
  };
};
