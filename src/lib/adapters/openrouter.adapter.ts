import type {
  LlmStreamAdapter,
  LlmStreamEvent,
  LlmStreamInput,
  LlmUsageMetrics,
} from './generation.adapters';

type OpenRouterAdapterOptions = {
  apiKey: string;
  baseUrl?: string;
  appName?: string;
  httpReferer?: string;
};

type OpenRouterDelta = {
  choices?: Array<{
    delta?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_cost?: number;
  };
};

const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

const toContentChunk = (
  content: string | Array<{ type?: string; text?: string }> | undefined,
): string => {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('');
  }

  return '';
};

const toUsageMetrics = (usage: OpenRouterDelta['usage'] | undefined): LlmUsageMetrics | undefined => {
  if (!usage) {
    return undefined;
  }

  return {
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
    costUsd: Number((usage.total_cost ?? 0).toFixed(6)),
  };
};

const buildMessages = (requestInput: Record<string, unknown>) => {
  const messages = requestInput.messages;
  if (Array.isArray(messages) && messages.length > 0) {
    return messages;
  }

  const prompt = requestInput.prompt;
  if (typeof prompt === 'string' && prompt.trim().length > 0) {
    return [{ role: 'user', content: prompt.trim() }];
  }

  return [{ role: 'user', content: 'Generate a response for the current request.' }];
};

async function* parseSseResponse(response: Response): AsyncIterable<LlmStreamEvent> {
  if (!response.body) {
    throw new Error('openrouter_stream_missing_body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lastUsage: LlmUsageMetrics | undefined;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      const dataLines = frame
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .filter((line) => line.length > 0);

      for (const data of dataLines) {
        if (data === '[DONE]') {
          yield lastUsage
            ? { type: 'completed', usage: lastUsage }
            : { type: 'completed' };
          return;
        }

        const parsed = JSON.parse(data) as OpenRouterDelta;
        const chunk = toContentChunk(parsed.choices?.[0]?.delta?.content);
        if (chunk.length > 0) {
          yield { type: 'chunk', chunk };
        }

        const usage = toUsageMetrics(parsed.usage);
        if (usage) {
          lastUsage = usage;
          yield {
            type: 'heartbeat',
            estimatedInputTokens: usage.inputTokens,
            estimatedOutputTokens: usage.outputTokens,
            costEstimate: usage.costUsd,
          };
        }
      }
    }

    if (done) {
      yield lastUsage
        ? { type: 'completed', usage: lastUsage }
        : { type: 'completed' };
      return;
    }
  }
}

export const createOpenRouterLlmStreamAdapter = (
  options: OpenRouterAdapterOptions,
): LlmStreamAdapter => ({
  async *streamText(input: LlmStreamInput) {
    const requestInit: RequestInit = {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
        ...(options.httpReferer ? { 'HTTP-Referer': options.httpReferer } : {}),
        ...(options.appName ? { 'X-Title': options.appName } : {}),
      },
      body: JSON.stringify({
        model: input.model,
        stream: true,
        messages: buildMessages(input.requestInput),
      }),
      ...(input.signal ? { signal: input.signal } : {}),
    };

    const response = await fetch(`${options.baseUrl ?? DEFAULT_OPENROUTER_BASE_URL}/chat/completions`, {
      ...requestInit,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`openrouter_stream_failed:${response.status}:${body}`);
    }

    for await (const event of parseSseResponse(response)) {
      yield event;
    }
  },
});

export const createOpenRouterLlmStreamAdapterFromEnv = (): LlmStreamAdapter | null => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return null;
  }

  return createOpenRouterLlmStreamAdapter({
    apiKey,
    ...(process.env.OPENROUTER_BASE_URL
      ? { baseUrl: process.env.OPENROUTER_BASE_URL }
      : {}),
    ...(process.env.OPENROUTER_APP_NAME
      ? { appName: process.env.OPENROUTER_APP_NAME }
      : {}),
    ...(process.env.OPENROUTER_HTTP_REFERER
      ? { httpReferer: process.env.OPENROUTER_HTTP_REFERER }
      : {}),
  });
};