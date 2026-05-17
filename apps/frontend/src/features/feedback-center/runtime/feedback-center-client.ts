import { buildApiPaths } from '../../../app/runtime/api-paths';
import { resolveBackendCapabilities, type BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import {
  isHttpClientError,
  joinApiPath,
  requestJson,
} from '../../../app/runtime/http-client';
import type {
  CreateProductChangelogCommand,
  CreateUserReportCommand,
  GitHubIssueLinkDto,
  ProductChangelogDto,
  ProductChangelogStatus,
  PublishUserReportIssueCommand,
  UpdateUserReportStatusCommand,
  UserReportCategory,
  UserReportDto,
  UserReportStatus,
} from '../contracts/feedback-center-contract';

type FeedbackCenterClientOptions = {
  apiBaseUrl?: string;
  capabilities?: Partial<BackendCapabilities>;
};

export type FeedbackCenterClientFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    status: number | null;
    retryable: boolean;
  };
};

export type FeedbackCenterClientSuccess<TData> = {
  ok: true;
  data: TData;
};

export type FeedbackCenterClientResult<TData> =
  | FeedbackCenterClientSuccess<TData>
  | FeedbackCenterClientFailure;

type FeedbackCenterSuccessEnvelope<TData> = {
  ok: true;
  data: TData;
};

type FeedbackCenterErrorEnvelope = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

const CAPABILITY_DISABLED_ERROR_CODE = 'capability_disabled';

const buildCapabilityDisabledFailure = (message: string): FeedbackCenterClientFailure => ({
  ok: false,
  error: {
    code: CAPABILITY_DISABLED_ERROR_CODE,
    message,
    status: null,
    retryable: false,
  },
});

const buildFailure = (
  error: unknown,
  fallbackMessage: string,
): FeedbackCenterClientFailure => {
  if (isHttpClientError(error)) {
    const details = error.details as FeedbackCenterErrorEnvelope | null;
    return {
      ok: false,
      error: {
        code: details?.error?.code ?? error.code,
        message: details?.error?.message ?? fallbackMessage,
        status: error.status,
        retryable: error.retryable,
      },
    };
  }

  if (error instanceof Error) {
    return {
      ok: false,
      error: {
        code: 'client_error',
        message: error.message || fallbackMessage,
        status: null,
        retryable: false,
      },
    };
  }

  return {
    ok: false,
    error: {
      code: 'unknown_error',
      message: fallbackMessage,
      status: null,
      retryable: false,
    },
  };
};

const readSuccessData = <TData>(
  payload: FeedbackCenterSuccessEnvelope<TData> | FeedbackCenterErrorEnvelope,
  fallbackMessage: string,
): FeedbackCenterClientResult<TData> => {
  if (payload.ok) {
    return {
      ok: true,
      data: payload.data,
    };
  }

  return {
    ok: false,
    error: {
      code: payload.error.code,
      message: payload.error.message || fallbackMessage,
      status: null,
      retryable: false,
    },
  };
};

export type ListAdminUserReportsFilters = {
  status?: UserReportStatus;
  category?: UserReportCategory;
};

export const submitUserReport = async (
  command: CreateUserReportCommand,
  options: FeedbackCenterClientOptions = {},
): Promise<FeedbackCenterClientResult<UserReportDto>> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = buildApiPaths(capabilities).feedback.userReportsCreate;

  if (!path) {
    return buildCapabilityDisabledFailure('User report submission is disabled by capability flag.');
  }

  try {
    const payload = await requestJson<
      FeedbackCenterSuccessEnvelope<{ report: UserReportDto }> | FeedbackCenterErrorEnvelope
    >(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    });

    const result = readSuccessData(payload, 'Unable to submit user report');
    if (!result.ok) {
      return result;
    }

    return { ok: true, data: result.data.report };
  } catch (error) {
    return buildFailure(error, 'Unable to submit user report');
  }
};

export const listAdminUserReports = async (
  filters: ListAdminUserReportsFilters = {},
  options: FeedbackCenterClientOptions = {},
): Promise<FeedbackCenterClientResult<UserReportDto[]>> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = buildApiPaths(capabilities).feedback.adminUserReportsList;

  if (!path) {
    return buildCapabilityDisabledFailure('Admin user report inbox is disabled by capability flag.');
  }

  const searchParams = new URLSearchParams();
  if (filters.status) {
    searchParams.set('status', filters.status);
  }

  if (filters.category) {
    searchParams.set('category', filters.category);
  }

  const query = searchParams.size > 0 ? `?${searchParams.toString()}` : '';

  try {
    const payload = await requestJson<
      FeedbackCenterSuccessEnvelope<{ reports: UserReportDto[] }> | FeedbackCenterErrorEnvelope
    >(joinApiPath(options.apiBaseUrl ?? '', `${path}${query}`), {
      method: 'GET',
      credentials: 'include',
    });

    const result = readSuccessData(payload, 'Unable to load admin user reports');
    if (!result.ok) {
      return result;
    }

    return { ok: true, data: result.data.reports };
  } catch (error) {
    return buildFailure(error, 'Unable to load admin user reports');
  }
};

