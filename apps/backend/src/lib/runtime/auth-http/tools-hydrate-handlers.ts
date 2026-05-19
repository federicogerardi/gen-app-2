import type { IncomingMessage, ServerResponse } from 'node:http';

import type { AuthRepositoryBundle, UserQueryRepositoryBundle } from '../../adapters';
import type { AuthSessionPrincipal } from '../../types/auth';
import type { AuthHttpWriteErrorFn, AuthHttpWriteSuccessFn } from './support';
import {
  parseExtractionContent,
  parsedFormatFromInput,
} from './tools-hydration-parser';

type ToolHydrateRequestBody = {
  projectId?: unknown;
  sourceArtifactId?: unknown;
  resolvedBriefingId?: unknown;
  sourceExtractionArtifactId?: unknown;
  intent?: unknown;
};

export type CreateToolsHydrateHandlersDependencies = {
  repositories: Pick<AuthRepositoryBundle, 'sessions'>;
  now: () => Date;
  parseJsonBody: <T>(request: IncomingMessage) => Promise<T>;
  requireSessionPrincipal: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => Promise<AuthSessionPrincipal | null>;
  requireQueryRepositories: (response: ServerResponse) => UserQueryRepositoryBundle | null;
  writeError: AuthHttpWriteErrorFn;
  writeSuccess: AuthHttpWriteSuccessFn;
};

export type ToolsHydrateHandlers = {
  handleToolsHydrate(request: IncomingMessage, response: ServerResponse): Promise<void>;
};

export const createToolsHydrateHandlers = (
  deps: CreateToolsHydrateHandlersDependencies,
): ToolsHydrateHandlers => {
  const {
    repositories,
    now,
    parseJsonBody,
    requireSessionPrincipal,
    requireQueryRepositories,
    writeError,
    writeSuccess,
  } = deps;

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

  return {
    handleToolsHydrate,
  };
};