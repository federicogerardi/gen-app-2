import { cx, uiPrimitives } from '../../../app/ui/primitives';
import type { UserReportDto, UserReportStatus } from '../../feedback-center/contracts/feedback-center-contract';
import { canPublishUserReportIssue } from '../runtime/admin-user-reports-policy';

type AdminUserReportsTableActionsProps = {
  row: UserReportDto;
  busyAction: string | null;
  publishedIssueUrl?: string | undefined;
  onStatusTransition: (reportId: string, status: Extract<UserReportStatus, 'triaged' | 'closed'>) => void;
  onPublishIssue: (reportId: string) => void;
};

export const AdminUserReportsTableActions = ({
  row,
  busyAction,
  publishedIssueUrl,
  onStatusTransition,
  onPublishIssue,
}: AdminUserReportsTableActionsProps) => {
  return (
    <div className={cx(uiPrimitives.clusterRow, 'ui-admin-user-table-actions')}>
      <button
        type="button"
        className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}
        onClick={() => onStatusTransition(row.id, 'triaged')}
        disabled={busyAction !== null || row.status !== 'submitted'}
      >
        Triage
      </button>

      <button
        type="button"
        className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}
        onClick={() => onStatusTransition(row.id, 'closed')}
        disabled={busyAction !== null || row.status === 'closed'}
      >
        Chiudi
      </button>

      {(row.githubIssueUrl ?? publishedIssueUrl) ? (
        <a
          href={(row.githubIssueUrl ?? publishedIssueUrl)!}
          target="_blank"
          rel="noopener noreferrer"
          className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}
        >
          Apri su GitHub
        </a>
      ) : (
        <button
          type="button"
          className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}
          onClick={() => onPublishIssue(row.id)}
          disabled={busyAction !== null || !canPublishUserReportIssue(row)}
        >
          Pubblica issue
        </button>
      )}
    </div>
  );
};