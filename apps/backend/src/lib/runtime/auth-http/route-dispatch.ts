import type { IncomingMessage, ServerResponse } from 'node:http';

import { normalizePath } from '../http-utils';
import type { AuthHttpWriteErrorFn } from './support';
import type { RouteEntry, HandleAuthHttpRequestResult } from './route-table';

const toAllowedMethods = (method: RouteEntry['method']): string[] => {
  return Array.isArray(method) ? method : [method];
};

export const dispatchRequest = async (
  routeTable: RouteEntry[],
  request: IncomingMessage,
  response: ServerResponse,
  writeError?: AuthHttpWriteErrorFn,
): Promise<HandleAuthHttpRequestResult> => {
  const path = normalizePath(request.url);
  const requestMethod = request.method ?? '';
  const allowedMethods = new Set<string>();

  for (const entry of routeTable) {
    if (typeof entry.pattern === 'string') {
      if (entry.pattern !== path) {
        continue;
      }

      const entryAllowedMethods = toAllowedMethods(entry.method);
      if (!entryAllowedMethods.includes(requestMethod)) {
        entryAllowedMethods.forEach((method) => allowedMethods.add(method));
        continue;
      }

      await entry.handler(request, response);
      return { handled: true };
    }

    const match = path.match(entry.pattern);
    if (!match) {
      continue;
    }

    const entryAllowedMethods = toAllowedMethods(entry.method);
    if (!entryAllowedMethods.includes(requestMethod)) {
      entryAllowedMethods.forEach((method) => allowedMethods.add(method));
      continue;
    }

    await entry.handler(request, response, ...match.slice(1));
    return { handled: true };
  }

  if (allowedMethods.size > 0 && writeError) {
    const allowHeader = [...allowedMethods].sort().join(', ');
    response.setHeader('Allow', allowHeader);
    writeError(response, 405, 'method_not_allowed', `Method ${requestMethod || 'UNKNOWN'} not allowed for ${path}`);
    return { handled: true };
  }

  return { handled: false };
};
