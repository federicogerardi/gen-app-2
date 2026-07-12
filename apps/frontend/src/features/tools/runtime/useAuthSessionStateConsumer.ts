import { useAuthState, useApiConfig } from '../../../app/providers/AuthSessionProvider';

export interface AuthSessionStateConsumerValue {
  readonly session: import('../../../app/providers/AuthSessionProvider').AuthStateValue['session'];
  readonly loading: boolean;
  readonly hasError: boolean;
  readonly apiBaseUrl: string;
  readonly capabilities: Record<string, boolean>;
}

export const useAuthSessionStateConsumer = (): AuthSessionStateConsumerValue => {
  const { session, loading, hasError } = useAuthState();
  const { apiBaseUrl, capabilities } = useApiConfig();

  return {
    session,
    loading,
    hasError,
    apiBaseUrl,
    capabilities,
  };
};
