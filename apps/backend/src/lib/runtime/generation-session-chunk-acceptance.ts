import type { BackendStreamEvent } from './stream-contract';

export type ChunkCandidate = {
  sequence: unknown;
  chunk: unknown;
  currentArtifactId: string | null;
  lastEmittedSequence: number;
};

export type AcceptedChunk = {
  sequence: number;
  chunk: string;
};

export const acceptChunkCandidate = (
  candidate: ChunkCandidate,
): AcceptedChunk | null => {
  if (!candidate.currentArtifactId) {
    return null;
  }

  if (typeof candidate.sequence !== 'number' || candidate.sequence <= candidate.lastEmittedSequence) {
    return null;
  }

  if (typeof candidate.chunk !== 'string' || candidate.chunk.length === 0) {
    return null;
  }

  return {
    sequence: candidate.sequence,
    chunk: candidate.chunk,
  };
};

export const hasChunkEvents = (events: BackendStreamEvent[]): boolean => {
  return events.some((event) => event.event === 'chunk');
};
