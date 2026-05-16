export type ProductChangelogStatus = 'draft' | 'published';

export type UserReportCategory = 'issue' | 'feature-request' | 'other';

export type UserReportStatus = 'submitted' | 'triaged' | 'github-published' | 'closed';

export type ProductChangelog = {
  id: string;
  title: string;
  body: string;
  status: ProductChangelogStatus;
  createdByUserId: string;
  publishedByUserId: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductChangelogRow = {
  id: string;
  title: string;
  body: string;
  status: string;
  created_by_user_id: string;
  published_by_user_id: string | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type UserReport = {
  id: string;
  category: UserReportCategory;
  status: UserReportStatus;
  title: string;
  description: string;
  createdByUserId: string;
  triagedByUserId: string | null;
  triagedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UserReportRow = {
  id: string;
  category: string;
  status: string;
  title: string;
  description: string;
  created_by_user_id: string;
  triaged_by_user_id: string | null;
  triaged_at: Date | null;
  closed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type UserReportGithubLink = {
  userReportId: string;
  repository: string;
  issueNumber: number;
  issueUrl: string;
  publishedByUserId: string;
  publishedAt: Date;
};

export type UserReportGithubLinkRow = {
  user_report_id: string;
  repository: string;
  issue_number: number;
  issue_url: string;
  published_by_user_id: string;
  published_at: Date;
};

export const rowToProductChangelog = (row: ProductChangelogRow): ProductChangelog => ({
  id: row.id,
  title: row.title,
  body: row.body,
  status: row.status as ProductChangelogStatus,
  createdByUserId: row.created_by_user_id,
  publishedByUserId: row.published_by_user_id,
  publishedAt: row.published_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const rowToUserReport = (row: UserReportRow): UserReport => ({
  id: row.id,
  category: row.category as UserReportCategory,
  status: row.status as UserReportStatus,
  title: row.title,
  description: row.description,
  createdByUserId: row.created_by_user_id,
  triagedByUserId: row.triaged_by_user_id,
  triagedAt: row.triaged_at,
  closedAt: row.closed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const rowToUserReportGithubLink = (row: UserReportGithubLinkRow): UserReportGithubLink => ({
  userReportId: row.user_report_id,
  repository: row.repository,
  issueNumber: row.issue_number,
  issueUrl: row.issue_url,
  publishedByUserId: row.published_by_user_id,
  publishedAt: row.published_at,
});
