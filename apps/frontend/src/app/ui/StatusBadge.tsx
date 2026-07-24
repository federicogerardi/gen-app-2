import type { JSX } from 'react';
import { appCopy } from '../copy/system';
import { cx, uiPrimitives } from './primitives';

type StatusBadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral';

const STATUS_VARIANT_MAP: Record<string, StatusBadgeVariant> = {
  // ArtifactLifecycleStatus / SessionSummary.status
  completed: 'success',
  failed: 'error',
  generating: 'info',
  // ToolWorkflowJobStatus (DDD-NEW)
  queued: 'neutral',
  running: 'info',
  cancelled: 'warning',
  // AuthUserStatus
  active: 'success',
  disabled: 'error',
  pending_password_reset: 'warning',
  // AdminLlmModelRow.status
  enabled: 'success',
  // ProductChangelogStatus
  draft: 'neutral',
  published: 'success',
  // UserReportStatus
  submitted: 'neutral',
  triaged: 'info',
  'github-published': 'success',
  closed: 'neutral',
};

type StatusBadgeProps = {
  status: string;
  label?: string;
  className?: string;
};

export const StatusBadge = ({ status, label, className }: StatusBadgeProps): JSX.Element => {
  const variant: StatusBadgeVariant = STATUS_VARIANT_MAP[status] ?? 'neutral';
  const resolvedLabel = label ?? (appCopy.ui.statusLabels as Record<string, string>)[status] ?? status;
  return (
    <span
      className={cx(uiPrimitives.statusBadge, `ui-status-badge--${variant}`, className)}
    >
      {resolvedLabel}
    </span>
  );
};
