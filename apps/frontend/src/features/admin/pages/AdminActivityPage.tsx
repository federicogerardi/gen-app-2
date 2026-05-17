import { useMemo } from 'react';
import { appCopy } from '../../../app/copy/system';
import { EmptyStateMessage } from '../../../app/ui/primitives';
import { useGenerationWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';
import { ActivityLogTable } from '../activity/ActivityLogTable';
import { AdminPageContainer } from '../ui/AdminPageContainer';

export const AdminActivityPage = () => {
  const generation = useGenerationWorkspace();

  const feed = useMemo(() => {
    return [...generation.checkpoints]
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, 20);
  }, [generation.checkpoints]);

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
