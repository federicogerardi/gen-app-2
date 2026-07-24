import { useCallback, useRef } from 'react';
import type { SubmitJobRequest } from '@gen-app-2/contracts';
import type { SupportedTool } from '../machines/tool-flow.machine';
import type { ToolPageEvent } from '../machines/tool-page.types';
import { buildGeometricDirectInputExtractionInfo, buildYoutubeDescriptionDirectInputExtractionInfo } from './tool-page-selectors';

type UseToolPageSubmitControllerArgs = {
  apiBaseUrl: string;
  toolKey: SupportedTool;
  projectId: string;
  model: string;
  intent: 'new' | 'resume' | 'regenerate';
  toolPageSend: (event: ToolPageEvent) => void;
  extractionPayload: Record<string, unknown> | null;
  formState: Record<string, unknown>;
};

export const useToolPageSubmitController = ({
  apiBaseUrl,
  toolKey,
  projectId,
  model,
  intent,
  toolPageSend,
  extractionPayload,
  formState,
}: UseToolPageSubmitControllerArgs) => {
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const buildSubmitRequest = useCallback((): SubmitJobRequest | null => {
    let payload = extractionPayload;

    if (!payload) {
      const geometricInfo = buildGeometricDirectInputExtractionInfo(formState as Parameters<typeof buildGeometricDirectInputExtractionInfo>[0]);
      payload = geometricInfo?.extractionPayload ?? null;
    }
    if (!payload) {
      const youtubeInfo = buildYoutubeDescriptionDirectInputExtractionInfo(formState as Parameters<typeof buildYoutubeDescriptionDirectInputExtractionInfo>[0]);
      payload = youtubeInfo?.extractionPayload ?? null;
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
  }, [toolKey, projectId, model, intent, extractionPayload, formState]);

  const submitJob = useCallback(async () => {
    const request = buildSubmitRequest();
    if (!request) {
      console.warn('[tool-job] submitJob: buildSubmitRequest returned null — missing extractionPayload');
      toolPageSend({ type: 'JOB_FAILED', reason: 'Missing extraction context' });
      return;
    }

    console.info('[tool-job] submitJob: dispatching', { toolKey: request.toolKey, projectId: request.projectId });

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
