import { useMemo } from 'react';
import { useGenerationWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';

export const AdminActivityPage = () => {
  const generation = useGenerationWorkspace();

  const feed = useMemo(() => {
    return [...generation.checkpoints]
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, 20);
  }, [generation.checkpoints]);

  return (
    <section className="panel page-stack">
      <h2>Admin activity</h2>
      <p className="meta-line">Feed locale derivato da checkpoint/artifacts (fallback).</p>

      <ul className="list-clean">
        {feed.map((item) => (
          <li key={item.artifactId} className="panel">
            <p><strong>{item.projectId}</strong></p>
            <p className="meta-line">artifact: {item.artifactId}</p>
            <p className="meta-line">status: {item.status}</p>
            <p className="meta-line">updated: {new Date(item.updatedAt).toLocaleString()}</p>
          </li>
        ))}
      </ul>
    </section>
  );
};
