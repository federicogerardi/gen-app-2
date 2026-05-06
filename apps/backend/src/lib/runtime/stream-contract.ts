export type { BackendStreamEvent } from '@gen-app-2/contracts';
import type { BackendStreamEvent } from '@gen-app-2/contracts';

/**
 * Authoritative backend definition of BackendStreamEvent.
 * This is the canonical source of truth for the SSE wire contract.
 * The frontend boundary file (frontend/src/features/generation/contracts/backend-stream.ts)
 * must remain structurally identical; validate with the type-parity guard.
 * DDD canonical term: BackendStreamEvent (DDD-009).
 */
export const serializeSseEvent = (event: BackendStreamEvent): string => {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
};
