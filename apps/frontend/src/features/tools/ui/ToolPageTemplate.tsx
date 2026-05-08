/**
 * ToolPageTemplate: Pure presentation component for all tool pages.
 * All orchestration logic (XState, side-effects, generation dispatch) lives in useToolPage.
 */

import { useEffect, useRef } from 'react';
import { uiPrimitives } from '../../../app/ui/primitives';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import type { SupportedTool } from '../machines/tool-flow.machine';
import { mapToolStepToCardConfig } from '../runtime/tool-form-architecture';
import { useToolPage } from '../runtime/useToolPage';
import { useModelsQuery } from '../../../app/runtime/queries/useModelsQuery';
import { ToolGenerationFlowVertical } from './ToolGenerationFlowVertical';
import { ToolActionButtons } from './ToolActionButtons';

interface ToolPageTemplateProps {
  toolKey: SupportedTool;
  sourceArtifactId?: string | null;
  intent?: 'new' | 'regenerate' | 'resume';
  initialProjectId?: string | null;
  relaunchTone?: string | null;
  relaunchNotes?: string | null;
  relaunchFromArtifactId?: string | null;
  briefingId?: string | null;
  extractionArtifactId?: string | null;
  briefingFileName?: string | null;
}

export const ToolPageTemplate = (props: ToolPageTemplateProps) => {
  const auth = useAuthSession();
  const { data: modelOptions } = useModelsQuery({
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
  });

  const {
    toolConfig,
    formState,
    setFormState,
    projects,
    projectsLoading,
    briefingError,
    effectiveBriefingStatus,
    effectiveBriefingFileName,
    machineViewModel,
    isGenerating,
    readinessSnapshot,
    completedStepsForFlow,
    latestArtifactByStep,
    currentRunningStep,
    streamingStep,
    effectiveCanonicalState,
    currentProject,
    isStreamActive,
    handlePrimaryAction,
    handleCancelGeneration,
    handleBriefingFileSelected,
    handleBriefingReset,
    navigate,
  } = useToolPage(props);

  // Auto-select the catalog default model when the list first loads.
  // Only fires once (tracked by ref) and only if the current model matches
  // the static fallback set at form initialization.
  const defaultAppliedRef = useRef(false);
  useEffect(() => {
    if (defaultAppliedRef.current || modelOptions.length === 0) return;
    const catalogDefault = modelOptions.find((o) => o.isDefault);
    if (catalogDefault && formState.model !== catalogDefault.key) {
      setFormState((prev) => ({ ...prev, model: catalogDefault.key }));
    }
    defaultAppliedRef.current = true;
  // Run only when modelOptions first becomes non-empty.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelOptions]);

  return (
    <section className="ui-tool-page-template">
      <div className={uiPrimitives.stack}>
        <div className="ui-tool-layout-grid">
          <section className="ui-tool-column ui-tool-column-inputs">
            <header>
              <h2>{toolConfig.displayName}</h2>
              <p className={uiPrimitives.metaLine}>{toolConfig.displayName} configuration and generation</p>
            </header>

            <form className="ui-tool-form">
              <div className="ui-tool-form-row">
                <label>
                  <span>Project</span>
                  <select
                    value={formState.projectId}
                    onChange={(e) => setFormState({ ...formState, projectId: e.target.value })}
                    disabled={projectsLoading || isStreamActive}
                  >
                    <option value="">{projectsLoading ? 'Caricamento progetti...' : 'Seleziona un progetto'}</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Model</span>
                  <select
                    value={formState.model}
                    onChange={(e) => setFormState({ ...formState, model: e.target.value })}
                  >
                    {modelOptions.length === 0 ? (
                      <option value={formState.model}>{formState.model || 'No models available'}</option>
                    ) : (
                      modelOptions.map((o) => (
                        <option key={o.key} value={o.key}>{o.label}</option>
                      ))
                    )}
                  </select>
                </label>
              </div>

              <label>
                <span>Briefing File</span>
                <input
                  type="file"
                  accept=".docx,.txt,.md"
                  disabled={!formState.projectId.trim() || isStreamActive}
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0] ?? null;
                    if (selectedFile) {
                      handleBriefingFileSelected(selectedFile);
                    } else {
                      handleBriefingReset();
                    }
                  }}
                />
              </label>

              {briefingError ? <p className={uiPrimitives.error}>{briefingError}</p> : null}

              <p className={uiPrimitives.metaLine}>
                Briefing status: {effectiveBriefingStatus}
                {effectiveBriefingFileName ? ` - ${effectiveBriefingFileName}` : ''}
              </p>

              <ToolActionButtons
                primaryPolicy={machineViewModel.primaryActionPolicy}
                secondaryFlags={{
                  ...machineViewModel.secondaryActionFlags,
                  canCancelGeneration: isGenerating,
                }}
                onPrimaryAction={handlePrimaryAction}
                onCancelGeneration={handleCancelGeneration}
                isLoading={isGenerating}
              />
            </form>
          </section>

          <section className="ui-tool-column ui-tool-column-status">
            <ToolGenerationFlowVertical
              canonicalState={effectiveCanonicalState}
              projectName={currentProject?.name ?? null}
              briefingFileName={effectiveBriefingFileName ?? null}
              briefingStatus={effectiveBriefingStatus}
              readinessReasonCodes={readinessSnapshot.reasonCodes}
              briefingError={briefingError}
              steps={toolConfig.steps.map((step) => ({
                step,
                displayName: mapToolStepToCardConfig(props.toolKey, step).displayName,
                status:
                  isStreamActive && currentRunningStep === step
                    ? 'running'
                    : machineViewModel.stepStatuses[step] ?? 'idle',
                artifactId: latestArtifactByStep[step]?.artifactId ?? null,
                isStreaming: isStreamActive && streamingStep === step,
              }))}
              completedStepsCount={completedStepsForFlow.size}
              totalStepsCount={toolConfig.steps.length}
              errorMessage={machineViewModel.messages.error}
              onViewArtifact={(artifactId) => {
                void navigate(`/artifacts/${artifactId}`);
              }}
            />
          </section>
        </div>
      </div>
    </section>
  );
};
