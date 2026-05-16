import type { IncomingMessage, ServerResponse } from 'node:http';

export type AdminHandlers = {
  handleAdminModelsList(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleAdminModelsCreate(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleAdminModelsUpdate(request: IncomingMessage, response: ServerResponse, modelId: string): Promise<void>;
  handleAdminModelsDelete(request: IncomingMessage, response: ServerResponse, modelId: string): Promise<void>;
  handleAdminCreateChangelog(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleAdminListUserReports(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleAdminUpdateUserReport(request: IncomingMessage, response: ServerResponse, reportId: string): Promise<void>;
  handleAdminPublishUserReportIssue(request: IncomingMessage, response: ServerResponse, reportId: string): Promise<void>;
  handleAdminListUsers(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleAdminCreateUser(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleAdminGetUser(request: IncomingMessage, response: ServerResponse, userId: string): Promise<void>;
  handleAdminUpdateUser(request: IncomingMessage, response: ServerResponse, userId: string): Promise<void>;
  handleAdminDeleteUser(request: IncomingMessage, response: ServerResponse, userId: string): Promise<void>;
};

export const createAdminHandlers = (handlers: AdminHandlers): AdminHandlers => handlers;
