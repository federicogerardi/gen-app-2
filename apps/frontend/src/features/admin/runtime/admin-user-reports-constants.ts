import type { UserReportCategory, UserReportStatus } from '../../feedback-center/contracts/feedback-center-contract';

export const USER_REPORT_STATUS_FILTER_OPTIONS: ReadonlyArray<{ value: UserReportStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Tutti gli stati' },
  { value: 'submitted', label: 'submitted' },
  { value: 'triaged', label: 'triaged' },
  { value: 'github-published', label: 'github-published' },
  { value: 'closed', label: 'closed' },
];

export const USER_REPORT_CATEGORY_FILTER_OPTIONS: ReadonlyArray<{ value: UserReportCategory | 'all'; label: string }> = [
  { value: 'all', label: 'Tutte le categorie' },
  { value: 'issue', label: 'issue' },
  { value: 'feature-request', label: 'feature-request' },
  { value: 'other', label: 'other' },
];