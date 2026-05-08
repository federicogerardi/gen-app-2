import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { uiPrimitives } from '../../../app/ui/primitives';
import { ArtifactContentPreview } from '../../artifacts/ui/ArtifactContentPreview';
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

  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(
    sortedArtifacts[0]?.artifactId ?? null,
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
    () => sortedArtifacts.find((artifact) => artifact.artifactId === selectedArtifactId)
      ?? sortedArtifacts[0]
      ?? null,
    [selectedArtifactId, sortedArtifacts],
  );

  useEffect(() => {
    updateScrollControls();
  }, [sortedArtifacts.length, updateScrollControls]);

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

  if (sortedArtifacts.length === 0) {
    return (
      <section className="ui-session-artifact-panel">
        <p className={uiPrimitives.metaLine}>Session: {group.sessionId}</p>
        <p className={uiPrimitives.metaLine}>No step artifacts found for this session.</p>
      </section>
    );
  }

  if (!selected) {
    return null;
  }

  return (
    <section className="ui-session-artifact-panel">
      <div className="ui-session-step-tabs-shell">
        <button
          type="button"
          className="ui-session-step-control ui-session-step-scroll"
          aria-label="Scroll session steps left"
          onClick={() => {
            tabsScrollerRef.current?.scrollBy({ left: -220, behavior: 'smooth' });
          }}
          disabled={!canScrollLeft}
        >
          &lt;
        </button>

        <div ref={tabsScrollerRef} className="ui-session-step-tabs" role="tablist" aria-label="Session steps">
          {sortedArtifacts.map((artifact) => {
            const isActive = artifact.artifactId === selected.artifactId;
            return (
              <button
                key={artifact.artifactId}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`ui-session-step-control ui-session-step-tab${isActive ? ' is-active' : ''}`}
                onClick={() => setSelectedArtifactId(artifact.artifactId)}
              >
                {toDisplayStep(artifact)}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="ui-session-step-control ui-session-step-scroll"
          aria-label="Scroll session steps right"
          onClick={() => {
            tabsScrollerRef.current?.scrollBy({ left: 220, behavior: 'smooth' });
          }}
          disabled={!canScrollRight}
        >
          &gt;
        </button>
      </div>

      <ArtifactContentPreview
        content={selected.content}
        toolbarLabel="Modalita visualizzazione contenuto artifact di sessione"
        panelLabel="Selected session artifact"
      />
    </section>
  );
};
