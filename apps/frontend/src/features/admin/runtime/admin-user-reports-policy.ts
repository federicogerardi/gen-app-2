import type { UserReportDto } from '../../feedback-center/contracts/feedback-center-contract';

export const canPublishUserReportIssue = (report: UserReportDto): boolean => {
  const categoryEligibleForGithubPublish = report.category === 'issue' || report.category === 'feature-request';
  return categoryEligibleForGithubPublish && (report.status === 'submitted' || report.status === 'triaged');
};