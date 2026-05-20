import type { IncomingMessage, ServerResponse } from 'node:http';

import type { AuthRepositoryBundle, UserQueryRepositoryBundle } from '../../adapters';
import { SessionQueryAdapter, type SessionListEntry } from '../../adapters/session-query.adapter';
import type { AuthSessionPrincipal } from '../../types/auth';
import { contentTypeForFormat, parseDownloadFormat } from '../downloads/download-format';
import { contentDispositionAttachment, sessionDownloadFilename } from '../downloads/download-filename';
import { serializeSessionDownload } from '../downloads/download-serializers';
import { TOOL_WORKFLOW_REGISTRY, isSupportedToolWorkflow } from '../tool-workflow-registry';
import { parseArtifactReadProjection } from './projects-handlers';
import type { AuthHttpWriteErrorFn, AuthHttpWriteSuccessFn } from './support';

export type CreateToolsSessionHandlersDependencies = {
  repositories: Pick<AuthRepositoryBundle, 'sessions'>;
  now: () => Date;
  parseRequestUrl: (request: IncomingMessage) => URL;
  requireSessionPrincipal: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => Promise<AuthSessionPrincipal | null>;
  requireQueryRepositories: (response: ServerResponse) => UserQueryRepositoryBundle | null;
  writeError: AuthHttpWriteErrorFn;
  writeSuccess: AuthHttpWriteSuccessFn;
};

export type ToolsSessionHandlers = {
  handleToolsSessionsList(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleToolsSessionArtifacts(request: IncomingMessage, response: ServerResponse, sessionId: string): Promise<void>;
  handleToolsSessionStepArtifact(
    request: IncomingMessage,
    response: ServerResponse,
    sessionId: string,
    stepKey: string,
  ): Promise<void>;
  handleToolsSessionDownload(
    request: IncomingMessage,
    response: ServerResponse,
    sessionId: string,
  ): Promise<void>;
};

export const createToolsSessionHandlers = (
  deps: CreateToolsSessionHandlersDependencies,
): ToolsSessionHandlers => {
  const {
    repositories,
    now,
    parseRequestUrl,
    requireSessionPrincipal,
    requireQueryRepositories,
    writeError,
    writeSuccess,
  } = deps;

  const handleToolsSessionsList = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for sessions list');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
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
    const page = await adapter.fetchSessionsList(principal.user.id, projectId, {
      ...(typeof limit === 'number' ? { limit } : {}),
      ...(cursor ? { cursor } : {}),
    });
    const sessions: SessionListEntry[] = page.sessions;

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 200, {
      sessions,
      ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
    });
  };

  const handleToolsSessionArtifacts = async (
    request: IncomingMessage,
    response: ServerResponse,
    sessionId: string,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for session artifacts');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) {
      return;
    }

    const queries = requireQueryRepositories(response);
    if (!queries) {
      return;
    }

    const projection = parseArtifactReadProjection(parseRequestUrl(request).searchParams);

    const adapter = new SessionQueryAdapter(queries.artifacts);
    const group = await adapter.fetchSessionArtifacts(sessionId, principal.user.id, projection);
    if (!group) {
      writeError(response, 404, 'not_found', 'Session not found');
      return;
    }

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 200, { session: group });
  };

  const handleToolsSessionStepArtifact = async (
    request: IncomingMessage,
    response: ServerResponse,
    sessionId: string,
    stepKey: string,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for session step artifact');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) {
      return;
    }

    const queries = requireQueryRepositories(response);
    if (!queries) {
      return;
    }

    const projection = parseArtifactReadProjection(parseRequestUrl(request).searchParams);

    const adapter = new SessionQueryAdapter(queries.artifacts);
    const artifact = await adapter.fetchStepArtifact(sessionId, stepKey, principal.user.id, projection);
    if (!artifact) {
      writeError(response, 404, 'not_found', 'Session step artifact not found');
      return;
    }

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 200, { artifact });
  };

  const handleToolsSessionDownload = async (
    request: IncomingMessage,
    response: ServerResponse,
    sessionId: string,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for session download');
      return;
    }

    const format = parseDownloadFormat(parseRequestUrl(request).searchParams);
    if (!format) {
      writeError(response, 400, 'bad_request', 'format must be one of: md, txt, docx');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) {
      return;
    }

    const queries = requireQueryRepositories(response);
    if (!queries) {
      return;
    }

    const adapter = new SessionQueryAdapter(queries.artifacts);
    const group = await adapter.fetchSessionArtifacts(sessionId, principal.user.id, {
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

    const fileBuffer = await serializeSessionDownload(sessionId, group.toolKey, orderedArtifacts, format);
    const filename = sessionDownloadFilename(sessionId, format);

    await repositories.sessions.touchSession(principal.session.id, now());

    response.statusCode = 200;
    response.setHeader('Content-Type', contentTypeForFormat(format));
    response.setHeader('Content-Disposition', contentDispositionAttachment(filename));
    response.setHeader('Content-Length', fileBuffer.length);
    response.end(fileBuffer);
  };

  return {
    handleToolsSessionsList,
    handleToolsSessionArtifacts,
    handleToolsSessionStepArtifact,
    handleToolsSessionDownload,
  };
};