import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { uiPrimitives } from '../../../app/ui/primitives';
import type { SupportedTool, ToolStep } from '../../tools/machines/tool-flow.machine';
import {
  sortByCanonicalStepOrder,
  type SessionArtifactEntry,
  type SessionArtifactGroup,
} from '../machines/session-artifact-group';

type SessionArtifactTabsProps = {
  group: SessionArtifactGroup;
  fallbackToolKey: SupportedTool | null;
};

const isSupportedTool = (value: string | null | undefined): value is SupportedTool => {
  return value === 'funnel-pages' || value === 'nextland' || value === 'youtube-lf-script';
};

const toDisplayStep = (entry: SessionArtifactEntry): string => {
  if (!entry.stepKey) {
    return 'unknown-step';
  }

  return entry.stepKey;
};

const toRoleLabel = (role: SessionArtifactEntry['artifactRole']): string => {
  if (role === 'final') {
    return 'Final Output';
  }

  if (role === 'step') {
    return 'Intermediate Step';
  }

  return 'Unclassified';
};

export const SessionArtifactTabs = ({ group, fallbackToolKey }: SessionArtifactTabsProps) => {
  const effectiveToolKey = useMemo<SupportedTool | null>(() => {
    if (isSupportedTool(group.toolKey)) {
      return group.toolKey;
    }

    if (fallbackToolKey && isSupportedTool(fallbackToolKey)) {
      return fallbackToolKey;
    }

    return null;
  }, [group.toolKey, fallbackToolKey]);

  const sortedArtifacts = useMemo(() => {
    if (!effectiveToolKey) {
      return group.artifacts;
    }

    return sortByCanonicalStepOrder(group.artifacts, effectiveToolKey);
  }, [group.artifacts, effectiveToolKey]);

  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(
    sortedArtifacts[0]?.artifactId ?? null,
  );

  const selected = useMemo(
    () => sortedArtifacts.find((artifact) => artifact.artifactId === selectedArtifactId)
      ?? sortedArtifacts[0]
      ?? null,
    [selectedArtifactId, sortedArtifacts],
  );

  if (sortedArtifacts.length === 0) {
    return (
      <section className="ui-artifact-content-wrapper">
        <p className={uiPrimitives.metaLine}>Session: {group.sessionId}</p>
        <p className={uiPrimitives.metaLine}>No step artifacts found for this session.</p>
      </section>
    );
  }

  if (!selected) {
    return null;
  }

  return (
    <section className="ui-artifact-content-wrapper">
      <div className="ui-artifact-toolbar">
        <div className="ui-artifact-toolbar-tabs" role="tablist" aria-label="Session steps">
          {sortedArtifacts.map((artifact) => {
            const isActive = artifact.artifactId === selected.artifactId;
            return (
              <button
                key={artifact.artifactId}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`ui-view-tab${isActive ? ' is-active' : ''}`}
                onClick={() => setSelectedArtifactId(artifact.artifactId)}
              >
                {toDisplayStep(artifact)}
              </button>
            );
          })}
        </div>
      </div>

      <p className={uiPrimitives.metaLine}>Session: {group.sessionId}</p>
      <p className={uiPrimitives.metaLine}>Role: {toRoleLabel(selected.artifactRole)}</p>
      <p className={uiPrimitives.metaLine}>Status: {selected.status}</p>
      {selected.failureReason ? (
        <p className={uiPrimitives.error}>Failure reason: {selected.failureReason}</p>
      ) : null}

      <div className="ui-artifact-markdown" role="tabpanel" aria-label="Selected session artifact">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.content || ''}</ReactMarkdown>
      </div>
    </section>
  );
};
