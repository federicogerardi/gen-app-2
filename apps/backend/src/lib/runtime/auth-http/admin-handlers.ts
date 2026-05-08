import type { IncomingMessage, ServerResponse } from 'node:http';

export type AdminHandlers = {
  handleAdminModelsList(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleAdminModelsCreate(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleAdminModelsUpdate(request: IncomingMessage, response: ServerResponse, modelId: string): Promise<void>;
  handleAdminModelsDelete(request: IncomingMessage, response: ServerResponse, modelId: string): Promise<void>;
  handleAdminModels: {
    list(request: IncomingMessage, response: ServerResponse): Promise<void>;
    create(request: IncomingMessage, response: ServerResponse): Promise<void>;
    update(request: IncomingMessage, response: ServerResponse, modelId: string): Promise<void>;
    remove(request: IncomingMessage, response: ServerResponse, modelId: string): Promise<void>;
  };
  handleAdminListUsers(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleAdminCreateUser(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleAdminGetUser(request: IncomingMessage, response: ServerResponse, userId: string): Promise<void>;
  handleAdminUpdateUser(request: IncomingMessage, response: ServerResponse, userId: string): Promise<void>;
  handleAdminDeleteUser(request: IncomingMessage, response: ServerResponse, userId: string): Promise<void>;
};

export const createAdminHandlers = (handlers: Omit<AdminHandlers, 'handleAdminModels'>): AdminHandlers => ({
  ...handlers,
  handleAdminModels: {
    list: handlers.handleAdminModelsList,
    create: handlers.handleAdminModelsCreate,
    update: handlers.handleAdminModelsUpdate,
    remove: handlers.handleAdminModelsDelete,
  },
});
