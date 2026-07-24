import { useEffect, useRef } from 'react';

type UseToolWorkflowJobStreamArgs = {
  jobId: string | null;
  apiBaseUrl: string;
  onProgress: (step: string, status: 'running' | 'done' | 'error', artifactId?: string) => void;
  onCompleted: (sessionId: string, artifactIds: string[]) => void;
  onFailed: (reason: string) => void;
  onCancelled: () => void;
  enabled: boolean;
};

export const useToolWorkflowJobStream = ({
  jobId,
  apiBaseUrl,
  onProgress,
  onCompleted,
  onFailed,
  onCancelled,
  enabled,
}: UseToolWorkflowJobStreamArgs): void => {
  const callbacksRef = useRef({ onProgress, onCompleted, onFailed, onCancelled });
  callbacksRef.current = { onProgress, onCompleted, onFailed, onCancelled };

  useEffect(() => {
    if (!enabled || !jobId) return;

    const abortController = new AbortController();
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let cleaned = false;

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      abortController.abort();
      reader?.cancel().catch(() => {});
    };

    const pollThenStream = async () => {
      try {
        const statusResponse = await fetch(`${apiBaseUrl}/api/tools/jobs/${jobId}`, {
          credentials: 'include',
          signal: abortController.signal,
        });

        if (statusResponse.ok) {
          const statusData = (await statusResponse.json()) as {
            ok?: boolean;
            data?: { status?: string; result?: { sessionId?: string; artifactIds?: string[] } };
          };
          const status = statusData.data?.status;

          if (status === 'completed') {
            const result = statusData.data?.result;
            callbacksRef.current.onCompleted(
              result?.sessionId ?? jobId,
              result?.artifactIds ?? [],
            );
            return;
          }
          if (status === 'failed') {
            callbacksRef.current.onFailed('Job failed');
            return;
          }
          if (status === 'cancelled') {
            callbacksRef.current.onCancelled();
            return;
          }
        }

        const streamResponse = await fetch(`${apiBaseUrl}/api/tools/jobs/${jobId}/stream`, {
          credentials: 'include',
          signal: abortController.signal,
        });

        if (!streamResponse.ok) {
          callbacksRef.current.onFailed(`SSE connection failed: ${streamResponse.status}`);
          return;
        }

        reader = streamResponse.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';

          for (const frame of frames) {
            const eventType = frame.match(/^event: (.+)$/m)?.[1];
            const dataLine = frame.match(/^data: (.+)$/m)?.[1];
            if (!eventType || !dataLine) continue;

            try {
              const data = JSON.parse(dataLine) as Record<string, unknown>;

              if (eventType === 'progress') {
                callbacksRef.current.onProgress(
                  data.step as string,
                  data.status as 'running' | 'done' | 'error',
                  data.artifactId as string | undefined,
                );
              } else if (eventType === 'terminal') {
                const terminalStatus = data.status as string;
                if (terminalStatus === 'completed') {
                  const result = data.result as { sessionId?: string; artifactIds?: string[] } | undefined;
                  callbacksRef.current.onCompleted(
                    result?.sessionId ?? jobId,
                    result?.artifactIds ?? [],
                  );
                } else if (terminalStatus === 'cancelled') {
                  callbacksRef.current.onCancelled();
                } else {
                  callbacksRef.current.onFailed(
                    (data.reason as string) ?? 'Job failed',
                  );
                }
                cleanup();
                return;
              }
            } catch (parseErr) {
              // skip unparseable frames silently
              if (import.meta.env.DEV) {
                console.debug('[tool-workflow] SSE parse error', parseErr);
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (import.meta.env.DEV) {
          console.error('[tool-workflow] stream error', err);
        }
        callbacksRef.current.onFailed(String(err));
      }
    };

    pollThenStream();

    return cleanup;
  }, [jobId, apiBaseUrl, enabled]);
};
