import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

import type {
  AuthRepositoryBundle,
  IdempotencyAdapter,
  UserQueryRepositoryBundle,
} from '../../adapters';
import { SessionQueryAdapter, type SessionListEntry } from '../../adapters/session-query.adapter';
import type { AuthSessionPrincipal } from '../../types/auth';
import { BriefParseError, parseBriefInput } from '../brief-parser';
import { contentTypeForFormat, parseDownloadFormat } from '../downloads/download-format';
import { contentDispositionAttachment, sessionDownloadFilename } from '../downloads/download-filename';
import { serializeSessionDownload } from '../downloads/download-serializers';
import {
  GenerationRoutePipelineError,
  createGenerationRouteDeadline,
  runGenerationRoutePipeline,
} from '../generation-route-pipeline';
import { buildToolsOrchestrateIdempotencyInput } from '../request-contract';
import {
  TOOL_WORKFLOW_REGISTRY,
  buildCompletedArtifactsByStep,
  isSupportedToolWorkflow,
  resolveStepDependencyIds,
} from '../tool-workflow-registry';
import { parseArtifactReadProjection } from './projects-handlers';

const MAX_BRIEF_UPLOAD_BYTES = 2 * 1024 * 1024;

type CreateToolBriefRequestBody = {
  projectId?: unknown;
  toolKey?: unknown;
  fileName?: unknown;
  mimeType?: unknown;
  contentBase64?: unknown;
};

type ToolHydrateRequestBody = {
  projectId?: unknown;
  sourceArtifactId?: unknown;
  resolvedBriefingId?: unknown;
  sourceExtractionArtifactId?: unknown;
  intent?: unknown;
};

type ToolOrchestrationRequestBody = {
  projectId?: unknown;
  toolKey?: unknown;
  targetStep?: unknown;
  requestId?: unknown;
  idempotencyKey?: unknown;
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

const normalizeMimeType = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

const normalizeSupportedToolKey = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === 'funnel_pages' || normalized === 'hl_funnel' || normalized === 'funnelpages') {
    return 'funnel-pages';
  }

  if (normalized === 'youtube_lf_script') {
    return 'youtube-lf-script';
  }

  return normalized.replaceAll('_', '-');
};

export type CreateToolsHandlersDependencies = {
  repositories: AuthRepositoryBundle;
  idempotency: IdempotencyAdapter | null;
  now: () => Date;
  parseRequestUrl: (request: IncomingMessage) => URL;
  parseJsonBody: <T>(request: IncomingMessage) => Promise<T>;
  requireSessionPrincipal: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => Promise<AuthSessionPrincipal | null>;
  requireQueryRepositories: (response: ServerResponse) => UserQueryRepositoryBundle | null;
  writeError: WriteError;
  writeSuccess: WriteSuccess;
};

