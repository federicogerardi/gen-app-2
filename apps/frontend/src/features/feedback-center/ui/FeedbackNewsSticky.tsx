import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { appCopy } from '../../../app/copy/system';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { useFeedbackMessage } from '../../../app/providers/FeedbackMessageProvider';
import { useAsyncQuery } from '../../../app/runtime/queries/useAsyncQuery';
import { cx, uiPrimitives } from '../../../app/ui/primitives';
import type {
  ProductChangelogDto,
  UserReportCategory,
} from '../contracts/feedback-center-contract';
import {
  listPublishedProductChangelog,
  submitUserReport,
} from '../runtime/feedback-center-client';

const CATEGORY_OPTIONS: ReadonlyArray<{ value: UserReportCategory; label: string }> = [
  { value: 'issue', label: 'Bug' },
  { value: 'feature-request', label: 'Feature request' },
  { value: 'other', label: 'Other' },
];

const MAX_CHANGELOG_ITEMS = 5;

const formatDate = (isoDate: string | null): string => {
  if (!isoDate) {
    return 'Data non disponibile';
  }

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return 'Data non disponibile';
  }

  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const FeedbackNewsSticky = () => {
  const auth = useAuthSession();
  const { publishSuccess, publishError } = useFeedbackMessage();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [category, setCategory] = useState<UserReportCategory>('issue');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

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
    enabled: Boolean(auth.session),
    emptyData: [],
    errorMessage: 'Impossibile caricare il changelog pubblicato.',
    dependencyKey: `feedback-news:${auth.apiBaseUrl}`,
    query: listPublishedChangelogQuery,
  });

  const visibleChangelog = useMemo(
    () => changelogQuery.data.slice(0, MAX_CHANGELOG_ITEMS),
    [changelogQuery.data],
  );

  const resetForm = () => {
    setCategory('issue');
    setTitle('');
    setDescription('');
    setFormError(null);
  };

  const handleSubmitReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!title.trim() || !description.trim()) {
      setFormError('Titolo e descrizione sono obbligatori.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const result = await submitUserReport(
      {
        category,
        title: title.trim(),
        description: description.trim(),
      },
      {
        apiBaseUrl: auth.apiBaseUrl,
        capabilities: auth.capabilities,
      },
    );

    if (!result.ok) {
      const errorMessage = result.error.message || appCopy.ui.feedback.userReportSubmitFailed;
      setFormError(errorMessage);
      publishError(errorMessage, { dedupeKey: 'news-sticky:user-report:error' });
      setIsSubmitting(false);
      return;
    }

    publishSuccess(appCopy.ui.feedback.userReportSubmitted, {
      dedupeKey: 'news-sticky:user-report:success',
    });

    setIsSubmitting(false);
    setIsFormOpen(false);
    resetForm();
  };

  return (
    <aside className={cx('ui-news-sticky', isPanelOpen && 'is-open')} aria-label="News sticky panel">
      <button
        type="button"
        className={cx(uiPrimitives.button, 'ui-news-sticky__launcher')}
        onClick={() => setIsPanelOpen((prev) => !prev)}
        aria-expanded={isPanelOpen}
        aria-controls="news-sticky-panel"
      >
        {isPanelOpen ? 'Chiudi news' : 'News'}
      </button>

      {isPanelOpen ? (
        <section id="news-sticky-panel" className="ui-news-sticky__panel" aria-live="polite">
          <header className="ui-news-sticky__header">
            <h3>News</h3>
            <p className={uiPrimitives.metaLine}>Changelog pubblicato dagli admin.</p>
          </header>

          {changelogQuery.loading ? <p className={uiPrimitives.metaLine}>Caricamento changelog...</p> : null}
          {!changelogQuery.loading && changelogQuery.error ? (
            <p className={uiPrimitives.error} role="alert">{changelogQuery.error}</p>
          ) : null}

          {!changelogQuery.loading && !changelogQuery.error ? (
            <ul className="ui-news-sticky__list">
              {visibleChangelog.length === 0 ? (
                <li>
                  <p className={uiPrimitives.metaLine}>Nessuna news pubblicata al momento.</p>
                </li>
              ) : (
                visibleChangelog.map((entry) => (
                  <li key={entry.id} className="ui-news-sticky__item">
                    <p className="ui-news-sticky__item-date">{formatDate(entry.publishedAt ?? entry.createdAt)}</p>
                    <h4>{entry.title}</h4>
                    <p>{entry.body}</p>
                  </li>
                ))
              )}
            </ul>
          ) : null}

          <div className={uiPrimitives.actions}>
            <button
              type="button"
              className={uiPrimitives.button}
              onClick={() => {
                setIsFormOpen((prev) => !prev);
                setFormError(null);
              }}
            >
              {isFormOpen ? 'Chiudi modulo' : 'Invia segnalazione'}
            </button>
          </div>

          {isFormOpen ? (
            <form className="ui-news-sticky__form" onSubmit={(event) => void handleSubmitReport(event)}>
              <label>
                Categoria
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as UserReportCategory)}
                  disabled={isSubmitting}
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label>
                Titolo
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </label>

              <label>
                Descrizione
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  disabled={isSubmitting}
                  required
                />
              </label>

              {formError ? <p className={uiPrimitives.error} role="alert">{formError}</p> : null}

              <div className={uiPrimitives.actions}>
                <button type="submit" className={uiPrimitives.button} disabled={isSubmitting}>
                  {isSubmitting ? 'Invio in corso...' : 'Invia'}
                </button>
                <button
                  type="button"
                  className={uiPrimitives.inlineLink}
                  onClick={() => {
                    setIsFormOpen(false);
                    resetForm();
                  }}
                  disabled={isSubmitting}
                >
                  Annulla
                </button>
              </div>
            </form>
          ) : null}
        </section>
      ) : null}
    </aside>
  );
};
