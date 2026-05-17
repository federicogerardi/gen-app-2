import { appCopy } from '../../../app/copy/system';
import { EmptyStateMessage } from '../../../app/ui/primitives';
import { ActivityLogTable } from '../activity/ActivityLogTable';
import { useAdminActivityFeed } from '../runtime/useAdminActivityFeed';
import { AdminPageContainer } from '../ui/AdminPageContainer';

export const AdminActivityPage = () => {
  const feed = useAdminActivityFeed();

  return (
    <AdminPageContainer
      title={appCopy.editorial.admin.activityTitle}
      description={appCopy.editorial.admin.activityBody}
    >

      {feed.length === 0
        ? <EmptyStateMessage>Nessuna attività recente.</EmptyStateMessage>
        : <ActivityLogTable rows={feed} />}
    </AdminPageContainer>
  );
};
