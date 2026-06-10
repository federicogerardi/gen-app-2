export type ApiServiceAccessMode = 'public' | 'token';
export type ApiServiceStatus = 'active' | 'inactive';
export type ApiServiceRequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type ApiServiceBindingStatus = 'active' | 'inactive';
export type ApiServiceBindingRequiredness =
  | 'always-required'
  | 'required-by-tool-setting'
  | 'optional-by-tool-setting';

export type ApiServiceRequestMappingRule = {
  sourcePath: string;
  targetPath: string;
  required?: boolean;
};

export type ApiServiceResponseMappingRule = {
  sourcePath: string;
  targetPath: string;
  required?: boolean;
};

export type ApiServiceErrorMappingRule = {
  statusCode?: number;
  sourcePath?: string;
  errorCode: string;
  message?: string;
};

export type ApiServiceRequestContractProfile = {
  requestMethod: ApiServiceRequestMethod;
  requestTemplateJson: Record<string, unknown>;
  requestMappingRulesJson: ApiServiceRequestMappingRule[];
  requestHeadersTemplateJson: Record<string, unknown>;
  tokenHeaderName?: string | null;
};

export type ApiServiceResponseContractProfile = {
  responseMappingRulesJson: ApiServiceResponseMappingRule[];
  errorMappingRulesJson: ApiServiceErrorMappingRule[];
  contractProfileVersion: number;
};

export type ApiServiceToolStepBindingDto = {
  id: string;
  apiServiceId: string;
  toolKey: string;
  stepKey: string;
  workflowStepType: 'acquisition';
  bindingStatus: ApiServiceBindingStatus;
  requiredness: ApiServiceBindingRequiredness;
  createdAt: string;
  updatedAt: string;
};

export type ApiServiceResolveContractDto = {
  apiServiceId: string;
  key: string;
  contractProfileVersion: number;
  requestContractProfile: ApiServiceRequestContractProfile;
  responseContractProfile: ApiServiceResponseContractProfile;
  bindings: ApiServiceToolStepBindingDto[];
};

export type ApiServiceDto = {
  id: string;
  key: string;
  label: string;
  baseUrl: string;
  resourcePath: string;
  accessMode: ApiServiceAccessMode;
  timeoutMs: number;
  retryCount: number;
  status: ApiServiceStatus;
  tokenRef: string | null;
  tokenHeaderName?: string | null;
  tokenConfigured: boolean;
  requestContractProfile?: ApiServiceRequestContractProfile;
  responseContractProfile?: ApiServiceResponseContractProfile;
  createdAt: string;
  updatedAt: string;
};

export type CreateApiServiceCommand = {
  key: string;
  label: string;
  baseUrl: string;
  resourcePath: string;
  accessMode: ApiServiceAccessMode;
  timeoutMs?: number;
  retryCount?: number;
  tokenRef?: string | null;
  tokenHeaderName?: string | null;
};

export type UpdateApiServiceCommand = Partial<CreateApiServiceCommand> & {
  status?: ApiServiceStatus;
};

export type ApiAcquisitionRequest = {
  apiServiceId: string;
  input: Record<string, unknown>;
};

export type ApiAcquisitionResult = {
  apiServiceId: string;
  payload: Record<string, unknown>;
};
