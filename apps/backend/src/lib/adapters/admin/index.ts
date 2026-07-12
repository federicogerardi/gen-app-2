// Organizational grouping for admin-feature backend persistence (DDD-164)
// NOT a bounded context — see BCM v3.3. Entities per DDD-065/067.

export {
  createProductChangelog,
  publishProductChangelog,
  archiveProductChangelog,
  listPublishedProductChangelogs,
  listProductChangelogs,
} from '../product-changelog.adapter';

export {
  createUserReport,
  getUserReportById,
  listUserReports,
  updateUserReportStatus,
} from '../user-report.adapter';

export {
  createUserReportGithubLink,
  publishUserReportIssueTransaction,
} from '../user-report-github-link.adapter';
