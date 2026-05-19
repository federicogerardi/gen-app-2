import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

import type { AuthRepositoryBundle, UserQueryRepositoryBundle } from '../../adapters';
import type { AuthSessionPrincipal } from '../../types/auth';
import { BriefParseError, parseBriefInput } from '../brief-parser';
import { isSupportedToolWorkflow } from '../tool-workflow-registry';
import { normalizeToolWorkflowKey } from '../workflow-normalizers';
import type { AuthHttpWriteErrorFn, AuthHttpWriteSuccessFn } from './support';

const MAX_BRIEF_UPLOAD_BYTES = 2 * 1024 * 1024;

type CreateToolBriefRequestBody = {
  projectId?: unknown;
  toolKey?: unknown;
  fileName?: unknown;
  mimeType?: unknown;
  contentBase64?: unknown;
};

const normalizeMimeType = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

export type CreateToolsBriefHandlersDependencies = {
  repositories: Pick<AuthRepositoryBundle, 'sessions'>;
  now: () => Date;
  parseRequestUrl: (request: IncomingMessage) => URL;
  parseJsonBody: <T>(request: IncomingMessage) => Promise<T>;
  requireSessionPrincipal: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => Promise<AuthSessionPrincipal | null>;
  requireQueryRepositories: (response: ServerResponse) => UserQueryRepositoryBundle | null;
  writeError: AuthHttpWriteErrorFn;
  writeSuccess: AuthHttpWriteSuccessFn;
};

export type ToolsBriefHandlers = {
  handleToolsBriefUpload(request: IncomingMessage, response: ServerResponse): Promise<void>;
};

export const createToolsBriefHandlers = (
  deps: CreateToolsBriefHandlersDependencies,
): ToolsBriefHandlers => {
  const {
    repositories,
    now,
    parseRequestUrl,
    parseJsonBody,
    requireSessionPrincipal,
    requireQueryRepositories,
    writeError,
    writeSuccess,
  } = deps;

  const handleToolsBriefUpload = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for tools brief upload');
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

    let body: CreateToolBriefRequestBody;
    try {
      body = await parseJsonBody<CreateToolBriefRequestBody>(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const query = parseRequestUrl(request).searchParams;
    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
    const rawToolKeyFromBody = typeof body.toolKey === 'string' ? body.toolKey.trim() : '';
    const rawToolKeyFromQuery = query.get('toolKey')?.trim() ?? '';
    const toolKeyFromBody = normalizeToolWorkflowKey(rawToolKeyFromBody) ?? '';
    const toolKeyFromQuery = normalizeToolWorkflowKey(rawToolKeyFromQuery) ?? '';
    const toolKey = toolKeyFromBody || toolKeyFromQuery;
    const submittedToolKey = rawToolKeyFromBody || rawToolKeyFromQuery;
    const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : '';
    const mimeType = normalizeMimeType(body.mimeType);
    const contentBase64 = typeof body.contentBase64 === 'string' ? body.contentBase64.trim() : '';

    if (!projectId || !fileName || !contentBase64 || !toolKey) {
      writeError(response, 400, 'bad_request', 'projectId, toolKey, fileName and contentBase64 are required');
      return;
    }

    if (!isSupportedToolWorkflow(toolKey)) {
      writeError(response, 400, 'bad_request', `Unsupported toolKey: ${submittedToolKey} (normalized to: ${toolKey})`);
      return;
    }

    const project = await queries.projects.getProjectByIdForUser(principal.user.id, projectId);
    if (!project) {
      writeError(response, 403, 'forbidden', 'Project ownership check failed');
      return;
    }

    let fileBuffer: Buffer;
    try {
      fileBuffer = Buffer.from(contentBase64, 'base64');
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid base64 payload');
      return;
    }

    if (fileBuffer.length === 0) {
      writeError(response, 400, 'bad_request', 'Uploaded brief is empty');
      return;
    }

    if (fileBuffer.length > MAX_BRIEF_UPLOAD_BYTES) {
      writeError(response, 400, 'bad_request', 'Uploaded brief is too large');
      return;
    }

    let parsedBrief;
    try {
      parsedBrief = await parseBriefInput({
        fileName,
        mimeType,
        content: fileBuffer,
      });
    } catch (error) {
      if (error instanceof BriefParseError) {
        writeError(response, 400, 'bad_request', error.message);
        return;
      }

      writeError(response, 400, 'bad_request', 'Unable to parse brief content');
      return;
    }

    const briefingId = `brief_${randomUUID()}`;

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 201, {
      briefing: {
        briefingId,
        projectId,
        toolKey: toolKey || null,
        fileName,
        mimeType,
        size: fileBuffer.length,
        parsedFormat: parsedBrief.format,
        normalizedText: parsedBrief.normalizedText,
        charCount: parsedBrief.charCount,
        wordCount: parsedBrief.wordCount,
      },
    });
  };

  return {
    handleToolsBriefUpload,
  };
};