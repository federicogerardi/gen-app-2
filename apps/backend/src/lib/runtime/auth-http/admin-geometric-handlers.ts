import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Pool } from 'pg';

import {
  getScreenshotById,
  listAllScreenshots,
  listScreenshotsBySession,
} from '../../adapters';
import type { AuthSessionPrincipal } from '../../types/auth';
import type { ScreenshotStorageAdapter } from '../integrations/screenshot-storage';
import type {
  AuthHttpWriteErrorFn,
  AuthHttpWriteSuccessFn,
} from './support';

export type CreateAdminGeometricHandlersDependencies = {
  requireAdminPrincipal: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => Promise<AuthSessionPrincipal | null>;
  requireDb: (response: ServerResponse) => Pool | null;
  writeError: AuthHttpWriteErrorFn;
  writeSuccess: AuthHttpWriteSuccessFn;
  screenshotStorage: ScreenshotStorageAdapter | null;
};

export type AdminGeometricHandlers = {
  handleAdminListAllScreenshots(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void>;
  handleAdminListSessionScreenshots(
    request: IncomingMessage,
    response: ServerResponse,
    sessionId: string,
  ): Promise<void>;
  handleAdminGetScreenshot(
    request: IncomingMessage,
    response: ServerResponse,
    screenshotId: string,
  ): Promise<void>;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const createAdminGeometricHandlers = (
  deps: CreateAdminGeometricHandlersDependencies,
): AdminGeometricHandlers => {
  const { requireAdminPrincipal, requireDb, writeError, writeSuccess, screenshotStorage } = deps;

  const handleAdminListAllScreenshots = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for all screenshots list');
      return;
    }

    const adminPrincipal = await requireAdminPrincipal(request, response);
    if (!adminPrincipal) {
      return;
    }

    const db = requireDb(response);
    if (!db) {
      return;
    }

    const screenshots = await listAllScreenshots(db);
    console.log(`[DEBUG][admin-screenshots] listAllScreenshots returned ${screenshots.length} records`);
    writeSuccess(response, 200, { screenshots });
  };

  const handleAdminListSessionScreenshots = async (
    request: IncomingMessage,
    response: ServerResponse,
    sessionId: string,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for session screenshots list');
      return;
    }

    const adminPrincipal = await requireAdminPrincipal(request, response);
    if (!adminPrincipal) {
      return;
    }

    const db = requireDb(response);
    if (!db) {
      return;
    }

    const screenshots = await listScreenshotsBySession(db, sessionId);
    writeSuccess(response, 200, { screenshots });
  };

  const handleAdminGetScreenshot = async (
    request: IncomingMessage,
    response: ServerResponse,
    screenshotId: string,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for screenshot download');
      return;
    }

    const adminPrincipal = await requireAdminPrincipal(request, response);
    if (!adminPrincipal) {
      return;
    }

    const db = requireDb(response);
    if (!db) {
      return;
    }

    if (!UUID_REGEX.test(screenshotId)) {
      writeError(response, 400, 'bad_request', 'Invalid screenshot id');
      return;
    }

    const record = await getScreenshotById(db, screenshotId);
    if (!record) {
      writeError(response, 404, 'not_found', 'Screenshot not found');
      return;
    }

    if (!screenshotStorage) {
      writeError(response, 503, 'service_unavailable', 'Screenshot storage is not configured');
      return;
    }

    const absolutePath = screenshotStorage.getAbsolutePath(record.stored_path);

    try {
      const fileStat = await stat(absolutePath);
      response.statusCode = 200;
      response.setHeader('Content-Type', 'image/png');
      response.setHeader('Content-Length', String(fileStat.size));
      const stream = createReadStream(absolutePath);
      stream.pipe(response);
    } catch {
      writeError(response, 404, 'not_found', 'Screenshot file not found');
    }
  };

  return {
    handleAdminListAllScreenshots,
    handleAdminListSessionScreenshots,
    handleAdminGetScreenshot,
  };
};
