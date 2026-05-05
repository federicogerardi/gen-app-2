import { useMemo, useState } from 'react';
import { appCopy, formatMeta } from '../../../app/copy/system';
import { Button, Surface, cx, uiPrimitives } from '../../../app/ui/primitives';
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
  onRelaunchFromArtifact: (artifact: GenerationArtifact) => void;
  relaunchDisabled: boolean;
};

export const ArtifactHistoryPanel = ({
  artifacts,
  onOpenProject,
  onRelaunchFromArtifact,
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
    <Surface as="section" className={uiPrimitives.artifactHistoryPanel}>
      <h2>{appCopy.editorial.generation.historyTitle}</h2>

      <div className={uiPrimitives.artifactFilters}>
        <label>
          {appCopy.ui.labels.type}
          <select value={filters.type} onChange={(event) => setTypeFilter(event.target.value)}>
            {appCopy.ui.options.artifactTypes.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label>
          {appCopy.ui.labels.status}
          <select value={filters.status} onChange={(event) => setStatusFilter(event.target.value)}>
            {appCopy.ui.options.artifactStatuses.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label>
          {appCopy.ui.labels.project}
          <select value={filters.projectId} onChange={(event) => setProjectFilter(event.target.value)}>
            <option value="all">all</option>
            {projectOptions.map((projectId) => (
              <option key={projectId} value={projectId}>{projectId}</option>
            ))}
          </select>
        </label>

        <label>
          {appCopy.ui.labels.period}
          <select value={filters.period} onChange={(event) => setPeriodFilter(event.target.value)}>
            {appCopy.ui.options.artifactPeriods.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className={uiPrimitives.artifactGrid}>
        <div className={uiPrimitives.artifactList} role="list">
          {filteredArtifacts.length === 0 ? (
            <p className={uiPrimitives.metaLine}>{appCopy.ui.states.noArtifactsFiltered}</p>
          ) : null}

          {filteredArtifacts.map((artifact) => (
            <button
              key={artifact.artifactId}
              type="button"
              className={cx(
                uiPrimitives.artifactRow,
                selectedArtifactId === artifact.artifactId && uiPrimitives.artifactRowSelected,
              )}
              onClick={() => setSelectedArtifactId(artifact.artifactId)}
            >
              <strong>{artifact.artifactType}</strong>
              <span>{artifact.status}</span>
              <span>{artifact.model}</span>
              <span>{new Date(artifact.updatedAt).toLocaleString()}</span>
            </button>
          ))}
        </div>

        <div className={uiPrimitives.artifactDetail}>
          {!selectedArtifact ? (
            <p className={uiPrimitives.metaLine}>Seleziona un artifact per vedere il dettaglio.</p>
          ) : (
            <>
              <h3>{appCopy.editorial.generation.artifactDetailTitle}</h3>
              <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.artifactId, selectedArtifact.artifactId)}</p>
              <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.projectId, selectedArtifact.projectId)}</p>
              <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.labels.status.toLowerCase(), selectedArtifact.status)}</p>
              <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.labels.type.toLowerCase(), selectedArtifact.artifactType)}</p>
              <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.model, selectedArtifact.model)}</p>
              <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.updated, new Date(selectedArtifact.updatedAt).toLocaleString())}</p>

              <pre className={uiPrimitives.artifactContent}>{selectedArtifact.content || 'Contenuto non disponibile.'}</pre>

              <div className={uiPrimitives.actions}>
                <Button type="button" onClick={() => setSelectedArtifactId(null)}>
                  {appCopy.ui.actions.historyBack}
                </Button>
                <Button type="button" onClick={() => onOpenProject(selectedArtifact.projectId)}>
                  {appCopy.ui.actions.openContextProject}
                </Button>
                <Button
                  type="button"
                  onClick={() => onRelaunchFromArtifact(selectedArtifact)}
                  disabled={relaunchDisabled}
                >
                  {appCopy.ui.actions.relaunchPrimary}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Surface>
  );
};
