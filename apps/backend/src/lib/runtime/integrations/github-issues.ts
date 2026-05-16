import type { GitHubApiConfig } from './github-config';

type PublishGitHubIssueInput = {
  owner: string;
  repo: string;
  title: string;
  body: string;
  requestId?: string;
};

export type PublishGitHubIssueResult = {
  issueNumber: number;
  issueUrl: string;
  issueApiUrl: string;
};

export type PublishGitHubIssueErrorCode =
  | 'auth_error'
  | 'forbidden'
  | 'not_found'
  | 'validation_error'
  | 'rate_limited'
  | 'upstream_unavailable';

export class PublishGitHubIssueError extends Error {
  readonly code: PublishGitHubIssueErrorCode;

  readonly statusCode: number;

  constructor(code: PublishGitHubIssueErrorCode, statusCode: number, message: string) {
    super(message);
    this.name = 'PublishGitHubIssueError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const sleep = async (ms: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
};

const parseIssueErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json() as { message?: string };
    if (typeof payload.message === 'string' && payload.message.trim().length > 0) {
      return payload.message;
    }
  } catch {
    // ignore invalid/non-json payloads
  }

  return `GitHub API error (${response.status})`;
};

const mapStatusToErrorCode = (status: number): PublishGitHubIssueErrorCode => {
  if (status === 401) {
    return 'auth_error';
  }

  if (status === 403) {
    return 'forbidden';
  }

  if (status === 404) {
    return 'not_found';
  }

  if (status === 422) {
    return 'validation_error';
  }

  if (status === 429) {
    return 'rate_limited';
  }

  return 'upstream_unavailable';
};

const shouldRetryStatus = (status: number): boolean => status === 429 || status >= 500;

export const publishGitHubIssue = async (
  config: GitHubApiConfig,
  input: PublishGitHubIssueInput,
): Promise<PublishGitHubIssueResult> => {
  const endpoint = `${config.apiBaseUrl.replace(/\/$/, '')}/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/issues`;

  let attempt = 0;
  while (attempt <= config.maxRetries) {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), config.timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': config.apiVersion,
          'Content-Type': 'application/json',
          ...(input.requestId ? { 'X-Request-Id': input.requestId } : {}),
        },
        body: JSON.stringify({
          title: input.title,
          body: input.body,
        }),
        signal: abortController.signal,
      });

      clearTimeout(timeout);

      if (response.status >= 200 && response.status < 300) {
        const payload = await response.json() as {
          number: number;
          html_url: string;
          url: string;
        };

        return {
          issueNumber: payload.number,
          issueUrl: payload.html_url,
          issueApiUrl: payload.url,
        };
      }

      if (shouldRetryStatus(response.status) && attempt < config.maxRetries) {
        const backoffMs = config.retryBaseDelayMs * (2 ** attempt);
        await sleep(backoffMs);
        attempt += 1;
        continue;
      }

      const message = await parseIssueErrorMessage(response);
      throw new PublishGitHubIssueError(mapStatusToErrorCode(response.status), response.status, message);
    } catch (error) {
      clearTimeout(timeout);

      if (error instanceof PublishGitHubIssueError) {
        throw error;
      }

      if (attempt < config.maxRetries) {
        const backoffMs = config.retryBaseDelayMs * (2 ** attempt);
        await sleep(backoffMs);
        attempt += 1;
        continue;
      }

      throw new PublishGitHubIssueError(
        'upstream_unavailable',
        503,
        'Unable to reach GitHub Issues API',
      );
    }
  }

  throw new PublishGitHubIssueError('upstream_unavailable', 503, 'Unable to reach GitHub Issues API');
};
