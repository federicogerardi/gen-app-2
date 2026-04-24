import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { useGenerationWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';
import { getProjectById, type ProjectSummary } from '../runtime/projects-client';

export const ProjectDetailPage = () => {
  const { id = '' } = useParams();
  const auth = useAuthSession();
  const generation = useGenerationWorkspace();
  const [project, setProject] = useState<ProjectSummary | null>(null);

  useEffect(() => {
    void (async () => {
      const next = await getProjectById(id, {
        apiBaseUrl: auth.apiBaseUrl,
        capabilities: auth.capabilities,
      });
      setProject(next);
    })();
  }, [auth.apiBaseUrl, auth.capabilities, id]);

  const projectArtifacts = useMemo(() => {
    return generation.artifacts.filter((artifact) => artifact.projectId === id);
  }, [generation.artifacts, id]);

  return (
    <section className="panel page-stack">
      <header className="top-bar">
        <h2>Project detail</h2>
        <Link to="/dashboard/projects" className="inline-link">Torna alla lista</Link>
      </header>

      {!project ? (
        <p className="meta-line">Progetto non trovato.</p>
      ) : (
        <>
          <h3>{project.name}</h3>
          <p>{project.description}</p>
          <p className="meta-line">Updated: {new Date(project.updatedAt).toLocaleString()}</p>
        </>
      )}

      <h3>Artifacts contestuali</h3>
      {projectArtifacts.length === 0 ? (
        <p className="meta-line">Nessun artifact collegato al progetto.</p>
      ) : (
        <ul className="list-clean">
          {projectArtifacts.map((artifact) => (
            <li key={artifact.artifactId} className="panel">
              <p><strong>{artifact.artifactType}</strong> | {artifact.status}</p>
              <p className="meta-line">model: {artifact.model}</p>
              <p className="meta-line">date: {new Date(artifact.updatedAt).toLocaleString()}</p>
              <Link to={`/artifacts/${artifact.artifactId}`} className="inline-link">Apri artifact</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
