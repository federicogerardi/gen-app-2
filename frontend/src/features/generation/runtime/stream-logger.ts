export type StreamLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type StreamLogEntry = {
  timestamp: number;
  level: StreamLogLevel;
  requestId: string | null;
  artifactId: string | null;
  event: string;
  sequence?: number;
  data?: Record<string, unknown>;
  duration?: number;
};

export class StreamLogger {
  private logs: StreamLogEntry[] = [];
  private startTimes = new Map<string, number>();

  log(
    level: StreamLogLevel,
    event: string,
    context: {
      requestId: string | null;
      artifactId: string | null;
      sequence?: number;
      data?: Record<string, unknown>;
      duration?: number;
    },
  ) {
    const entry: StreamLogEntry = {
      timestamp: Date.now(),
      level,
      requestId: context.requestId,
      artifactId: context.artifactId,
      event,
    };

    if (typeof context.sequence === 'number') {
      entry.sequence = context.sequence;
    }

    if (context.data !== undefined) {
      entry.data = context.data;
    }

    if (typeof context.duration === 'number') {
      entry.duration = context.duration;
    }

    this.logs.push(entry);
  }

  startTimer(key: string) {
    this.startTimes.set(key, Date.now());
  }

  endTimer(
    key: string,
    event: string,
    context: {
      requestId: string | null;
      artifactId: string | null;
      sequence?: number;
      data?: Record<string, unknown>;
    },
  ) {
    const start = this.startTimes.get(key);
    if (start) {
      this.log('debug', event, { ...context, duration: Date.now() - start });
      this.startTimes.delete(key);
    }
  }

  getLogs(): StreamLogEntry[] {
    return this.logs;
  }

  getLogsByLevel(level: StreamLogLevel): StreamLogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  getLogsByRequestId(requestId: string): StreamLogEntry[] {
    return this.logs.filter(log => log.requestId === requestId);
  }

  clear() {
    this.logs = [];
    this.startTimes.clear();
  }

  // For debugging in console
  dump() {
    console.table(this.logs);
  }
}

export const createStreamLogger = () => new StreamLogger();
