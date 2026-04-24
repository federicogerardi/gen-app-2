import { useMemo, useState } from 'react';
import type { ArtifactType } from '../contracts/backend-stream';
import {
  filterArtifacts,
  type ArtifactFilters,
  type ArtifactLifecycleStatus,
  type ArtifactPeriodFilter,
  type GenerationArtifact,
} from './artifact-history';

type ArtifactHistoryPanelProps = {
  artifacts: GenerationArtifact[];
  onOpenProject: (projectId: string) => void;
  onRelaunch: (artifact: GenerationArtifact, mode: 'primary' | 'secondary') => void;
  relaunchDisabled: boolean;
};

export const ArtifactHistoryPanel = ({
  artifacts,
  onOpenProject,
  onRelaunch,
  relaunchDisabled,
}: ArtifactHistoryPanelProps) => {
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [filters, setFilters] = useState<ArtifactFilters>({
    type: 'all',
    status: 'all',
    projectId: 'all',
    period: 'all',
  });

  const projectOptions = useMemo(() => {
    return Array.from(new Set(artifacts.map((artifact) => artifact.projectId))).sort();
  }, [artifacts]);

  const filteredArtifacts = useMemo(() => {
    return filterArtifacts(artifacts, filters, new Date().toISOString());
  }, [artifacts, filters]);

  const selectedArtifact = filteredArtifacts.find((artifact) => artifact.artifactId === selectedArtifactId)
    ?? artifacts.find((artifact) => artifact.artifactId === selectedArtifactId)
    ?? null;

  const setTypeFilter = (value: string): void => {
    setFilters((prev) => ({ ...prev, type: value as ArtifactFilters['type'] }));
  };

  const setStatusFilter = (value: string): void => {
    setFilters((prev) => ({ ...prev, status: value as 'all' | ArtifactLifecycleStatus }));
  };

  const setProjectFilter = (value: string): void => {
    setFilters((prev) => ({ ...prev, projectId: value as 'all' | string }));
  };

  const setPeriodFilter = (value: string): void => {
    setFilters((prev) => ({ ...prev, period: value as ArtifactPeriodFilter }));
  };

  return (
    <section className="panel artifact-history-panel">
      <h2>Storico artefatti</h2>

      <div className="artifact-filters">
        <label>
          Tipo
          <select value={filters.type} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">all</option>
            <option value="content">content</option>
            <option value="seo">seo</option>
            <option value="code">code</option>
            <option value="extraction">extraction</option>
          </select>
        </label>

        <label>
          Stato
          <select value={filters.status} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">all</option>
            <option value="generating">generating</option>
            <option value="completed">completed</option>
            <option value="failed">failed</option>
          </select>
        </label>

        <label>
          Progetto
          <select value={filters.projectId} onChange={(event) => setProjectFilter(event.target.value)}>
            <option value="all">all</option>
            {projectOptions.map((projectId) => (
              <option key={projectId} value={projectId}>{projectId}</option>
            ))}
          </select>
        </label>

        <label>
          Periodo
          <select value={filters.period} onChange={(event) => setPeriodFilter(event.target.value)}>
            <option value="all">all</option>
            <option value="7d">7d</option>
            <option value="30d">30d</option>
            <option value="90d">90d</option>
          </select>
        </label>
      </div>

      <div className="artifact-grid">
        <div className="artifact-list" role="list">
          {filteredArtifacts.length === 0 ? (
            <p className="meta-line">Nessun artifact disponibile con i filtri correnti.</p>
          ) : null}

          {filteredArtifacts.map((artifact) => (
            <button
              key={artifact.artifactId}
              type="button"
              className={`artifact-row ${selectedArtifactId === artifact.artifactId ? 'is-selected' : ''}`}
              onClick={() => setSelectedArtifactId(artifact.artifactId)}
            >
              <strong>{artifact.artifactType}</strong>
              <span>{artifact.status}</span>
              <span>{artifact.model}</span>
              <span>{new Date(artifact.updatedAt).toLocaleString()}</span>
            </button>
          ))}
        </div>

        <div className="artifact-detail">
          {!selectedArtifact ? (
            <p className="meta-line">Seleziona un artifact per vedere il dettaglio.</p>
          ) : (
            <>
              <h3>Dettaglio artifact</h3>
              <p className="meta-line">artifactId: {selectedArtifact.artifactId}</p>
              <p className="meta-line">projectId: {selectedArtifact.projectId}</p>
              <p className="meta-line">stato: {selectedArtifact.status}</p>
              <p className="meta-line">tipo: {selectedArtifact.artifactType}</p>
              <p className="meta-line">model: {selectedArtifact.model}</p>
              <p className="meta-line">updated: {new Date(selectedArtifact.updatedAt).toLocaleString()}</p>

              <pre className="artifact-content">{selectedArtifact.content || 'Contenuto non disponibile.'}</pre>

              <div className="actions">
                <button type="button" onClick={() => setSelectedArtifactId(null)}>
                  Torna allo storico
                </button>
                <button type="button" onClick={() => onOpenProject(selectedArtifact.projectId)}>
                  Apri progetto di contesto
                </button>
                <button
                  type="button"
                  onClick={() => onRelaunch(selectedArtifact, 'primary')}
                  disabled={relaunchDisabled}
                >
                  Relaunch primario
                </button>
                <button
                  type="button"
                  onClick={() => onRelaunch(selectedArtifact, 'secondary')}
                  disabled={relaunchDisabled}
                >
                  Relaunch secondario
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};
