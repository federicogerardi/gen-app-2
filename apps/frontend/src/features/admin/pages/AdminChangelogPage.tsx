import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { TextField } from '@mui/material';
import { appCopy } from '../../../app/copy/system';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { useFeedbackMessage } from '../../../app/providers/FeedbackMessageProvider';
import { useAsyncQuery } from '../../../app/runtime/queries/useAsyncQuery';
import {
  cx,
  uiPrimitives,
} from '../../../app/ui/primitives';
import type { ProductChangelogDto } from '../../feedback-center/contracts/feedback-center-contract';
import {
  createProductChangelog,
  listPublishedProductChangelog,
  listAdminProductChangelog,
  archiveProductChangelog,
} from '../../feedback-center/runtime/feedback-center-client';
import { ChangelogTable } from '../changelog/ChangelogTable';
import { AdminPageContainer } from '../ui/AdminPageContainer';

export const AdminChangelogPage = () => {
  const auth = useAuthSession();
  const { publishSuccess, publishError } = useFeedbackMessage();

  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const isAdmin = auth.session?.user.role === 'admin';

  const listPublishedChangelogQuery = useCallback(async (): Promise<ProductChangelogDto[]> => {
    const result = await listPublishedProductChangelog({
      apiBaseUrl: auth.apiBaseUrl,
      capabilities: auth.capabilities,
    });

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    return result.data;
  }, [auth.apiBaseUrl, auth.capabilities]);

  const listAdminChangelogQuery = useCallback(async (): Promise<ProductChangelogDto[]> => {
    const result = await listAdminProductChangelog({
      apiBaseUrl: auth.apiBaseUrl,
      capabilities: auth.capabilities,
    });

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    return result.data;
  }, [auth.apiBaseUrl, auth.capabilities]);

  const changelogQuery = useAsyncQuery<ProductChangelogDto[]>({
    enabled: true,
    emptyData: [],
    errorMessage: 'Unable to load changelog',
    dependencyKey: JSON.stringify([auth.apiBaseUrl, auth.capabilities, showArchived]),
    query: showArchived ? listAdminChangelogQuery : listPublishedChangelogQuery,
  });

  const handlePublish = async () => {
    const title = draftTitle.trim();
    const body = draftBody.trim();
    if (!title || !body) {
      publishError('Compila titolo e contenuto prima della pubblicazione.', {
        dedupeKey: 'admin-changelog:publish:validation',
      });
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
          apiBaseUrl: auth.apiBaseUrl,
          capabilities: auth.capabilities,
        },
      );

      if (!result.ok) {
        publishError(result.error.message, { dedupeKey: 'admin-changelog:publish:error' });
        return;
      }

      setDraftTitle('');
      setDraftBody('');
      publishSuccess('Voce changelog pubblicata.', { dedupeKey: 'admin-changelog:publish:success' });
      changelogQuery.reload();
    } catch {
      publishError('Impossibile pubblicare la voce changelog.', {
        dedupeKey: 'admin-changelog:publish:unexpected-error',
      });
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
          apiBaseUrl: auth.apiBaseUrl,
          capabilities: auth.capabilities,
        },
      );

      if (!result.ok) {
        publishError(result.error.message, { dedupeKey: `admin-changelog:archive:${changelogId}:error` });
        return;
      }

      publishSuccess('Voce changelog archiviata.', { dedupeKey: `admin-changelog:archive:${changelogId}:success` });
      changelogQuery.reload();
    } catch {
      publishError('Impossibile archiviare la voce changelog.', {
        dedupeKey: `admin-changelog:archive:${changelogId}:unexpected-error`,
      });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <AdminPageContainer
      title={appCopy.editorial.admin.changelogTitle}
      description="Data Table View canonica per ProductChangelog pubblicati e archivio amministrativo."
    >

      <div className={cx(uiPrimitives.clusterRow, 'ui-admin-users-toolbar')}>
        <p className={uiPrimitives.metaLine}>Pubblica aggiornamenti di prodotto visibili agli utenti autenticati.</p>
        <div className={uiPrimitives.actions}>
          <Link to="/admin/user-reports" className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}>
            Inbox segnalazioni
          </Link>
          <button
            type="button"
            className={uiPrimitives.button}
            onClick={() => setShowArchived(!showArchived)}
            disabled={changelogQuery.loading}
          >
            {showArchived ? 'Nascondi archiviate' : 'Mostra archiviate'}
          </button>
          <button
            type="button"
            className={uiPrimitives.button}
            onClick={() => changelogQuery.reload()}
            disabled={changelogQuery.loading || isPublishing || busyAction !== null}
          >
            Aggiorna tabella
          </button>
        </div>
      </div>

      <form className="ui-admin-user-form" onSubmit={(event) => {
        event.preventDefault();
        void handlePublish();
      }}>
        <div className="ui-admin-user-form-headline">
          <h3>Nuova voce changelog</h3>
          <p className={uiPrimitives.metaLine}>Componi titolo e contenuto, quindi pubblica.</p>
        </div>

        <TextField
          label="Titolo"
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
          fullWidth
          required
          disabled={!isAdmin || isPublishing}
        />

        <TextField
          label="Contenuto"
          value={draftBody}
          onChange={(event) => setDraftBody(event.target.value)}
          fullWidth
          required
          multiline
          minRows={5}
          disabled={!isAdmin || isPublishing}
        />

        <div className={uiPrimitives.actions}>
          <button
            type="submit"
            className={uiPrimitives.button}
            disabled={!isAdmin || isPublishing}
          >
            {isPublishing ? 'Pubblicazione...' : 'Pubblica changelog'}
          </button>
        </div>
      </form>

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
