import { describe, expect, it } from 'vitest';
import {
  createSseFrameParser,
  parseBackendStreamEvent,
  SseProtocolError,
} from './sse-parser';

describe('sse parser', () => {
  it('parses start chunk and terminal frames', () => {
    const parser = createSseFrameParser();
    const chunk = [
      'event: start',
      'data: {"requestId":"req-1","artifactId":"art-1"}',
      '',
      'event: chunk',
      'data: {"artifactId":"art-1","chunk":"hello","sequence":1}',
      '',
      'event: terminal',
      'data: {"artifactId":"art-1","status":"completed","reason":null}',
      '',
      '',
    ].join('\n');

    const frames = parser.push(chunk);
    const events = frames.map(parseBackendStreamEvent);

    expect(events).toHaveLength(3);
    expect(events[0]?.event).toBe('start');
    expect(events[1]?.event).toBe('chunk');
    expect(events[2]?.event).toBe('terminal');
  });

  it('rejects unsupported event names', () => {
    const parser = createSseFrameParser();
    const frames = parser.push('event: ping\ndata: {"ok":true}\n\n');

    expect(() => parseBackendStreamEvent(frames[0]!)).toThrow(SseProtocolError);
  });
});
