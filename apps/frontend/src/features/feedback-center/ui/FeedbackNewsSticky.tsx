import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { Bell, X, Send } from 'lucide-react';
import { appCopy } from '../../../app/copy/system';
import { useAuthState, useApiConfig } from '../../../app/providers/AuthSessionProvider';
import { useFeedbackMessage } from '../../../app/providers/FeedbackMessageProvider';
import { useSWRQuery } from '../../../app/runtime/queries/useSWRQuery';
import { cx, uiPrimitives, LoadingStateMessage } from '../../../app/ui/primitives';
import type {
  ProductChangelogDto,
  UserReportCategory,
} from '../contracts/feedback-center-contract';
import {
  listPublishedProductChangelog,
  submitUserReport,
} from '../runtime/feedback-center-client';

const MAX_CHANGELOG_ITEMS = 5;

const formatDate = (isoDate: string | null): string => {
  if (!isoDate) {
    return appCopy.ui.feedbackCenter.unavailableDate;
  }

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return appCopy.ui.feedbackCenter.unavailableDate;
  }

  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const FeedbackNewsSticky = () => {
  const { session } = useAuthState();
  const { apiBaseUrl, capabilities } = useApiConfig();
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
      apiBaseUrl,
      capabilities,
    });

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    return result.data;
  }, [apiBaseUrl, capabilities]);

  const changelogQuery = useSWRQuery<ProductChangelogDto[]>({
    key: session ? [apiBaseUrl, capabilities, 'feedback-news'] : null,
    fetcher: listPublishedChangelogQuery,
    emptyData: [],
    errorMessage: 'Impossibile caricare il changelog pubblicato.',
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
      setFormError(appCopy.ui.feedbackCenter.formValidationError);
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
        apiBaseUrl,
        capabilities,
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
      {isPanelOpen ? (
        <section id="news-sticky-panel" className="ui-news-sticky__panel" aria-live="polite">
          <header className="ui-news-sticky__header">
            <div className="ui-news-sticky__header-content">
              {isFormOpen ? (
                <>
                  <h3>{appCopy.ui.feedbackCenter.formHeading}</h3>
                  <p className={uiPrimitives.metaLine}>{appCopy.ui.feedbackCenter.formSubheading}</p>
                </>
              ) : (
                <>
                  <h3>{appCopy.ui.feedbackCenter.newsHeading}</h3>
                  <p className={uiPrimitives.metaLine}>{appCopy.ui.feedbackCenter.newsSubheading}</p>
                </>
              )}
            </div>
            {isFormOpen && (
              <button
                type="button"
                className="ui-news-sticky__close-form"
                onClick={() => {
                  setIsFormOpen(false);
                  resetForm();
                }}
                aria-label={appCopy.ui.feedbackCenter.closeFormAriaLabel}
                title={appCopy.ui.feedbackCenter.closeFormTitle}
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            )}
          </header>

          {changelogQuery.loading ? <LoadingStateMessage>{appCopy.ui.feedbackCenter.loadingChangelog}</LoadingStateMessage> : null}
          {!changelogQuery.loading && changelogQuery.error ? (
            <p className={uiPrimitives.error} role="alert">{changelogQuery.error}</p>
          ) : null}

          {!isFormOpen && !changelogQuery.loading && !changelogQuery.error ? (
            <ul className="ui-news-sticky__list">
              {visibleChangelog.length === 0 ? (
                <li>
                  <p className={uiPrimitives.metaLine}>{appCopy.ui.feedbackCenter.noNewsAvailable}</p>
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

          {!isFormOpen && (
            <div className={uiPrimitives.actions}>
              <button
                type="button"
                className={cx(uiPrimitives.button, 'ui-news-sticky__form-toggle')}
                onClick={() => {
                  setIsFormOpen((prev) => !prev);
                  setFormError(null);
                }}
              >
                <Send size={18} strokeWidth={1.5} />
                <span>{appCopy.ui.feedbackCenter.submitButtonText}</span>
              </button>
            </div>
          )}

          {isFormOpen ? (
            <form className="ui-news-sticky__form" onSubmit={(event) => void handleSubmitReport(event)}>
              <label>
                {appCopy.ui.feedbackCenter.formCategoryLabel}
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as UserReportCategory)}
                  disabled={isSubmitting}
                >
                  {appCopy.ui.feedbackCenterOptions.categories.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label>
                {appCopy.ui.feedbackCenter.formTitleLabel}
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </label>

              <label>
                {appCopy.ui.feedbackCenter.formDescriptionLabel}
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
                <button type="submit" className={cx(uiPrimitives.button, 'ui-news-sticky__form-submit')} disabled={isSubmitting}>
                  <Send size={16} strokeWidth={1.5} />
                  <span>{isSubmitting ? appCopy.ui.feedbackCenter.submitButtonLoading : appCopy.ui.feedbackCenter.submitButtonSubmit}</span>
                </button>
              </div>
            </form>
          ) : null}
        </section>
      ) : null}

      <button
        type="button"
        className="ui-news-sticky__launcher"
        onClick={() => setIsPanelOpen((prev) => !prev)}
        aria-expanded={isPanelOpen}
        aria-controls="news-sticky-panel"
        aria-label={isPanelOpen ? appCopy.ui.feedbackCenter.closeNewsAriaLabel : appCopy.ui.feedbackCenter.openNewsAriaLabel}
        title={isPanelOpen ? appCopy.ui.feedbackCenter.closeNewsAriaLabel : appCopy.ui.feedbackCenter.openNewsAriaLabel}
      >
        <Bell size={20} strokeWidth={1.5} />
      </button>
    </aside>
  );
};
