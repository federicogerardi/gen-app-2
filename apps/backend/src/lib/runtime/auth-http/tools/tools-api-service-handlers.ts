import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Pool } from 'pg';

import { resolveApiServiceForAcquisition } from '../../../adapters/api-service.adapter';
import { listApiServiceBindings } from '../../../adapters/api-service.adapter';
import type { AuthSessionPrincipal } from '../../../types/auth';
import { toApiServiceRedactedDto } from '../../integrations/api-service-validation';
import type {
  AuthHttpWriteErrorFn,
  AuthHttpWriteSuccessFn,
} from '../support';

export type CreateToolsApiServiceHandlersDependencies = {
  parseRequestUrl: (request: IncomingMessage) => URL;
  requireDb: (response: ServerResponse) => Pool | null;
  requireSessionPrincipal: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => Promise<AuthSessionPrincipal | null>;
  writeError: AuthHttpWriteErrorFn;
  writeSuccess: AuthHttpWriteSuccessFn;
};

export type ToolsApiServiceHandlers = {
  handleToolsApiServiceResolve(request: IncomingMessage, response: ServerResponse): Promise<void>;
};

export const createToolsApiServiceHandlers = (
  deps: CreateToolsApiServiceHandlersDependencies,
): ToolsApiServiceHandlers => {
  const {
    parseRequestUrl,
    requireDb,
    requireSessionPrincipal,
    writeError,
    writeSuccess,
  } = deps;

  const handleToolsApiServiceResolve = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for tools api-service resolve');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) {
      return;
    }

    const db = requireDb(response);
    if (!db) {
      return;
    }

    const url = parseRequestUrl(request);
    const apiServiceId = url.searchParams.get('apiServiceId')?.trim() ?? '';

    if (!apiServiceId) {
      writeError(response, 400, 'bad_request', 'apiServiceId is required');
      return;
    }

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(apiServiceId)) {
      writeError(response, 400, 'bad_request', 'apiServiceId must be a valid UUID');
      return;
    }

    const service = await resolveApiServiceForAcquisition(db, apiServiceId);
    if (!service) {
      writeError(response, 404, 'not_found', 'ApiService not found');
      return;
    }

    const bindings = await listApiServiceBindings(db, apiServiceId);

    const resolveContract = {
      apiServiceId: service.id,
      key: service.key,
      contractProfileVersion: service.contractProfileVersion,
      requestContractProfile: {
        requestMethod: service.requestMethod,
        requestTemplateJson: service.requestTemplateJson,
        requestMappingRulesJson: service.requestMappingRulesJson,
        requestHeadersTemplateJson: service.requestHeadersTemplateJson,
        tokenHeaderName: service.tokenHeaderName,
      },
      responseContractProfile: {
        responseMappingRulesJson: service.responseMappingRulesJson,
        errorMappingRulesJson: service.errorMappingRulesJson,
        contractProfileVersion: service.contractProfileVersion,
      },
      bindings: bindings.map((binding) => ({
        id: binding.id,
        apiServiceId: binding.apiServiceId,
        toolKey: binding.toolKey,
        stepKey: binding.stepKey,
        workflowStepType: binding.workflowStepType,
        bindingStatus: binding.bindingStatus,
        requiredness: binding.requiredness,
        createdAt: binding.createdAt.toISOString(),
        updatedAt: binding.updatedAt.toISOString(),
      })),
    };

    writeSuccess(response, 200, {
      apiService: toApiServiceRedactedDto(service, Boolean(service.tokenCiphertext)),
      resolveContract,
      requesterUserId: principal.user.id,
    });
  };

  return {
    handleToolsApiServiceResolve,
  };
};
