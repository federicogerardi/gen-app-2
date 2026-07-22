import { Surface } from '../../../app/ui/primitives';
import { appCopy } from '../../../app/copy/system';
import { useApiConfig } from '../../../app/providers/AuthSessionProvider';
import { useAdminSessionsQuery } from '../../../app/runtime/queries/useAdminSessionsQuery';
import { SessionsListingSection } from '../../artifacts/ui/SessionsListingSection';

export const AdminSessionsPage = () => {
  const { apiBaseUrl, capabilities } = useApiConfig();
  const sessionsQuery = useAdminSessionsQuery({
    apiBaseUrl,
    capabilities,
  });

  return (
    <Surface as="section">
      <SessionsListingSection
        title={appCopy.editorial.admin.sessionsTitle}
        emptyStateMessage={appCopy.editorial.sessions.emptyState}
        sessions={sessionsQuery.data}
        loading={sessionsQuery.loading}
        error={sessionsQuery.error}
        showUserColumn
        projectColumnLabel={appCopy.ui.labels.workflow}
        buildDetailPath={(session) => `/admin/sessions/${session.sessionId}`}
      />
    </Surface>
  );
};
