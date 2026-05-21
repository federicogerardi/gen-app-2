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
  briefing?: unknown;
  angleDetector?: unknown;
};

type BriefUploadEnvelope = {
  fileName: string;
  mimeType: string | null;
  contentBase64: string;
};

type ParsedUploadedBrief = {
  fileName: string;
  mimeType: string | null;
  fileBuffer: Buffer;
  parsedBrief: {
    format: 'txt' | 'md' | 'docx';
    normalizedText: string;
    charCount: number;
    wordCount: number;
  };
};

const normalizeMimeType = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

const parseEnvelope = (value: unknown): BriefUploadEnvelope | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as {
    fileName?: unknown;
    mimeType?: unknown;
    contentBase64?: unknown;
  };
  const fileName = typeof candidate.fileName === 'string' ? candidate.fileName.trim() : '';
  const contentBase64 = typeof candidate.contentBase64 === 'string' ? candidate.contentBase64.trim() : '';
  if (!fileName || !contentBase64) {
    return null;
  }

  return {
    fileName,
    mimeType: normalizeMimeType(candidate.mimeType),
    contentBase64,
  };
};

const parseLegacyEnvelope = (body: CreateToolBriefRequestBody): BriefUploadEnvelope | null => {
  const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : '';
  const contentBase64 = typeof body.contentBase64 === 'string' ? body.contentBase64.trim() : '';
  if (!fileName || !contentBase64) {
    return null;
  }

  return {
    fileName,
    mimeType: normalizeMimeType(body.mimeType),
    contentBase64,
  };
};

const parseUploadedBriefEnvelope = async (
  envelope: BriefUploadEnvelope,
): Promise<ParsedUploadedBrief> => {
  let fileBuffer: Buffer;
  try {
    fileBuffer = Buffer.from(envelope.contentBase64, 'base64');
  } catch {
    throw new BriefParseError('Invalid base64 payload');
  }

  if (fileBuffer.length === 0) {
    throw new BriefParseError('Uploaded brief is empty');
  }

  if (fileBuffer.length > MAX_BRIEF_UPLOAD_BYTES) {
    throw new BriefParseError('Uploaded brief is too large');
  }

  const parsedBrief = await parseBriefInput({
    fileName: envelope.fileName,
    mimeType: envelope.mimeType,
    content: fileBuffer,
  });

  return {
    fileName: envelope.fileName,
    mimeType: envelope.mimeType,
    fileBuffer,
    parsedBrief,
  };
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
    if (!projectId || !toolKey) {
      writeError(response, 400, 'bad_request', 'projectId and toolKey are required');
      return;
    }

    if (!isSupportedToolWorkflow(toolKey) && toolKey !== 'angle-generator') {
      writeError(response, 400, 'bad_request', `Unsupported toolKey: ${submittedToolKey} (normalized to: ${toolKey})`);
      return;
    }

    const project = await queries.projects.getProjectByIdForUser(principal.user.id, projectId);
    if (!project) {
      writeError(response, 403, 'forbidden', 'Project ownership check failed');
      return;
    }

    const isAngleGenerator = toolKey === 'angle-generator';
    const briefingEnvelope = isAngleGenerator ? parseEnvelope(body.briefing) : parseLegacyEnvelope(body);
    const angleDetectorEnvelope = isAngleGenerator ? parseEnvelope(body.angleDetector) : null;

    if (!briefingEnvelope) {
      writeError(
        response,
        400,
        'bad_request',
        isAngleGenerator
          ? 'For angle-generator, briefing.fileName and briefing.contentBase64 are required'
          : 'projectId, toolKey, fileName and contentBase64 are required',
      );
      return;
    }

    if (isAngleGenerator && !angleDetectorEnvelope) {
      writeError(response, 400, 'bad_request', 'For angle-generator, angleDetector.fileName and angleDetector.contentBase64 are required');
      return;
    }

    let parsedBriefing: ParsedUploadedBrief;
    let parsedAngleDetector: ParsedUploadedBrief | null = null;
    try {
      parsedBriefing = await parseUploadedBriefEnvelope(briefingEnvelope);
      if (isAngleGenerator && angleDetectorEnvelope) {
        parsedAngleDetector = await parseUploadedBriefEnvelope(angleDetectorEnvelope);
      }
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

    if (isAngleGenerator && parsedAngleDetector) {
      writeSuccess(response, 201, {
        briefing: {
          briefingId,
          projectId,
          toolKey,
          fileName: parsedBriefing.fileName,
          mimeType: parsedBriefing.mimeType,
          size: parsedBriefing.fileBuffer.length,
          parsedFormat: parsedBriefing.parsedBrief.format,
          normalizedText: parsedBriefing.parsedBrief.normalizedText,
          charCount: parsedBriefing.parsedBrief.charCount,
          wordCount: parsedBriefing.parsedBrief.wordCount,
        },
        angleDetector: {
          fileName: parsedAngleDetector.fileName,
          mimeType: parsedAngleDetector.mimeType,
          size: parsedAngleDetector.fileBuffer.length,
          parsedFormat: parsedAngleDetector.parsedBrief.format,
          normalizedText: parsedAngleDetector.parsedBrief.normalizedText,
          charCount: parsedAngleDetector.parsedBrief.charCount,
          wordCount: parsedAngleDetector.parsedBrief.wordCount,
        },
        knowledgeSourcesCount: 2,
      });
      return;
    }

    writeSuccess(response, 201, {
      briefing: {
        briefingId,
        projectId,
        toolKey: toolKey || null,
        fileName: parsedBriefing.fileName,
        mimeType: parsedBriefing.mimeType,
        size: parsedBriefing.fileBuffer.length,
        parsedFormat: parsedBriefing.parsedBrief.format,
        normalizedText: parsedBriefing.parsedBrief.normalizedText,
        charCount: parsedBriefing.parsedBrief.charCount,
        wordCount: parsedBriefing.parsedBrief.wordCount,
      },
    });
  };

  return {
    handleToolsBriefUpload,
  };
};