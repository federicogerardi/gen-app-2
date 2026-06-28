import { useState } from 'react';
import { appCopy } from '../../../app/copy/system';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { ChangelogTable } from '../changelog/ChangelogTable';
import { useAdminChangelogQuery } from '../runtime/useAdminChangelogQuery';
import { useAdminChangelogMutations } from '../runtime/useAdminChangelogMutations';
import { AdminChangelogToolbar } from '../ui/AdminChangelogToolbar';
import { AdminChangelogPublishForm } from '../ui/AdminChangelogPublishForm';
import { AdminPageContainer } from '../ui/AdminPageContainer';

export const AdminChangelogPage = () => {
  const auth = useAuthSession();

  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const isAdmin = auth.session?.user.role === 'admin';

  const changelogQuery = useAdminChangelogQuery({
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
    showArchived,
  });

  const { isPublishing, busyAction, handlePublish, handleArchiveChangelog } = useAdminChangelogMutations({
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
    reloadChangelog: changelogQuery.reload,
    draftTitle,
    draftBody,
    isAdmin,
    onTitleChange: setDraftTitle,
    onBodyChange: setDraftBody,
  });

  return (
    <AdminPageContainer
      title={appCopy.editorial.admin.changelogTitle}
      description={appCopy.ui.adminChangelog.pageDescription}
    >

      <AdminChangelogToolbar
        showArchived={showArchived}
        loading={changelogQuery.loading}
        isPublishing={isPublishing}
        busyAction={busyAction}
        onToggleArchived={() => setShowArchived((current) => !current)}
        onReload={changelogQuery.reload}
      />

      <AdminChangelogPublishForm
        title={draftTitle}
        body={draftBody}
        isAdmin={isAdmin}
        isPublishing={isPublishing}
        onTitleChange={setDraftTitle}
        onBodyChange={setDraftBody}
        onPublish={() => void handlePublish()}
      />

      <ChangelogTable
        rows={changelogQuery.data}
        loading={changelogQuery.loading}
        error={changelogQuery.error}
        busyAction={busyAction}
        onArchive={(changelogId) => { void handleArchiveChangelog(changelogId); }}
      />
    </AdminPageContainer>
  );
};
