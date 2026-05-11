const TELEMETRY_ENDPOINT = '/api/frontend/telemetry';

type MonitoringProvider = 'none' | 'console' | 'sentry' | 'logrocket';

const normalizeProvider = (value: string | undefined): MonitoringProvider => {
  const normalized = value?.trim().toLowerCase();

  if (normalized === 'console' || normalized === 'sentry' || normalized === 'logrocket') {
    return normalized;
  }

  return 'none';
};

const postTelemetry = async (payload: Record<string, unknown>): Promise<void> => {
  try {
    await fetch(TELEMETRY_ENDPOINT, {
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

const registerWindowTelemetry = (provider: MonitoringProvider): void => {
  window.addEventListener('error', (event) => {
    void postTelemetry({
      kind: 'window.error',
      provider,
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    void postTelemetry({
      kind: 'window.unhandledrejection',
      provider,
      reason: String(event.reason),
    });
  });
};

export const initializeMonitoring = (): void => {
  const provider = normalizeProvider(import.meta.env.VITE_MONITORING_PROVIDER);

  if (provider === 'none') {
    return;
  }

  registerWindowTelemetry(provider);

  if (provider === 'console') {
    // Minimal local visibility for rollout checks.
    console.info('[monitoring] console provider enabled');
  }
};
