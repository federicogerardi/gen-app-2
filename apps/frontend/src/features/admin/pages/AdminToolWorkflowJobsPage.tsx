import { Surface } from '../../../app/ui/primitives';
import { appCopy } from '../../../app/copy/system';
import { useApiConfig } from '../../../app/providers/AuthSessionProvider';
import { useAdminToolWorkflowJobsQuery } from '../runtime/useAdminToolWorkflowJobsQuery';
import { AdminToolWorkflowJobsToolbar } from '../ui/AdminToolWorkflowJobsToolbar';

const adminCopy = appCopy.ui.toolWorkflowJob.admin;

export const AdminToolWorkflowJobsPage = () => {
  const { apiBaseUrl, capabilities } = useApiConfig();
  const jobsQuery = useAdminToolWorkflowJobsQuery({ apiBaseUrl, capabilities });

  return (
    <Surface as="section">
      <AdminToolWorkflowJobsToolbar
        isLoading={jobsQuery.loading}
        onReload={jobsQuery.reload}
      />
      {jobsQuery.error && (
        <div role="alert">{jobsQuery.error}</div>
      )}
      {jobsQuery.loading && (
        <p>Loading...</p>
      )}
      {!jobsQuery.loading && jobsQuery.data.length === 0 && (
        <p>{adminCopy.emptyList}</p>
      )}
      {!jobsQuery.loading && jobsQuery.data.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>{adminCopy.tableJobId}</th>
              <th>{adminCopy.tableStatus}</th>
              <th>{adminCopy.tableTool}</th>
              <th>{adminCopy.tableProject}</th>
              <th>{adminCopy.tableUser}</th>
              <th>{adminCopy.tableCreated}</th>
            </tr>
          </thead>
          <tbody>
            {jobsQuery.data.map((job: { jobId: string; status: string; toolKey: string; projectId: string; userId: string; createdAt: string }) => (
              <tr key={job.jobId}>
                <td>{job.jobId.slice(0, 8)}</td>
                <td>{job.status}</td>
                <td>{job.toolKey}</td>
                <td>{job.projectId}</td>
                <td>{job.userId}</td>
                <td>{job.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Surface>
  );
};
