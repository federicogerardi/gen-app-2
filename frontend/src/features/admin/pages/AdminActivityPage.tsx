import { useMemo } from 'react';
import { appCopy, formatMeta } from '../../../app/copy/system';
import { Surface, uiPrimitives } from '../../../app/ui/primitives';
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
      <h2>{appCopy.editorial.admin.activityTitle}</h2>
      <p className={uiPrimitives.metaLine}>{appCopy.editorial.admin.activityBody}</p>

      <ul className={uiPrimitives.listClean}>
        {feed.map((item) => (
          <Surface as="li" key={item.artifactId}>
            <p><strong>{item.projectId}</strong></p>
            <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.artifact, item.artifactId)}</p>
            <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.status, item.status)}</p>
            <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.updated, new Date(item.updatedAt).toLocaleString())}</p>
          </Surface>
        ))}
      </ul>
    </Surface>
  );
};
