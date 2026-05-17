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

export const readGitHubApiConfigFromEnv = (): GitHubApiConfig | null => {
  const token = process.env.GITHUB_TOKEN?.trim() ?? '';
  if (!token) {
    console.debug('[readGitHubApiConfigFromEnv] GITHUB_TOKEN not set, GitHub integration disabled');
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

  console.debug('[readGitHubApiConfigFromEnv] GitHub config loaded', {
    owner: config.owner,
    repo: config.repo,
    apiBaseUrl: config.apiBaseUrl,
    apiVersion: config.apiVersion,
    timeoutMs: config.timeoutMs,
    maxRetries: config.maxRetries,
    retryBaseDelayMs: config.retryBaseDelayMs,
    tokenLength: token.length,
  });

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
