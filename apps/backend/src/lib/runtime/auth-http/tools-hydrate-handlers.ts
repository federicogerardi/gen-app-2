import type { IncomingMessage, ServerResponse } from 'node:http';

import type { AuthRepositoryBundle, UserQueryRepositoryBundle } from '../../adapters';
import { parseExtractionContent as parseCanonicalExtractionContent } from '../../machines/generation/extraction-parsers';
import type { AuthSessionPrincipal } from '../../types/auth';
import type { AuthHttpWriteErrorFn, AuthHttpWriteSuccessFn } from './support';
import {
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
  toolsHydrateArtifactScanLimit: number;
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
    toolsHydrateArtifactScanLimit,
    parseJsonBody,
    requireSessionPrincipal,
    requireQueryRepositories,
    writeError,
    writeSuccess,
  } = deps;

  const shouldEmitHydrateDiagnostics = (): boolean => {
    return process.env.HYDRATE_DEBUG_DIAGNOSTICS === '1' && process.env.NODE_ENV !== 'production';
  };

  const debugLog = (message: string, payload?: unknown): void => {
    if (shouldEmitHydrateDiagnostics()) {
      console.debug(message, payload ?? '');
    }
  };

  // Parser ownership rule: hydration extraction payload parsing must reuse
  // the canonical Generation parser to avoid semantic drift across runtime paths.
  const resolveExtractionToolKeyFromInput = (input: Record<string, unknown>): string | null => {
    const directToolKey = typeof input.toolKey === 'string' ? input.toolKey.trim() : '';
    if (directToolKey.length > 0) {
      return directToolKey;
    }

    const toolWorkflow = input.toolWorkflow;
    if (toolWorkflow && typeof toolWorkflow === 'object' && !Array.isArray(toolWorkflow)) {
      const nestedToolKey = (toolWorkflow as Record<string, unknown>).toolKey;
      if (typeof nestedToolKey === 'string' && nestedToolKey.trim().length > 0) {
        return nestedToolKey.trim();
      }
    }

    return null;
  };

  const compareHydrateExtractionCandidates = (
    sourceExtractionArtifactId: string | null,
    left: { artifactId: string; updatedAt: string },
    right: { artifactId: string; updatedAt: string },
  ): number => {
    const leftIsSource = sourceExtractionArtifactId != null && left.artifactId === sourceExtractionArtifactId ? 1 : 0;
    const rightIsSource = sourceExtractionArtifactId != null && right.artifactId === sourceExtractionArtifactId ? 1 : 0;
    if (leftIsSource !== rightIsSource) {
      return rightIsSource - leftIsSource;
    }

    const updatedAtDelta = Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    if (updatedAtDelta !== 0) {
      return updatedAtDelta;
    }

    return left.artifactId.localeCompare(right.artifactId);
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

          const extractionPayload = parseCanonicalExtractionContent(
            artifact.content,
            resolveExtractionToolKeyFromInput(artifact.input),
          );
          const normalizedText = typeof artifact.input.briefingText === 'string' && artifact.input.briefingText.trim().length > 0
            ? artifact.input.briefingText
            : (typeof artifact.input.normalizedText === 'string' ? artifact.input.normalizedText : '');
          const parsedFormat = parsedFormatFromInput(artifact.input);

          const hasPayload = Object.keys(extractionPayload).length > 0;
          const hasText = normalizedText.trim().length > 0;

          debugLog('[auth-http] hydrate direct extraction artifact resolved', {
            projectId,
            hasSourceArtifactId: sourceArtifactId != null,
            hasResolvedBriefingId: resolvedBriefingId != null,
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
      limit: toolsHydrateArtifactScanLimit,
    });

    if (candidates.length === 0) {
      writeError(response, 404, 'not_found', 'No extraction artifact found for this project');
      return;
    }

    const candidateById = new Map(
      candidates.map((candidate) => [candidate.artifactId, candidate] as const),
    );

    const eligibleCandidates =
      resolvedBriefingId != null
        ? (
          await queries.artifacts.getArtifactsByIdsForUser(
            principal.user.id,
            candidates.map((candidate) => candidate.artifactId),
            { includeInput: true },
          )
        )
          .filter((detail) => {
            const explicitBriefingId =
              typeof detail.input.briefingId === 'string'
                ? detail.input.briefingId.trim()
                : '';
            const candidateBriefingId =
              explicitBriefingId.length > 0 ? explicitBriefingId : detail.artifactId;
            return candidateBriefingId === resolvedBriefingId;
          })
          .map((detail) => candidateById.get(detail.artifactId))
          .filter((candidate): candidate is (typeof candidates)[number] => candidate != null)
        : candidates;

    if (resolvedBriefingId != null && eligibleCandidates.length === 0) {
      writeError(
        response,
        404,
        'no_extraction_for_briefing',
        'No extraction artifact found for resolved briefing',
      );
      return;
    }

    let best = eligibleCandidates[0]!;
    for (let index = 1; index < eligibleCandidates.length; index += 1) {
      const candidate = eligibleCandidates[index]!;
      if (compareHydrateExtractionCandidates(sourceExtractionArtifactId, candidate, best) < 0) {
        best = candidate;
      }
    }
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

    const extractionPayload = parseCanonicalExtractionContent(
      bestDetail.content,
      resolveExtractionToolKeyFromInput(bestDetail.input),
    );
    const normalizedText = typeof bestDetail.input.briefingText === 'string' && bestDetail.input.briefingText.trim().length > 0
      ? bestDetail.input.briefingText
      : (typeof bestDetail.input.normalizedText === 'string' ? bestDetail.input.normalizedText : '');
    const parsedFormat = parsedFormatFromInput(bestDetail.input);

    debugLog('[auth-http] hydrate ranked extraction artifact resolved', {
      rankedCandidateCount: eligibleCandidates.length,
      projectId,
      hasSourceArtifactId: sourceArtifactId != null,
      hasSourceExtractionArtifactId: sourceExtractionArtifactId != null,
      hasResolvedBriefingId: resolvedBriefingId != null,
      selectedArtifactId: bestDetail.artifactId,
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