import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { MenuItem, TextField } from '@mui/material';
import { useMachine } from '@xstate/react';
import { appCopy } from '../../../app/copy/system';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { useFeedbackMessage } from '../../../app/providers/FeedbackMessageProvider';
import {
  Surface,
  TopBar,
  uiPrimitives,
} from '../../../app/ui/primitives';
import type {
  UserReportCategory,
} from '../contracts/feedback-center-contract';
import { feedbackCenterMachine } from '../machines/feedback-center.machine';
import {
  createProductChangelog,
  publishUserReportIssue,
  submitUserReport,
  updateUserReportStatus,
} from '../runtime/feedback-center-client';

const USER_REPORT_CATEGORY_OPTIONS: ReadonlyArray<{ value: UserReportCategory; label: string }> = [
  { value: 'issue', label: 'Issue' },
  { value: 'feature-request', label: 'Feature request' },
  { value: 'other', label: 'Other' },
];

export const UserReportSubmissionPage = () => {
  const auth = useAuthSession();
  const { publishSuccess } = useFeedbackMessage();

  const role = auth.session?.user.role ?? 'member';
  const [category, setCategory] = useState<UserReportCategory>('issue');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const hasNotifiedSubmitSuccessRef = useRef(false);

  const actors = useMemo(() => ({
    submitUserReport: (command: { category: UserReportCategory; title: string; description: string }) => {
      return submitUserReport(command, {
        apiBaseUrl: auth.apiBaseUrl,
        capabilities: auth.capabilities,
      });
    },
    publishProductChangelog: (command: { title: string; body: string; status?: 'draft' | 'published' }) => {
      return createProductChangelog(command, {
        apiBaseUrl: auth.apiBaseUrl,
        capabilities: auth.capabilities,
      });
    },
    updateUserReportStatus: (reportId: string, command: { status: 'triaged' | 'closed' }) => {
      return updateUserReportStatus(reportId, command, {
        apiBaseUrl: auth.apiBaseUrl,
        capabilities: auth.capabilities,
      });
    },
    publishUserReportIssue: (reportId: string, command: { owner: string; repo: string; title?: string; body?: string }) => {
      return publishUserReportIssue(reportId, command, {
        apiBaseUrl: auth.apiBaseUrl,
        capabilities: auth.capabilities,
      });
    },
  }), [auth.apiBaseUrl, auth.capabilities]);

  const [snapshot, send] = useMachine(feedbackCenterMachine, {
    input: {
      role,
      actors,
    },
  });

  useEffect(() => {
    send({ type: 'CONTEXT_READY', role });
  }, [role, send]);

  const isSubmitSuccess = snapshot.matches({ ready: 'reportSubmitSuccess' });
  const isSubmitFailure = snapshot.matches({ ready: 'reportSubmitFailure' });
  const isSubmitting = snapshot.matches({ ready: 'reportSubmitting' });

  useEffect(() => {
    if (isSubmitSuccess && !hasNotifiedSubmitSuccessRef.current) {
      publishSuccess('Report submitted successfully.', {
        dedupeKey: 'feedback-center:user-report:submit:success',
      });
      hasNotifiedSubmitSuccessRef.current = true;
      return;
    }

    if (!isSubmitSuccess) {
      hasNotifiedSubmitSuccessRef.current = false;
    }
  }, [isSubmitSuccess, publishSuccess]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    send({
      type: 'REPORT_DRAFT_CHANGED',
      category,
      title,
      description,
    });

    send({ type: 'REPORT_SUBMIT_REQUESTED' });
  };

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <TopBar>
        <h2>{appCopy.editorial.feedback.userReportTitle}</h2>
        <p className={uiPrimitives.metaLine}>Tool Workspace Page canonica per invio UserReport.</p>
      </TopBar>

      <div className="ui-tool-layout-grid">
        <section className="ui-tool-column ui-tool-column-inputs">
          <header>
            <h3>Setup Panel</h3>
            <p className={uiPrimitives.metaLine}>Definisci categoria, titolo e descrizione della segnalazione.</p>
          </header>

          <form className="ui-tool-form" onSubmit={handleSubmit}>
            <TextField
              select
              label="Categoria"
              value={category}
              onChange={(event) => setCategory(event.target.value as UserReportCategory)}
              fullWidth
              disabled={isSubmitting}
            >
              {USER_REPORT_CATEGORY_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </TextField>

            <TextField
              label="Titolo"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              fullWidth
              required
              disabled={isSubmitting}
            />

            <TextField
              label="Descrizione"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              fullWidth
              required
              multiline
              minRows={5}
              disabled={isSubmitting}
            />

            <div className={uiPrimitives.actions}>
              <button type="submit" className={uiPrimitives.button} disabled={isSubmitting}>
                {isSubmitting ? 'Invio in corso...' : 'Invia report'}
              </button>
            </div>

            {isSubmitFailure && snapshot.context.lastError ? (
              <p className={uiPrimitives.error} role="alert">
                {snapshot.context.lastError}
              </p>
            ) : null}
          </form>
        </section>

        <section className="ui-tool-column ui-tool-column-status">
          <Surface className={uiPrimitives.stack}>
            <h3>Workflow Panel</h3>
            <p className={uiPrimitives.metaLine}>Stato macchina: {String(snapshot.value)}</p>
            <p className={uiPrimitives.metaLine}>Feedback channel primario: {isSubmitFailure ? 'inline-action' : 'global'}</p>

            {isSubmitting ? (
              <p className={uiPrimitives.metaLine}>Invio report in corso.</p>
            ) : null}

            {isSubmitSuccess ? (
              <>
                <p className={uiPrimitives.metaLine}>Report submitted successfully.</p>
                <div className={uiPrimitives.actions}>
                  <button
                    type="button"
                    className={uiPrimitives.button}
                    onClick={() => {
                      setTitle('');
                      setDescription('');
                      setCategory('issue');
                      send({ type: 'ACK_SUCCESS' });
                    }}
                  >
                    Back to form
                  </button>
                </div>
              </>
            ) : null}

            {isSubmitFailure ? (
              <div className={uiPrimitives.actions}>
                <button
                  type="button"
                  className={uiPrimitives.button}
                  onClick={() => send({ type: 'RESET_TO_IDLE' })}
                >
                  Try again
                </button>
              </div>
            ) : null}
          </Surface>
        </section>
      </div>
    </Surface>
  );
};
