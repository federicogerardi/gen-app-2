import { http, HttpResponse } from 'msw';

export type StreamScenario = 'success' | 'failure' | 'malformed-sequence' | 'timeout' | 'network-error';

export const createStreamHandler = (scenario: StreamScenario) => {
  return http.post('*/generation/stream', async ({ request }) => {
    const encoder = new TextEncoder();

    if (scenario === 'success') {
      return new HttpResponse(
        new ReadableStream({
          start(controller) {
            // event: start
            controller.enqueue(
              encoder.encode(
                'event: start\ndata: {"requestId":"req-1","artifactId":"art-1"}\n\n',
              ),
            );

            // events: chunk (multi-step generation)
            const chunks = [
              { text: 'Step 1: Introduction ', seq: 1 },
              { text: 'Step 2: Main content ', seq: 2 },
              { text: 'Step 3: Conclusion', seq: 3 },
            ];

            for (const chunk of chunks) {
              controller.enqueue(
                encoder.encode(
                  `event: chunk\ndata: {"artifactId":"art-1","chunk":"${chunk.text}","sequence":${chunk.seq}}\n\n`,
                ),
              );
            }

            // event: terminal (success)
            controller.enqueue(
              encoder.encode(
                'event: terminal\ndata: {"artifactId":"art-1","status":"completed","reason":null}\n\n',
              ),
            );

            controller.close();
          },
        }),
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
      );
    }

    if (scenario === 'failure') {
      return new HttpResponse(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'event: start\ndata: {"requestId":"req-1","artifactId":"art-1"}\n\n',
              ),
            );
            controller.enqueue(
              encoder.encode(
                'event: chunk\ndata: {"artifactId":"art-1","chunk":"Partial content","sequence":1}\n\n',
              ),
            );
            // Terminal con failure
            controller.enqueue(
              encoder.encode(
                'event: terminal\ndata: {"artifactId":"art-1","status":"failed","reason":"LLM rate limit exceeded"}\n\n',
              ),
            );
            controller.close();
          },
        }),
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
      );
    }

    if (scenario === 'malformed-sequence') {
      return new HttpResponse(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'event: start\ndata: {"requestId":"req-1","artifactId":"art-1"}\n\n',
              ),
            );
            // Sequence breaks: 1 -> 3 (missing 2)
            controller.enqueue(
              encoder.encode(
                'event: chunk\ndata: {"artifactId":"art-1","chunk":"A","sequence":1}\n\n',
              ),
            );
            controller.enqueue(
              encoder.encode(
                'event: chunk\ndata: {"artifactId":"art-1","chunk":"B","sequence":3}\n\n',
              ),
            );
            controller.close();
          },
        }),
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
      );
    }

    if (scenario === 'timeout') {
      return new HttpResponse(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'event: start\ndata: {"requestId":"req-1","artifactId":"art-1"}\n\n',
              ),
            );
            // Simula timeout non inviando terminal
            setTimeout(() => {
              controller.close();
            }, 100);
          },
        }),
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
      );
    }

    // network-error
    return HttpResponse.error();
  });
};

export const streamHandlers = {
  success: createStreamHandler('success'),
  failure: createStreamHandler('failure'),
  malformedSequence: createStreamHandler('malformed-sequence'),
  timeout: createStreamHandler('timeout'),
  networkError: createStreamHandler('network-error'),
};
