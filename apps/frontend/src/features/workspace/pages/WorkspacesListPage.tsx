import { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { useProjectsQuery } from '../../../app/runtime/queries/useProjectsQuery';
import { useApiConfig } from '../../../app/providers/AuthSessionProvider';
import { LoadingStateMessage, ErrorStateMessage, EmptyStateMessage, Button, uiPrimitives } from '../../../app/ui/primitives';
import { WorkspaceHubCard } from '../ui/WorkspaceHubCard';
import { CreateWorkspaceDialog } from '../ui/CreateWorkspaceDialog';
import { appCopy } from '../../../app/copy/system';
import '../ui/dashboard/dashboard-panels.css';

/** Data Table View (card-variant) — Workspace Hub listing page.
 *
 *  Archetype: Data Table View (card-variant per Section 3.2 of the UI Ubiquitous Language Spec).
 *  Workspace entities carry heterogeneous, nested metadata (foundation status for 2 tools,
 *  asset counts across 13 types, quality scores, activity summaries) — not tabular data.
 *  Card layout preserves semantic grouping without nested cards.
 */
export const WorkspacesListPage: React.FC = () => {
  const { apiBaseUrl, capabilities } = useApiConfig();
  const { data: projects, loading, error, reload } = useProjectsQuery({ apiBaseUrl, capabilities });
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleStatusChange = useCallback(() => {
    reload();
  }, [reload]);

  const handleCreated = useCallback(() => {
    reload();
  }, [reload]);

  // ── Page states ──

  if (loading) {
    return (
      <section className="workspace-hub">
        <LoadingStateMessage>{appCopy.ui.states.loadingProjects}</LoadingStateMessage>
      </section>
    );
  }

  if (error) {
    return (
      <section className="workspace-hub">
        <ErrorStateMessage>{error}</ErrorStateMessage>
        <Button onClick={reload}>{appCopy.ui.actions.retry}</Button>
      </section>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <section className="workspace-hub workspace-hub--empty">
        <EmptyStateMessage>{appCopy.ui.states.noProjectsAvailable}</EmptyStateMessage>
        <button
          type="button"
          className={uiPrimitives.button}
          onClick={() => setDialogOpen(true)}
        >
          {appCopy.ui.actions.createFirstProject}
        </button>
        <CreateWorkspaceDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onCreated={handleCreated}
          apiBaseUrl={apiBaseUrl}
          capabilities={capabilities}
        />
      </section>
    );
  }

  // ── Ready state ──

  return (
    <section className="workspace-hub">
      {/* Page header */}
      <div className="workspace-hub__header">
        <div className="workspace-hub__header-left">
          <h4 className="workspace-hub__title">
            {appCopy.ui.navigation.workspaces}
          </h4>
          <p className="workspace-hub__subtitle">
            {projects.length} {projects.length === 1 ? 'workspace' : 'workspaces'} available
          </p>
        </div>
        <button
          type="button"
          className={uiPrimitives.button}
          onClick={() => setDialogOpen(true)}
        >
          <Plus size={18} />
          {appCopy.ui.actions.createProject}
        </button>
      </div>

      {/* Card grid */}
      <div className="workspace-hub-grid">
        {projects.map(project => (
          <WorkspaceHubCard
            key={project.id}
            project={project}
            onStatusChange={handleStatusChange}
          />
        ))}
      </div>

      <CreateWorkspaceDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleCreated}
        apiBaseUrl={apiBaseUrl}
        capabilities={capabilities}
      />
    </section>
  );
};
