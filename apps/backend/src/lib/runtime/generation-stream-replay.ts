export type SseReplayProducer = (pushFrame: (frame: string) => void) => Promise<void>;

export const createSseReplayStream = (
  producer: SseReplayProducer,
): AsyncIterable<string> => {
  return (async function* () {
    const frameQueue: string[] = [];
    let finished = false;
    let failure: unknown = null;
    let notify: (() => void) | null = null;

    const wakeConsumer = () => {
      notify?.();
      notify = null;
    };

    const producerPromise = producer((frame) => {
      frameQueue.push(frame);
      wakeConsumer();
    })
      .catch((error: unknown) => {
        failure = error;
      })
      .finally(() => {
        finished = true;
        wakeConsumer();
      });

    while (!finished || frameQueue.length > 0) {
      if (frameQueue.length === 0) {
        await new Promise<void>((resolve) => {
          notify = resolve;
        });
        continue;
      }

      const nextFrame = frameQueue.shift();
      if (typeof nextFrame === 'string') {
        yield nextFrame;
      }
    }

    await producerPromise;
    if (failure) {
      throw failure;
    }
  })();
};
