type MonitoringProvider = 'none' | 'console' | 'sentry' | 'logrocket';

const normalizeProvider = (value: string | undefined): MonitoringProvider => {
  const normalized = value?.trim().toLowerCase();

  if (normalized === 'console' || normalized === 'sentry' || normalized === 'logrocket') {
    return normalized;
  }

  return 'none';
};

const resolveTelemetryEndpoint = (value: string | undefined): string | null => {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }
  return normalized;
};

const postTelemetry = async (
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<void> => {
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Best-effort transport. Never block UI bootstrap on telemetry failures.
  }
};

const registerWindowTelemetry = (provider: MonitoringProvider, endpoint: string): void => {
  window.addEventListener('error', (event) => {
    void postTelemetry(endpoint, {
      kind: 'window.error',
      provider,
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    void postTelemetry(endpoint, {
      kind: 'window.unhandledrejection',
      provider,
      reason: String(event.reason),
    });
  });
};

export const initializeMonitoring = (): void => {
  const provider = normalizeProvider(import.meta.env.VITE_MONITORING_PROVIDER);
  const telemetryEndpoint = resolveTelemetryEndpoint(import.meta.env.VITE_MONITORING_ENDPOINT);

  if (provider === 'none') {
    return;
  }

  if (telemetryEndpoint) {
    registerWindowTelemetry(provider, telemetryEndpoint);
  }

  if (provider === 'console') {
    // Minimal local visibility for rollout checks.
    console.info(`[monitoring] console provider enabled telemetry=${telemetryEndpoint ? 'on' : 'off'}`);
  }
};
