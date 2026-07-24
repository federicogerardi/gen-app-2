import { useCallback, useRef } from 'react';
import type { SubmitJobRequest } from '@gen-app-2/contracts';
import type { SupportedTool } from '../machines/tool-flow.machine';
import type { ToolPageEvent } from '../machines/tool-page.types';
import { buildBlogArticleGeneratorDirectInputExtractionInfo, buildGeometricDirectInputExtractionInfo, buildYoutubeDescriptionDirectInputExtractionInfo } from './tool-page-selectors';

type UseToolPageSubmitControllerArgs = {
  apiBaseUrl: string;
  toolKey: SupportedTool;
  projectId: string;
  model: string;
  intent: 'new' | 'resume' | 'regenerate';
  toolPageSend: (event: ToolPageEvent) => void;
  extractionPayloadRef: React.RefObject<Record<string, unknown> | null>;
  formState: Record<string, unknown>;
  hasAssetBasedExtractionContext?: boolean;
};

export const useToolPageSubmitController = ({
  apiBaseUrl,
  toolKey,
  projectId,
  model,
  intent,
  toolPageSend,
  extractionPayloadRef,
  formState,
  hasAssetBasedExtractionContext = false,
}: UseToolPageSubmitControllerArgs) => {
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const buildSubmitRequest = useCallback((): SubmitJobRequest | null => {
    // Read extraction payload at submit time (not mount time) via ref.
    // The ref is updated by useToolPage whenever briefing/workspace context changes.
    let payload = extractionPayloadRef.current;

    if (!payload) {
      const geometricInfo = buildGeometricDirectInputExtractionInfo(formState as Parameters<typeof buildGeometricDirectInputExtractionInfo>[0]);
      payload = geometricInfo?.extractionPayload ?? null;
    }
    if (!payload) {
      const youtubeInfo = buildYoutubeDescriptionDirectInputExtractionInfo(formState as Parameters<typeof buildYoutubeDescriptionDirectInputExtractionInfo>[0]);
      payload = youtubeInfo?.extractionPayload ?? null;
    }
    if (!payload) {
      const blogInfo = buildBlogArticleGeneratorDirectInputExtractionInfo(formState as Parameters<typeof buildBlogArticleGeneratorDirectInputExtractionInfo>[0]);
      payload = blogInfo?.extractionPayload ?? null;
    }

    if (!payload) {
      // Asset-based tools (e.g. funnel-pages) don't require briefing extraction.
      // The workspace assets provide the extraction context. Use a minimal payload.
      if (hasAssetBasedExtractionContext) {
        payload = { _assetBased: true, toolKey, projectId };
      }
    }

    if (!payload) {
      return null;
    }

    return {
      toolKey,
      projectId,
      extractionPayload: payload,
      model,
      intent,
      idempotencyKey: idempotencyKeyRef.current,
    };
  }, [toolKey, projectId, model, intent, extractionPayloadRef, formState]);

  const submitJob = useCallback(async () => {
    const request = buildSubmitRequest();
    if (!request) {
      toolPageSend({ type: 'JOB_FAILED', reason: 'Missing extraction context' });
      return;
    }

    try {
      const url = `${apiBaseUrl}/api/tools/jobs`;
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        toolPageSend({
          type: 'JOB_FAILED',
          reason: errorBody?.error?.message ?? `Submit failed (${response.status})`,
        });
        return;
      }

      const result = (await response.json()) as { data?: { jobId?: string } };
      const jobId = result.data?.jobId;
      if (!jobId) {
        toolPageSend({ type: 'JOB_FAILED', reason: 'No jobId in response' });
        return;
      }

      sessionStorage.setItem(`tool-job:${projectId}:${toolKey}`, jobId);
      toolPageSend({ type: 'SUBMIT_JOB', jobId });
    } catch (err) {
      toolPageSend({
        type: 'JOB_FAILED',
        reason: err instanceof Error ? err.message : 'Submit failed',
      });
    }
  }, [buildSubmitRequest, apiBaseUrl, toolPageSend, projectId, toolKey]);

  const handleCancelGeneration = useCallback(async () => {
    try {
      const storedJobId = sessionStorage.getItem(`tool-job:${projectId}:${toolKey}`);
      if (storedJobId) {
        await fetch(`${apiBaseUrl}/api/tools/jobs/${storedJobId}/cancel`, {
          method: 'POST',
          credentials: 'include',
        }).catch(() => {});
        sessionStorage.removeItem(`tool-job:${projectId}:${toolKey}`);
      }
    } finally {
      toolPageSend({ type: 'CANCEL_GENERATION' });
    }
  }, [apiBaseUrl, toolPageSend, projectId, toolKey]);

  return {
    submitJob,
    handleCancelGeneration,
  };
};
