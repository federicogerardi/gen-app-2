export type ProductChangelogStatus = 'draft' | 'published';

export type UserReportCategory = 'issue' | 'feature-request' | 'other';

export type UserReportStatus = 'submitted' | 'triaged' | 'github-published' | 'closed';

export type ProductChangelogDto = {
  id: string;
  title: string;
  body: string;
  status: ProductChangelogStatus;
  createdBy: string;
  publishedBy: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserReportDto = {
  id: string;
  category: UserReportCategory;
  status: UserReportStatus;
  title: string;
  description: string;
  createdBy: string;
  triagedBy: string | null;
  triagedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  githubIssueUrl: string | null;
};

export type GitHubIssueLinkDto = {
  userReportId: string;
  repository: string;
  issueNumber: number;
  issueUrl: string;
  publishedBy: string;
  publishedAt: string;
};

export type CreateProductChangelogCommand = {
  title: string;
  body: string;
};

export type CreateUserReportCommand = {
  category: UserReportCategory;
  title: string;
  description: string;
};

export type UpdateUserReportStatusCommand = {
  status: Extract<UserReportStatus, 'triaged' | 'closed'>;
};

export type PublishUserReportIssueCommand = {
  owner: string;
  repo: string;
  title?: string;
  body?: string;
};
