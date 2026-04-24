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
    data: { artifactId: string | null; status: 'completed' | 'failed'; reason: string | null };
  };

export const serializeSseEvent = (event: BackendStreamEvent): string => {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
};
