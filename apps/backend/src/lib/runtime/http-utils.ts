import type { IncomingMessage, ServerResponse } from 'node:http';

export const normalizePath = (url: string | undefined): string => {
  if (!url || url.length === 0) {
    return '/';
  }

  return url.split('?')[0] || '/';
};

export const writeJson = (
  response: ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>,
): void => {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
};

export const getHeaderValue = (value: string | string[] | undefined): string | null => {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && value[0]) {
    return value[0];
  }

  return null;
};

export const parseRequestUrl = (request: IncomingMessage): URL => {
  return new URL(request.url ?? '/', 'http://localhost');
};