export const updateUserReportStatus = async (
  reportId: string,
  command: UpdateUserReportStatusCommand,
  options: FeedbackCenterClientOptions = {},
): Promise<FeedbackCenterClientResult<UserReportDto>> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = buildApiPaths(capabilities).feedback.adminUserReportById(reportId);

  if (!path) {
    return buildCapabilityDisabledFailure('Admin user report status update is disabled by capability flag.');
  }

  try {
    const payload = await requestJson<
      FeedbackCenterSuccessEnvelope<{ report: UserReportDto }> | FeedbackCenterErrorEnvelope
    >(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    });

    const result = readSuccessData(payload, 'Unable to update user report status');
    if (!result.ok) {
      return result;
    }

    return { ok: true, data: result.data.report };
  } catch (error) {
    return buildFailure(error, 'Unable to update user report status');
  }
};

export const publishUserReportIssue = async (
  reportId: string,
  command: PublishUserReportIssueCommand,
  options: FeedbackCenterClientOptions = {},
): Promise<FeedbackCenterClientResult<GitHubIssueLinkDto>> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = buildApiPaths(capabilities).feedback.adminPublishUserReportIssue(reportId);

  if (!path) {
    return buildCapabilityDisabledFailure('Admin user report issue publication is disabled by capability flag.');
  }

  try {
    const payload = await requestJson<
      FeedbackCenterSuccessEnvelope<{ githubLink: GitHubIssueLinkDto }> | FeedbackCenterErrorEnvelope
    >(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    });

    const result = readSuccessData(payload, 'Unable to publish user report issue');
    if (!result.ok) {
      return result;
    }

    return { ok: true, data: result.data.githubLink };
  } catch (error) {
    return buildFailure(error, 'Unable to publish user report issue');
  }
};

export const createProductChangelog = async (
  command: CreateProductChangelogCommand & { status?: ProductChangelogStatus },
  options: FeedbackCenterClientOptions = {},
): Promise<FeedbackCenterClientResult<ProductChangelogDto>> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = buildApiPaths(capabilities).feedback.adminChangelogCreate;

  if (!path) {
    return buildCapabilityDisabledFailure('Admin changelog publication is disabled by capability flag.');
  }

  try {
    const payload = await requestJson<
      FeedbackCenterSuccessEnvelope<{ changelog: ProductChangelogDto }> | FeedbackCenterErrorEnvelope
    >(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    });

    const result = readSuccessData(payload, 'Unable to create changelog entry');
    if (!result.ok) {
      return result;
    }

    return { ok: true, data: result.data.changelog };
  } catch (error) {
    return buildFailure(error, 'Unable to create changelog entry');
  }
};

export const listPublishedProductChangelog = async (
  options: FeedbackCenterClientOptions = {},
): Promise<FeedbackCenterClientResult<ProductChangelogDto[]>> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = buildApiPaths(capabilities).feedback.changelogList;

  if (!path) {
    return buildCapabilityDisabledFailure('Published changelog listing is disabled by capability flag.');
  }

  try {
    const payload = await requestJson<
      FeedbackCenterSuccessEnvelope<{ changelog: ProductChangelogDto[] }> | FeedbackCenterErrorEnvelope
    >(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'GET',
      credentials: 'include',
    });

    const result = readSuccessData(payload, 'Unable to list published changelog');
    if (!result.ok) {
      return result;
    }

    return { ok: true, data: result.data.changelog };
  } catch (error) {
    return buildFailure(error, 'Unable to list published changelog');
  }
};

export const listAdminProductChangelog = async (
  options: FeedbackCenterClientOptions = {},
): Promise<FeedbackCenterClientResult<ProductChangelogDto[]>> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = buildApiPaths(capabilities).feedback.adminChangelogListAll;

  if (!path) {
    return buildCapabilityDisabledFailure('Admin changelog listing is disabled by capability flag.');
  }

  try {
    const payload = await requestJson<
      FeedbackCenterSuccessEnvelope<{ changelogs: ProductChangelogDto[] }> | FeedbackCenterErrorEnvelope
    >(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'GET',
      credentials: 'include',
    });

    const result = readSuccessData(payload, 'Unable to list admin changelog');
    if (!result.ok) {
      return result;
    }

    return { ok: true, data: result.data.changelogs };
  } catch (error) {
    return buildFailure(error, 'Unable to list admin changelog');
  }
};

export const archiveProductChangelog = async (
  changelogId: string,
  options: FeedbackCenterClientOptions = {},
): Promise<FeedbackCenterClientResult<ProductChangelogDto>> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const pathFn = buildApiPaths(capabilities).feedback.adminChangelogArchive;
  const path = pathFn(changelogId);

  if (!path) {
    return buildCapabilityDisabledFailure('Admin changelog archival is disabled by capability flag.');
  }

  try {
    const payload = await requestJson<
      FeedbackCenterSuccessEnvelope<{ changelog: ProductChangelogDto }> | FeedbackCenterErrorEnvelope
    >(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const result = readSuccessData(payload, 'Unable to archive changelog entry');
    if (!result.ok) {
      return result;
    }

    return { ok: true, data: result.data.changelog };
  } catch (error) {
    return buildFailure(error, 'Unable to archive changelog entry');
  }
};
