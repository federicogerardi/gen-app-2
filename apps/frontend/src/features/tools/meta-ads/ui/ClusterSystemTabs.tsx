/**
 * Cluster System Tabs for Meta Ads
 * Implements hierarchical navigation: cluster → angle → awareness
 */

import { useCallback, useMemo, useState } from 'react';
import { Button } from '@mui/material';
import { uiPrimitives } from '../../../../app/ui/primitives';
import { ArtifactContentPreview } from '../../../artifacts/ui/ArtifactContentPreview';
import {
  parseClusterSystemOutput,
  formatAwarenessLevel,
  type AwarenessLevel,
} from '../runtime/cluster-system-parser';
import {
  exportCluster,
  exportAngle,
  exportAwarenessLevel,
  downloadExport,
  type ExportFormat,
} from '../runtime/cluster-system-export';

type ClusterSystemTabsProps = {
  content: string;
};

const formatCopyLengthLabel = (format: string): string => {
  switch (format) {
    case 'short-form':
      return 'Short Form (400-600 caratteri)';
    case 'medium-form':
      return 'Medium Form (800-1000 caratteri)';
    case 'long-form':
      return 'Long Form (1200+ caratteri)';
    default:
      return format;
  }
};

export const ClusterSystemTabs = ({ content }: ClusterSystemTabsProps) => {
  const parsed = useMemo(() => parseClusterSystemOutput(content), [content]);
  const [selectedClusterIndex, setSelectedClusterIndex] = useState(0);
  const [selectedAngleIndex, setSelectedAngleIndex] = useState(0);
  const [selectedAwareness, setSelectedAwareness] = useState<AwarenessLevel>('problem-aware');

  const selectedCluster = useMemo(
    () => parsed.clusters[selectedClusterIndex] ?? null,
    [parsed.clusters, selectedClusterIndex],
  );

  const selectedAngle = useMemo(
    () => selectedCluster?.angles[selectedAngleIndex] ?? null,
    [selectedCluster, selectedAngleIndex],
  );

  const selectedVersion = useMemo(
    () => selectedAngle?.versions.find((v) => v.level === selectedAwareness) ?? null,
    [selectedAngle, selectedAwareness],
  );

  const handleClusterChange = useCallback((index: number) => {
    setSelectedClusterIndex(index);
    setSelectedAngleIndex(0);
    setSelectedAwareness('problem-aware');
  }, []);

  const handleAngleChange = useCallback((index: number) => {
    setSelectedAngleIndex(index);
    setSelectedAwareness('problem-aware');
  }, []);

  const handleAwarenessChange = useCallback((level: AwarenessLevel) => {
    setSelectedAwareness(level);
  }, []);

  const handleExport = useCallback((scope: 'cluster' | 'angle' | 'awareness', format: ExportFormat) => {
    let exportContent = '';
    let filename = 'meta-ads-export';

    switch (scope) {
      case 'cluster':
        exportContent = exportCluster(parsed, selectedClusterIndex, format);
        filename = `cluster-${selectedCluster?.name ?? selectedClusterIndex}`;
        break;
      case 'angle':
        exportContent = exportAngle(parsed, selectedClusterIndex, selectedAngleIndex, format);
        filename = `angle-${selectedAngle?.name ?? selectedAngleIndex}`;
        break;
      case 'awareness':
        exportContent = exportAwarenessLevel(parsed, selectedClusterIndex, selectedAngleIndex, selectedAwareness, format);
        filename = `awareness-${selectedAwareness}`;
        break;
    }

    if (exportContent) {
      downloadExport(exportContent, filename, format);
    }
  }, [parsed, selectedClusterIndex, selectedAngleIndex, selectedAwareness, selectedCluster, selectedAngle]);

  if (parsed.clusters.length === 0) {
    return (
      <section className="ui-session-artifact-panel">
        <p className={uiPrimitives.metaLine}>Nessun cluster trovato nel contenuto.</p>
      </section>
    );
  }

  return (
    <section className="ui-session-artifact-panel">
      {/* Copy Length Format Indicator */}
      <div className="ui-copy-length-indicator">
        <p className={uiPrimitives.metaLine}>
          <strong>Formato copy:</strong> {formatCopyLengthLabel(parsed.copyLengthFormat)}
        </p>
      </div>

      {/* Cluster Navigation */}
      <div className="ui-cluster-navigation">
        <p className={uiPrimitives.metaLine}>Cluster:</p>
        <div className="ui-cluster-tabs" role="tablist" aria-label="Cluster selection">
          {parsed.clusters.map((cluster, index) => (
            <Button
              key={cluster.name}
              type="button"
              role="tab"
              aria-selected={index === selectedClusterIndex}
              className={`ui-cluster-tab${index === selectedClusterIndex ? ' is-active' : ''}`}
              onClick={() => handleClusterChange(index)}
              variant="text"
            >
              {cluster.name}
            </Button>
          ))}
        </div>
        <Button
          type="button"
          className="ui-export-button"
          onClick={() => handleExport('cluster', 'markdown')}
          variant="outlined"
          size="small"
        >
          Esporta Cluster
        </Button>
      </div>

      {/* Angle Navigation */}
      {selectedCluster && (
        <div className="ui-angle-navigation">
          <p className={uiPrimitives.metaLine}>Angolo:</p>
          <div className="ui-angle-tabs" role="tablist" aria-label="Angle selection">
            {selectedCluster.angles.map((angle, index) => (
              <Button
                key={angle.name}
                type="button"
                role="tab"
                aria-selected={index === selectedAngleIndex}
                className={`ui-angle-tab${index === selectedAngleIndex ? ' is-active' : ''}`}
                onClick={() => handleAngleChange(index)}
                variant="text"
              >
                {angle.name}
              </Button>
            ))}
          </div>
          <Button
            type="button"
            className="ui-export-button"
            onClick={() => handleExport('angle', 'markdown')}
            variant="outlined"
            size="small"
          >
            Esporta Angolo
          </Button>
        </div>
      )}

      {/* Awareness Navigation */}
      {selectedAngle && (
        <div className="ui-awareness-navigation">
          <p className={uiPrimitives.metaLine}>Livello consapevolezza:</p>
          <div className="ui-awareness-tabs" role="tablist" aria-label="Awareness level selection">
            {(['problem-aware', 'solution-aware', 'product-aware'] as AwarenessLevel[]).map((level) => {
              const hasVersion = selectedAngle.versions.some((v) => v.level === level);
              return (
                <Button
                  key={level}
                  type="button"
                  role="tab"
                  aria-selected={level === selectedAwareness}
                  className={`ui-awareness-tab${level === selectedAwareness ? ' is-active' : ''}`}
                  onClick={() => handleAwarenessChange(level)}
                  variant="text"
                  disabled={!hasVersion}
                >
                  {formatAwarenessLevel(level)}
                </Button>
              );
            })}
          </div>
          <Button
            type="button"
            className="ui-export-button"
            onClick={() => handleExport('awareness', 'markdown')}
            variant="outlined"
            size="small"
          >
            Esporta Awareness
          </Button>
        </div>
      )}

      {/* Content Preview */}
      {selectedVersion && (
        <div className="ui-cluster-content">
          <div className="ui-cluster-content-header">
            <p className={uiPrimitives.metaLine}>
              <strong>Headline:</strong> {selectedVersion.headline}
            </p>
            <p className={uiPrimitives.metaLine}>
              <strong>Description:</strong> {selectedVersion.description}
            </p>
          </div>
          <ArtifactContentPreview
            content={selectedVersion.primaryText}
            toolbarLabel="Modalita visualizzazione contenuto cluster"
            panelLabel="Selected cluster content"
          />
        </div>
      )}
    </section>
  );
};
