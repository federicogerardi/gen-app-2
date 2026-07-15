import { createComponentLogger, LogComponent } from '../log-components';

export type GitHubApiConfig = {
  token: string;
  owner?: string;
  repo?: string;
  apiBaseUrl: string;
  apiVersion: string;
  timeoutMs: number;
  maxRetries: number;
  retryBaseDelayMs: number;
};

const parseInteger = (raw: string | undefined, fallback: number): number => {
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
};

const shouldEmitGitHubConfigDiagnostics = (): boolean => {
  return process.env.GITHUB_DEBUG_DIAGNOSTICS === '1' && process.env.NODE_ENV !== 'production';
};

export const readGitHubApiConfigFromEnv = (): GitHubApiConfig | null => {
  const token = process.env.GITHUB_TOKEN?.trim() ?? '';
  if (!token) {
    if (shouldEmitGitHubConfigDiagnostics()) {
      const log = createComponentLogger(LogComponent.GITHUB_CONFIG);
      log.debug('GitHub integration disabled: missing token');
    }
    return null;
  }

  const owner = process.env.GITHUB_ISSUES_OWNER?.trim() || undefined;
  const repo = process.env.GITHUB_ISSUES_REPO?.trim() || undefined;

  const config = {
    token,
    ...(owner ? { owner } : {}),
    ...(repo ? { repo } : {}),
    apiBaseUrl: process.env.GITHUB_API_BASE_URL?.trim() || 'https://api.github.com',
    apiVersion: process.env.GITHUB_API_VERSION?.trim() || '2022-11-28',
    timeoutMs: parseInteger(process.env.GITHUB_API_TIMEOUT_MS, 8_000),
    maxRetries: parseInteger(process.env.GITHUB_API_MAX_RETRIES, 2),
    retryBaseDelayMs: parseInteger(process.env.GITHUB_API_RETRY_BASE_DELAY_MS, 300),
  };

  if (shouldEmitGitHubConfigDiagnostics()) {
    const log = createComponentLogger(LogComponent.GITHUB_CONFIG);
    log.debug({ hasOwner: Boolean(config.owner), hasRepo: Boolean(config.repo), timeoutMs: config.timeoutMs, maxRetries: config.maxRetries, retryBaseDelayMs: config.retryBaseDelayMs }, 'GitHub config loaded');
  }

  return config;
};

export const assertGitHubApiConfig = (config: GitHubApiConfig | null): void => {
  if (!config) {
    return;
  }

  if (!config.owner || !config.repo) {
    throw new Error(
      'GitHub integration misconfigured: GITHUB_ISSUES_OWNER and GITHUB_ISSUES_REPO are required when GITHUB_TOKEN is set',
    );
  }
};
