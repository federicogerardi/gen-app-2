import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, IconButton } from '@mui/material';
import { uiPrimitives } from '../../../app/ui/primitives';
import { ArtifactContentPreview } from '../../artifacts/ui/ArtifactContentPreview';
import type { SupportedTool } from '../../tools/machines/tool-flow.machine';
import { isStepVisible } from '../../tools/runtime/tool-step-display-config';
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
  return value === 'funnel-pages'
    || value === 'nextland'
    || value === 'youtube-lf-script'
    || value === 'angle-generator'
    || value === 'meta-ads'
    || value === 'youtube-description'
    || value === 'geometric'
    || value === 'blog-article-generator';
};

const toDisplayStep = (entry: SessionArtifactEntry): string => {
  if (!entry.stepKey) {
    return 'unknown-step';
  }

  return entry.stepKey;
};

export const SessionArtifactTabs = ({ group, fallbackToolKey }: SessionArtifactTabsProps) => {
  const tabsScrollerRef = useRef<HTMLDivElement | null>(null);
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

  const visibleArtifacts = useMemo(() => {
    if (!effectiveToolKey) {
      return sortedArtifacts;
    }

    return sortedArtifacts.filter(
      (artifact) => artifact.stepKey != null && isStepVisible(artifact.stepKey, effectiveToolKey),
    );
  }, [sortedArtifacts, effectiveToolKey]);

  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(
    visibleArtifacts[0]?.artifactId ?? null,
  );
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollControls = useCallback(() => {
    const scroller = tabsScrollerRef.current;
    if (!scroller) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    setCanScrollLeft(scroller.scrollLeft > 0);
    setCanScrollRight(scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1);
  }, []);

  const selected = useMemo(
    () => visibleArtifacts.find((artifact) => artifact.artifactId === selectedArtifactId)
      ?? visibleArtifacts[0]
      ?? null,
    [selectedArtifactId, visibleArtifacts],
  );

  useEffect(() => {
    updateScrollControls();
  }, [visibleArtifacts.length, updateScrollControls]);

  useEffect(() => {
    const scroller = tabsScrollerRef.current;
    if (!scroller) {
      return;
    }

    const handleResize = () => {
      updateScrollControls();
    };

    scroller.addEventListener('scroll', updateScrollControls, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      scroller.removeEventListener('scroll', updateScrollControls);
      window.removeEventListener('resize', handleResize);
    };
  }, [updateScrollControls]);

  if (visibleArtifacts.length === 0) {
    return (
      <section className="ui-session-artifact-panel">
        <p className={uiPrimitives.metaLine}>Session: {group.sessionId}</p>
        <p className={uiPrimitives.metaLine}>
          {sortedArtifacts.length > 0
            ? 'All steps are hidden by configuration.'
            : 'No step artifacts found for this session.'}
        </p>
      </section>
    );
  }

  if (!selected) {
    return null;
  }

  return (
    <section className="ui-session-artifact-panel">
      <div className="ui-session-step-tabs-shell">
        <IconButton
          className="ui-session-step-control ui-session-step-scroll"
          aria-label="Scroll session steps left"
          onClick={() => {
            tabsScrollerRef.current?.scrollBy({ left: -220, behavior: 'smooth' });
          }}
          disabled={!canScrollLeft}
          size="small"
        >
          &lt;
        </IconButton>

        <div ref={tabsScrollerRef} className="ui-session-step-tabs" role="tablist" aria-label="Session steps">
          {visibleArtifacts.map((artifact) => {
            const isActive = artifact.artifactId === selected.artifactId;
            return (
              <Button
                key={artifact.artifactId}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`ui-session-step-control ui-session-step-tab${isActive ? ' is-active' : ''}`}
                onClick={() => setSelectedArtifactId(artifact.artifactId)}
                variant="text"
              >
                {toDisplayStep(artifact)}
              </Button>
            );
          })}
        </div>

        <IconButton
          className="ui-session-step-control ui-session-step-scroll"
          aria-label="Scroll session steps right"
          onClick={() => {
            tabsScrollerRef.current?.scrollBy({ left: 220, behavior: 'smooth' });
          }}
          disabled={!canScrollRight}
          size="small"
        >
          &gt;
        </IconButton>
      </div>

      {selected.model && (
        <div style={{ padding: '8px 16px', borderBottom: '1px solid #eee' }}>
          <span style={{ fontSize: '0.75rem', color: '#666' }}>
            Modello: {selected.model}
            {selected.modelSource === 'step-override' && (
              <span
                style={{
                  marginLeft: '4px',
                  padding: '0 4px',
                  fontSize: '0.65rem',
                  backgroundColor: '#e3f2fd',
                  color: '#1976d2',
                  borderRadius: '2px',
                  verticalAlign: 'middle',
                }}
              >
                Override
              </span>
            )}
          </span>
          {selected.overrideReason && (
            <span style={{ display: 'block', fontSize: '0.7rem', color: '#888' }}>
              Motivo: {selected.overrideReason}
            </span>
          )}
        </div>
      )}

      <ArtifactContentPreview
        content={selected.content}
        toolbarLabel="Modalita visualizzazione contenuto artifact di sessione"
        panelLabel="Selected session artifact"
      />
    </section>
  );
};
