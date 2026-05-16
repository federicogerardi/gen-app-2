import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { TextField } from '@mui/material';
import { appCopy } from '../../../app/copy/system';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { useFeedbackMessage } from '../../../app/providers/FeedbackMessageProvider';
import { useAsyncQuery } from '../../../app/runtime/queries/useAsyncQuery';
import {
  cx,
  Surface,
  TopBar,
  uiPrimitives,
} from '../../../app/ui/primitives';
import { ListingTableSection, type ListingTableColumn } from '../../../app/ui/ListingTableSection';
import type { ProductChangelogDto } from '../../feedback-center/contracts/feedback-center-contract';
import {
  createProductChangelog,
  listPublishedProductChangelog,
} from '../../feedback-center/runtime/feedback-center-client';

const CHANGELOG_COLUMNS: ListingTableColumn[] = [
  { key: 'title', header: 'Titolo' },
  { key: 'status', header: 'Stato' },
  { key: 'publishedAt', header: 'Pubblicato il' },
  { key: 'updatedAt', header: 'Aggiornato il' },
];

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

export const AdminChangelogPage = () => {
  const auth = useAuthSession();
  const { publishSuccess, publishError } = useFeedbackMessage();

  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
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

  const changelogQuery = useAsyncQuery<ProductChangelogDto[]>({
    enabled: true,
    emptyData: [],
    errorMessage: 'Unable to load changelog',
    dependencyKey: JSON.stringify([auth.apiBaseUrl, auth.capabilities]),
    query: listPublishedChangelogQuery,
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

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <TopBar>
        <h2>{appCopy.editorial.admin.changelogTitle}</h2>
        <p className={uiPrimitives.metaLine}>Data Table View canonica per pubblicazioni ProductChangelog.</p>
      </TopBar>

      <div className={cx(uiPrimitives.clusterRow, 'ui-admin-users-toolbar')}>
        <p className={uiPrimitives.metaLine}>Pubblica aggiornamenti di prodotto visibili agli utenti autenticati.</p>
        <div className={uiPrimitives.actions}>
          <Link to="/admin/user-reports" className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}>
            Inbox segnalazioni
          </Link>
          <button
            type="button"
            className={uiPrimitives.button}
            onClick={() => changelogQuery.reload()}
            disabled={changelogQuery.loading || isPublishing}
          >
            Aggiorna tabella
          </button>
        </div>
      </div>

      <Surface as="form" className="ui-admin-user-form" onSubmit={(event) => {
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
      </Surface>

      <ListingTableSection<ProductChangelogDto>
        title="Voci pubblicate"
        loading={changelogQuery.loading}
        error={changelogQuery.error}
        isEmpty={!changelogQuery.loading && changelogQuery.data.length === 0}
        emptyMessage="Nessuna voce pubblicata al momento."
        columns={CHANGELOG_COLUMNS}
        rows={changelogQuery.data}
        rowKey={(row) => row.id}
        renderCell={(row, columnKey) => {
          if (columnKey === 'title') {
            return (
              <>
                <strong>{row.title}</strong>
                <p className={uiPrimitives.metaLine}>{row.id}</p>
              </>
            );
          }

          if (columnKey === 'status') {
            return row.status;
          }

          if (columnKey === 'publishedAt') {
            return formatDateTime(row.publishedAt);
          }

          return formatDateTime(row.updatedAt);
        }}
      />
    </Surface>
  );
};
