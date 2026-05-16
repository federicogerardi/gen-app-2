import type {
  ProductChangelogStatus,
  UserReportCategory,
  UserReportStatus,
} from '../types/feedback-center';

type UserReportStatusInput = UserReportStatus | 'published_to_github';

const USER_REPORT_CATEGORIES: UserReportCategory[] = [
  'issue',
  'feature-request',
  'other',
];

const USER_REPORT_STATUSES: UserReportStatusInput[] = [
  'submitted',
  'triaged',
  'github-published',
  'published_to_github',
  'closed',
];

const PRODUCT_CHANGELOG_STATUSES: ProductChangelogStatus[] = [
  'draft',
  'published',
];

export const normalizeUserReportCategory = (value: string | undefined): UserReportCategory | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  const match = USER_REPORT_CATEGORIES.find((candidate) => candidate === normalized);
  return match ?? null;
};

export const normalizeUserReportStatus = (value: string | undefined): UserReportStatus | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  const match = USER_REPORT_STATUSES.find((candidate) => candidate === normalized);
  if (!match) {
    return null;
  }

  if (match === 'published_to_github') {
    return 'github-published';
  }

  return match;
};

export const normalizeProductChangelogStatus = (value: string | undefined): ProductChangelogStatus | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  const match = PRODUCT_CHANGELOG_STATUSES.find((candidate) => candidate === normalized);
  return match ?? null;
};

export const canPublishUserReportIssue = (
  category: UserReportCategory,
  status: UserReportStatus,
): boolean => {
  const issueEligibleCategory = category === 'issue' || category === 'feature-request';
  const issueEligibleStatus = status === 'submitted' || status === 'triaged';
  return issueEligibleCategory && issueEligibleStatus;
};
