import { useMemo } from 'react';
import { appCopy } from '../../../app/copy/system';
import { EmptyStateMessage, Surface, TopBar, uiPrimitives } from '../../../app/ui/primitives';
import { useGenerationWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';

export const AdminActivityPage = () => {
  const generation = useGenerationWorkspace();

  const feed = useMemo(() => {
    return [...generation.checkpoints]
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, 20);
  }, [generation.checkpoints]);

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <TopBar>
        <h2>{appCopy.editorial.admin.activityTitle}</h2>
        <p className={uiPrimitives.metaLine}>{appCopy.editorial.admin.activityBody}</p>
      </TopBar>

      {feed.length === 0
        ? <EmptyStateMessage>Nessuna attività recente.</EmptyStateMessage>
        : (
          <div className={uiPrimitives.artifactTableWrap}>
            <table className={uiPrimitives.artifactTable}>
              <thead>
                <tr>
                  <th scope="col">Project</th>
                  <th scope="col">Artifact</th>
                  <th scope="col">Status</th>
                  <th scope="col">Aggiornato</th>
                </tr>
              </thead>
              <tbody>
                {feed.map((item) => (
                  <tr key={item.artifactId}>
                    <td><strong>{item.projectId}</strong></td>
                    <td><span className={uiPrimitives.metaLine}>{item.artifactId}</span></td>
                    <td><span className={uiPrimitives.metaLine}>{item.status}</span></td>
                    <td><span className={uiPrimitives.metaLine}>{new Date(item.updatedAt).toLocaleString()}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </Surface>
  );
};
