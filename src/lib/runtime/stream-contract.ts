/**
 * Authoritative backend definition of BackendStreamEvent.
 * This is the canonical source of truth for the SSE wire contract.
 * The frontend boundary file (frontend/src/features/generation/contracts/backend-stream.ts)
 * must remain structurally identical; validate with the type-parity guard.
 * DDD canonical term: BackendStreamEvent (DDD-009).
 */
export type BackendStreamEvent =
  | {
    event: 'start';
    data: { requestId: string; artifactId: string };
  }
  | {
    event: 'chunk';
    data: { artifactId: string; chunk: string; sequence: number };
  }
  | {
    event: 'terminal';
    data: {
      artifactId: string | null;
      status: 'completed' | 'failed';
      reason: string | null;
      completedStep?: string | null;
      failedStep?: string | null;
    };
  };

export const serializeSseEvent = (event: BackendStreamEvent): string => {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
};
