import type { IncomingMessage, ServerResponse } from 'node:http';

import { normalizePath } from '../http-utils';
import type { RouteEntry, HandleAuthHttpRequestResult } from './route-table';

export const dispatchRequest = async (
  routeTable: RouteEntry[],
  request: IncomingMessage,
  response: ServerResponse,
): Promise<HandleAuthHttpRequestResult> => {
  const path = normalizePath(request.url);

  for (const entry of routeTable) {
    if (typeof entry.pattern === 'string') {
      if (entry.pattern !== path) {
        continue;
      }

      if (entry.method !== null && entry.method !== request.method) {
        continue;
      }

      await entry.handler(request, response);
      return { handled: true };
    }

    const match = path.match(entry.pattern);
    if (!match) {
      continue;
    }

    if (entry.method !== null && entry.method !== request.method) {
      continue;
    }

    await entry.handler(request, response, ...match.slice(1));
    return { handled: true };
  }

  return { handled: false };
};
