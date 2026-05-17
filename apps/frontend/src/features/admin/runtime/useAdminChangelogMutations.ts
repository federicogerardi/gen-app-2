import { useState } from 'react';

import type { BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import { archiveProductChangelog, createProductChangelog } from '../../feedback-center/runtime/feedback-center-client';
import { useAdminMutationFeedback } from './useAdminMutationFeedback';

type UseAdminChangelogMutationsOptions = {
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  reloadChangelog: () => void;
  draftTitle: string;
  draftBody: string;
  isAdmin: boolean;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
};

export const useAdminChangelogMutations = ({
  apiBaseUrl,
  capabilities,
  reloadChangelog,
  draftTitle,
  draftBody,
  isAdmin,
  onTitleChange,
  onBodyChange,
}: UseAdminChangelogMutationsOptions) => {
  const { publishSuccess, publishError } = useAdminMutationFeedback();
  const [isPublishing, setIsPublishing] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const handlePublish = async () => {
    const title = draftTitle.trim();
    const body = draftBody.trim();
    if (!title || !body) {
      publishError('Compila titolo e contenuto prima della pubblicazione.', 'admin-changelog:publish:validation');
      return;
    }

    setIsPublishing(true);
    try {
      const result = await createProductChangelog(
        {
          title,
          body,
          status: 'published',
        },
        {
          apiBaseUrl,
          capabilities,
        },
      );

      if (!result.ok) {
        publishError(result.error.message, 'admin-changelog:publish:error');
        return;
      }

      onTitleChange('');
      onBodyChange('');
      publishSuccess('Voce changelog pubblicata.', 'admin-changelog:publish:success');
      reloadChangelog();
    } catch {
      publishError('Impossibile pubblicare la voce changelog.', 'admin-changelog:publish:unexpected-error');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleArchiveChangelog = async (changelogId: string) => {
    setBusyAction(`archive:${changelogId}`);
    try {
      const result = await archiveProductChangelog(
        changelogId,
        {
          apiBaseUrl,
          capabilities,
        },
      );

      if (!result.ok) {
        publishError(result.error.message, `admin-changelog:archive:${changelogId}:error`);
        return;
      }

      publishSuccess('Voce changelog archiviata.', `admin-changelog:archive:${changelogId}:success`);
      reloadChangelog();
    } catch {
      publishError('Impossibile archiviare la voce changelog.', `admin-changelog:archive:${changelogId}:unexpected-error`);
    } finally {
      setBusyAction(null);
    }
  };

  return {
    isPublishing,
    busyAction,
    handlePublish,
    handleArchiveChangelog,
    canPublish: isAdmin,
  };
};