export type ToolsHandlers = {
  handleToolsBriefUpload(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleToolsHydrate(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleToolsOrchestrate(request: IncomingMessage, response: ServerResponse): Promise<void>;
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

export const createToolsHandlers = (deps: CreateToolsHandlersDependencies): ToolsHandlers => {
  const {
    repositories,
    idempotency,
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
    const toolKeyFromBody = normalizeSupportedToolKey(rawToolKeyFromBody) ?? '';
    const toolKeyFromQuery = normalizeSupportedToolKey(rawToolKeyFromQuery) ?? '';
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

  const handleToolsHydrate = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for tools hydrate');
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

    let body: ToolHydrateRequestBody;
    try {
      body = await parseJsonBody<ToolHydrateRequestBody>(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
    if (!projectId) {
      writeError(response, 400, 'bad_request', 'projectId is required');
      return;
    }

    const project = await queries.projects.getProjectByIdForUser(principal.user.id, projectId);
    if (!project) {
      writeError(response, 403, 'forbidden', 'Project ownership check failed');
      return;
    }

    const sourceArtifactId = typeof body.sourceArtifactId === 'string' ? body.sourceArtifactId.trim() || null : null;
    let resolvedBriefingId = typeof body.resolvedBriefingId === 'string' ? body.resolvedBriefingId.trim() || null : null;
    let sourceExtractionArtifactId = typeof body.sourceExtractionArtifactId === 'string' ? body.sourceExtractionArtifactId.trim() || null : null;

    const isRecord = (value: unknown): value is Record<string, unknown> =>
      typeof value === 'object' && value !== null && !Array.isArray(value);

    const normalizeExtractionPayload = (value: unknown): Record<string, unknown> => {
      if (!isRecord(value)) {
        return {};
      }

      const payload = value.payload;
      if (isRecord(payload)) {
        return payload;
      }

      const extractionPayload = value.extractionPayload;
      if (isRecord(extractionPayload)) {
        return extractionPayload;
      }

      const data = value.data;
      if (isRecord(data)) {
        const dataPayload = data.payload;
        if (isRecord(dataPayload)) {
          return dataPayload;
        }

        const dataExtractionPayload = data.extractionPayload;
        if (isRecord(dataExtractionPayload)) {
          return dataExtractionPayload;
        }
      }

      return value;
    };

    const parseJsonCandidate = (candidate: string): Record<string, unknown> => {
      try {
        const parsed = JSON.parse(candidate) as unknown;
        return normalizeExtractionPayload(parsed);
      } catch {
        return {};
      }
    };

    const parseExtractionContent = (content: string): Record<string, unknown> => {
      const direct = parseJsonCandidate(content);
      if (Object.keys(direct).length > 0) {
        return direct;
      }

      const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fenced?.[1]) {
        const fromFence = parseJsonCandidate(fenced[1]);
        if (Object.keys(fromFence).length > 0) {
          return fromFence;
        }
      }

      const objectSlice = content.match(/\{[\s\S]*\}/);
      if (objectSlice?.[0]) {
        const fromSlice = parseJsonCandidate(objectSlice[0]);
        if (Object.keys(fromSlice).length > 0) {
          return fromSlice;
        }
      }

      return {};
    };

    const parsedFormatFromInput = (input: Record<string, unknown>): 'txt' | 'md' | 'docx' => {
      const raw = typeof input.parsedFormat === 'string' ? input.parsedFormat.trim().toLowerCase() : '';
      if (raw === 'txt' || raw === 'md' || raw === 'docx') {
        return raw;
      }
      return 'md';
    };

    if (sourceArtifactId) {
      const artifact = await queries.artifacts.getArtifactByIdForUser(
        principal.user.id,
        sourceArtifactId,
        { includeInput: true, includeContent: true },
      );
      if (artifact) {
        if (artifact.artifactType === 'extraction') {
          const briefingId = (typeof artifact.input.briefingId === 'string' && artifact.input.briefingId.trim())
            ? artifact.input.briefingId.trim()
            : artifact.artifactId;

          const extractionPayload = parseExtractionContent(artifact.content);
          const normalizedText = typeof artifact.input.briefingText === 'string' && artifact.input.briefingText.trim().length > 0
            ? artifact.input.briefingText
            : (typeof artifact.input.normalizedText === 'string' ? artifact.input.normalizedText : '');
          const parsedFormat = parsedFormatFromInput(artifact.input);

          const hasPayload = Object.keys(extractionPayload).length > 0;
          const hasText = normalizedText.trim().length > 0;

          console.debug('[auth-http] hydrate direct extraction artifact resolved', {
            sourceArtifactId,
            artifactId: artifact.artifactId,
            projectId,
            briefingId,
            normalizedTextLength: normalizedText.trim().length,
            extractionPayloadKeys: Object.keys(extractionPayload).length,
            parsedFormat,
            willFallThrough: !hasPayload && !hasText,
          });

          if (hasPayload || hasText) {
            await repositories.sessions.touchSession(principal.session.id, now());
            writeSuccess(response, 200, {
              hydration: {
                extractionArtifactId: artifact.artifactId,
                extractionPayload,
                briefingId,
                normalizedText,
                parsedFormat,
              },
            });
            return;
          }

          resolvedBriefingId = resolvedBriefingId ?? briefingId;
        } else {
          const artifactBriefingId = typeof artifact.input.briefingId === 'string' ? artifact.input.briefingId.trim() || null : null;
          const artifactExtractionArtifactId = typeof artifact.input.extractionArtifactId === 'string' ? artifact.input.extractionArtifactId.trim() || null : null;
          resolvedBriefingId = resolvedBriefingId ?? artifactBriefingId;
          sourceExtractionArtifactId = sourceExtractionArtifactId ?? artifactExtractionArtifactId;

          if (!resolvedBriefingId && !sourceExtractionArtifactId) {
            writeError(response, 400, 'bad_request', 'missing_extraction_reference');
            return;
          }
        }
      }
    }

    const candidates = await queries.artifacts.listArtifactsByUser(principal.user.id, {
      type: 'extraction',
      status: 'completed',
      projectId,
    });

    if (candidates.length === 0) {
      writeError(response, 404, 'not_found', 'No extraction artifact found for this project');
      return;
    }

    const ranked = [...candidates].sort((a, b) => {
      const aIsSource = sourceExtractionArtifactId != null && a.artifactId === sourceExtractionArtifactId ? 1 : 0;
      const bIsSource = sourceExtractionArtifactId != null && b.artifactId === sourceExtractionArtifactId ? 1 : 0;
      if (aIsSource !== bIsSource) {
        return bIsSource - aIsSource;
      }
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    });

    const best = ranked[0]!;
    const bestDetail = await queries.artifacts.getArtifactByIdForUser(
      principal.user.id,
      best.artifactId,
      { includeInput: true, includeContent: true },
    );
    if (!bestDetail) {
      writeError(response, 404, 'not_found', 'Extraction artifact detail not found');
      return;
    }

    const briefingId = (typeof bestDetail.input.briefingId === 'string' && bestDetail.input.briefingId.trim())
      ? bestDetail.input.briefingId.trim()
      : bestDetail.artifactId;

    const extractionPayload = parseExtractionContent(bestDetail.content);
    const normalizedText = typeof bestDetail.input.briefingText === 'string' && bestDetail.input.briefingText.trim().length > 0
      ? bestDetail.input.briefingText
      : (typeof bestDetail.input.normalizedText === 'string' ? bestDetail.input.normalizedText : '');
    const parsedFormat = parsedFormatFromInput(bestDetail.input);

    console.debug('[auth-http] hydrate ranked extraction artifact resolved', {
      sourceArtifactId,
      sourceExtractionArtifactId,
      resolvedBriefingId,
      rankedCandidateCount: ranked.length,
      selectedArtifactId: bestDetail.artifactId,
      projectId,
      briefingId,
      normalizedTextLength: normalizedText.trim().length,
      extractionPayloadKeys: Object.keys(extractionPayload).length,
      parsedFormat,
    });

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 200, {
      hydration: {
        extractionArtifactId: bestDetail.artifactId,
        extractionPayload,
        briefingId,
        normalizedText,
        parsedFormat,
      },
    });
  };

  const handleToolsOrchestrate = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for tools orchestrate');
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

    let body: ToolOrchestrationRequestBody;
    try {
      body = await parseJsonBody<ToolOrchestrationRequestBody>(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
    if (!projectId) {
      writeError(response, 400, 'bad_request', 'projectId is required');
      return;
    }

    const project = await queries.projects.getProjectByIdForUser(principal.user.id, projectId);
    if (!project) {
      writeError(response, 403, 'forbidden', 'Project ownership check failed');
      return;
    }

    const toolKey = typeof body.toolKey === 'string' ? body.toolKey.trim() : '';
    if (!toolKey) {
      writeError(response, 400, 'bad_request', 'toolKey is required');
      return;
    }

    if (!isSupportedToolWorkflow(toolKey)) {
      writeError(response, 400, 'bad_request', `Unsupported toolKey: ${toolKey}`);
      return;
    }

    const targetStep = typeof body.targetStep === 'string' ? body.targetStep.trim() : '';
    if (!targetStep) {
      writeError(response, 400, 'bad_request', 'targetStep is required');
      return;
    }

    const correlationId = `orchestrate:${randomUUID()}`;
    const route = '/api/tools/orchestrate';
    const deadline = createGenerationRouteDeadline(3000);
    const idempotencyInput = buildToolsOrchestrateIdempotencyInput({
      requestId: body.requestId,
      userId: principal.user.id,
      projectId,
      toolKey,
      idempotencyKey: body.idempotencyKey,
    });

    let stepDependencyArtifactIds: string[] = [];
    let dependencyArtifactIdsByStep: Record<string, string> = {};
    let idempotencyClaimed = false;

    if (idempotencyInput) {
      if (!idempotency) {
        writeError(response, 503, 'service_unavailable', 'Idempotency adapter unavailable');
        return;
      }

      try {
        const decision = await idempotency.checkAndClaim(idempotencyInput);
        if (decision.status === 'conflict') {
          writeError(response, 409, 'conflict', 'Duplicate orchestrate request in progress');
          return;
        }

        if (decision.status === 'replay') {
          let replayPayload: {
            toolKey: string;
            targetStep: string;
            stepDependencyArtifactIds: string[];
            dependencyArtifactIdsByStep: Record<string, string>;
          };

          try {
            replayPayload = JSON.parse(decision.content) as {
              toolKey: string;
              targetStep: string;
              stepDependencyArtifactIds: string[];
              dependencyArtifactIdsByStep: Record<string, string>;
            };
          } catch {
            writeError(response, 500, 'internal', 'Invalid replay payload for orchestrate idempotency');
            return;
          }

          if (replayPayload.toolKey !== toolKey || replayPayload.targetStep !== targetStep) {
            writeError(response, 409, 'conflict', 'Idempotency key reused with different orchestrate input');
            return;
          }

          await repositories.sessions.touchSession(principal.session.id, now());
          writeSuccess(response, 200, {
            orchestration: {
              toolKey,
              targetStep,
              stepDependencyArtifactIds: replayPayload.stepDependencyArtifactIds,
              dependencyArtifactIdsByStep: replayPayload.dependencyArtifactIdsByStep,
            },
          });
          return;
        }

        idempotencyClaimed = true;
      } catch {
        writeError(response, 500, 'internal', 'Failed idempotency claim for orchestrate request');
        return;
      }
    }

    try {
      ({ stepDependencyArtifactIds, dependencyArtifactIdsByStep } = await runGenerationRoutePipeline(
        route,
        correlationId,
        async () => {
          const allCompleted = await queries.artifacts.listArtifactsByUser(principal.user.id, {
            projectId,
            status: 'completed',
          });

          const completedArtifactsByStep = await buildCompletedArtifactsByStep(
            principal.user.id,
            toolKey,
            allCompleted,
            async (userId, artifactId) => {
              return queries.artifacts.getArtifactByIdForUser(userId, artifactId, { includeInput: true });
            },
            route,
            correlationId,
            deadline,
          );

          return resolveStepDependencyIds(
            toolKey,
            targetStep,
            completedArtifactsByStep,
          );
        },
      ));
    } catch (error) {
      if (idempotencyInput && idempotency && idempotencyClaimed) {
        await idempotency.markFailed(idempotencyInput);
      }

      if (error instanceof GenerationRoutePipelineError && error.code === 'deadline_exceeded') {
        writeError(response, 503, 'service_unavailable', 'Tools orchestration timeout');
        return;
      }

      writeError(response, 500, 'internal', 'Failed to orchestrate tool dependencies');
      return;
    }

    if (idempotencyInput && idempotency && idempotencyClaimed) {
      await idempotency.markCompleted(
        idempotencyInput,
        `orchestrate:${toolKey}:${targetStep}`,
        JSON.stringify({
          toolKey,
          targetStep,
          stepDependencyArtifactIds,
          dependencyArtifactIdsByStep,
        }),
      );
    }

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 200, {
      orchestration: {
        toolKey,
        targetStep,
        stepDependencyArtifactIds,
        dependencyArtifactIdsByStep,
      },
    });
  };

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

    const projectIdParam = parseRequestUrl(request).searchParams.get('projectId');
    const projectId = projectIdParam && projectIdParam.trim().length > 0 ? projectIdParam.trim() : null;

    const adapter = new SessionQueryAdapter(queries.artifacts);
    const sessions: SessionListEntry[] = await adapter.fetchSessionsList(principal.user.id, projectId);

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 200, { sessions });
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
    handleToolsBriefUpload,
    handleToolsHydrate,
    handleToolsOrchestrate,
    handleToolsSessionsList,
    handleToolsSessionArtifacts,
    handleToolsSessionStepArtifact,
    handleToolsSessionDownload,
  };
};
