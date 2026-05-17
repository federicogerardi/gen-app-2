import { useState } from 'react';

import type { BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import type { UserReportStatus } from '../../feedback-center/contracts/feedback-center-contract';
import { publishUserReportIssue, updateUserReportStatus } from '../../feedback-center/runtime/feedback-center-client';
import { useAdminMutationFeedback } from './useAdminMutationFeedback';

export type AdminUserReportsBusyAction = string | null;

type UseAdminUserReportsMutationsOptions = {
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  reloadReports: () => void;
};

export const useAdminUserReportsMutations = ({
  apiBaseUrl,
  capabilities,
  reloadReports,
}: UseAdminUserReportsMutationsOptions) => {
  const { publishSuccess, publishError } = useAdminMutationFeedback();
  const [busyAction, setBusyAction] = useState<AdminUserReportsBusyAction>(null);

  const handleStatusTransition = async (
    reportId: string,
    status: Extract<UserReportStatus, 'triaged' | 'closed'>,
  ) => {
    setBusyAction(`${status}:${reportId}`);
    try {
      const result = await updateUserReportStatus(
        reportId,
        { status },
        {
          apiBaseUrl,
          capabilities,
        },
      );

      if (!result.ok) {
        publishError(result.error.message, `admin-user-reports:${status}:${reportId}:error`);
        return;
      }

      publishSuccess(`Report ${status} aggiornato.`, `admin-user-reports:${status}:${reportId}:success`);
      reloadReports();
    } catch {
      publishError('Aggiornamento stato report non riuscito.', `admin-user-reports:${status}:${reportId}:unexpected-error`);
    } finally {
      setBusyAction(null);
    }
  };

  const handlePublishIssue = async (reportId: string) => {
    setBusyAction(`publish-issue:${reportId}`);
    try {
      const result = await publishUserReportIssue(
        reportId,
        {
          owner: '',
          repo: '',
        },
        {
          apiBaseUrl,
          capabilities,
        },
      );

      if (!result.ok) {
        publishError(result.error.message, `admin-user-reports:publish-issue:${reportId}:error`);
        return;
      }

      publishSuccess('Issue GitHub pubblicata.', `admin-user-reports:publish-issue:${reportId}:success`);
      reloadReports();
    } catch {
      publishError('Pubblicazione issue non riuscita.', `admin-user-reports:publish-issue:${reportId}:unexpected-error`);
    } finally {
      setBusyAction(null);
    }
  };

  return {
    busyAction,
    handleStatusTransition,
    handlePublishIssue,
  };
};