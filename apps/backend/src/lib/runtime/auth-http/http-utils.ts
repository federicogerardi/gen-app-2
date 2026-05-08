import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseRequestUrl, writeJson } from '../http-utils';

export const writeSuccess = (
  response: ServerResponse,
  statusCode: number,
  data: Record<string, unknown>,
): void => {
  writeJson(response, statusCode, { ok: true, data });
};

export const writeError = (
  response: ServerResponse,
  statusCode: number,
  code: string,
  message: string,
): void => {
  writeJson(response, statusCode, {
    ok: false,
    error: { code, message },
  });
};

export const readRequestBody = async (
  request: IncomingMessage,
  maxBodySizeBytes: number,
): Promise<string> => {
  const chunks: Buffer[] = [];
  let totalSize = 0;

  await new Promise<void>((resolve, reject) => {
    request.on('data', (chunk: Buffer | string) => {
      const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalSize += chunkBuffer.length;
      if (totalSize > maxBodySizeBytes) {
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(chunkBuffer);
    });
    request.on('end', () => resolve());
    request.on('error', reject);
  });

  return Buffer.concat(chunks).toString('utf8');
};

export const parseJsonBody = async <T>(
  request: IncomingMessage,
  maxBodySizeBytes: number,
): Promise<T> => {
  const rawBody = await readRequestBody(request, maxBodySizeBytes);
  if (rawBody.length === 0) {
    return {} as T;
  }
  return JSON.parse(rawBody) as T;
};

export { parseRequestUrl };
