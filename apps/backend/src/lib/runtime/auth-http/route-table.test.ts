import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildRouteTable, type AllHandlerGroups } from './route-table';
import { dispatchRequest } from './route-dispatch';

describe('Route order and dispatch semantics', () => {
  let mockRequest: Partial<IncomingMessage>;
  let mockResponse: Partial<ServerResponse>;

  beforeEach(() => {
    mockRequest = {
      url: '',
      method: 'GET',
    };
    mockResponse = {};
  });

  it('TEST-001a: POST /api/admin/user-reports/:id/publish-issue should match before /:id pattern', async () => {
    const publishIssueCalled = vi.fn();
    const updateReportCalled = vi.fn();

    const mockHandlers: AllHandlerGroups = {
      authHandlers: {} as any,
      adminHandlers: {
        handleAdminPublishUserReportIssue: async () => publishIssueCalled(),
        handleAdminUpdateUserReport: async () => updateReportCalled(),
      } as any,
      projectsHandlers: {} as any,
      publicHandlers: {} as any,
      toolsHandlers: {} as any,
      writeError: () => {},
    };

    const routeTable = buildRouteTable(mockHandlers);
    mockRequest.url = '/api/admin/user-reports/report123/publish-issue';
    mockRequest.method = 'POST';

    await dispatchRequest(routeTable, mockRequest as IncomingMessage, mockResponse as ServerResponse);

    // Specific pattern should match, not generic /:id pattern
    expect(publishIssueCalled).toHaveBeenCalledOnce();
    expect(updateReportCalled).not.toHaveBeenCalled();
  });

  it('TEST-001b: GET /admin/users/{userId} should extract userId correctly', async () => {
    const getUserCalled = vi.fn();

    const mockHandlers: AllHandlerGroups = {
      authHandlers: {} as any,
      adminHandlers: {
        handleAdminGetUser: async (req: IncomingMessage, res: ServerResponse, userId: string) => {
          getUserCalled(userId);
        },
      } as any,
      projectsHandlers: {} as any,
      publicHandlers: {} as any,
      toolsHandlers: {} as any,
      writeError: () => {},
    };

    const routeTable = buildRouteTable(mockHandlers);
    mockRequest.url = '/admin/users/user-123-xyz';
    mockRequest.method = 'GET';

    await dispatchRequest(routeTable, mockRequest as IncomingMessage, mockResponse as ServerResponse);

    expect(getUserCalled).toHaveBeenCalledWith('user-123-xyz');
  });

  it('TEST-001c: Unmatched path should return { handled: false }', async () => {
    const mockHandlers: AllHandlerGroups = {
      authHandlers: {} as any,
      adminHandlers: {} as any,
      projectsHandlers: {} as any,
      publicHandlers: {} as any,
      toolsHandlers: {} as any,
      writeError: () => {},
    };

    const routeTable = buildRouteTable(mockHandlers);
    mockRequest.url = '/unknown/path';
    mockRequest.method = 'GET';

    const result = await dispatchRequest(routeTable, mockRequest as IncomingMessage, mockResponse as ServerResponse);

    expect(result.handled).toBe(false);
  });
});
