/**
 * ToolPageTemplate: Pure presentation component for all tool pages.
 * All orchestration logic (XState, side-effects, generation dispatch) lives in useToolPage.
 */

import { useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, MenuItem, TextField } from '@mui/material';
import { uiPrimitives } from '../../../app/ui/primitives';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import type { SupportedTool } from '../machines/tool-flow.machine';
import { mapToolStepToCardConfig } from '../runtime/tool-form-architecture';
import { useToolPage } from '../runtime/useToolPage';
import { useModelsQuery } from '../../../app/runtime/queries/useModelsQuery';
import { ToolGenerationFlowVertical } from './ToolGenerationFlowVertical';
import { ToolActionButtons } from './ToolActionButtons';

const toneProfileOptions = [
  { value: 'Professional', label: 'Professional' },
  { value: 'Casual', label: 'Casual' },
  { value: 'Formal', label: 'Formal' },
  { value: 'Technical', label: 'Technical' },
] as const;

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

  // Zod schema per validazione form tool page
  const toolFormSchema = z.object({
    projectId: z.string().min(1, 'Project richiesto'),
    model: z.string().min(1, 'Model richiesto'),
    tone: z.string().min(1, 'Tone richiesto'),
    briefingFile: z.any().optional(),
  });

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(toolFormSchema),
    defaultValues: {
      projectId: formState.projectId,
      model: formState.model,
      tone: formState.tone,
      briefingFile: undefined,
    },
    mode: 'onChange',
  });

  // Auto-select the catalog default model quando la lista si popola
  const defaultAppliedRef = useRef(false);
  useEffect(() => {
    if (defaultAppliedRef.current || modelOptions.length === 0) return;
    const catalogDefault = modelOptions.find((o) => o.isDefault);
    if (catalogDefault && formState.model !== catalogDefault.key) {
      setFormState((prev) => ({ ...prev, model: catalogDefault.key }));
      setValue('model', catalogDefault.key);
    }
    defaultAppliedRef.current = true;
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

            <form className="ui-tool-form" onSubmit={handleSubmit((data) => {
              // Aggiorna lo stato del form globale e chiama la logica esistente
              setFormState((prev) => ({
                ...prev,
                projectId: data.projectId,
                model: data.model,
                tone: data.tone,
              }));
              // Se c'è un file briefing, gestiscilo
              if (data.briefingFile instanceof File) {
                handleBriefingFileSelected(data.briefingFile);
              }
              // Esegui azione primaria (es. submit XState)
              handlePrimaryAction();
            })}>

              <div className="ui-tool-form-row ui-tool-form-row--triple">
                <Controller
                  name="projectId"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      select
                      label="Project"
                      disabled={projectsLoading || isStreamActive}
                      onChange={(e) => {
                        field.onChange(e);
                        setFormState((prev) => ({ ...prev, projectId: e.target.value }));
                      }}
                      value={formState.projectId}
                      error={!!errors.projectId}
                      helperText={errors.projectId?.message as string | undefined}
                      fullWidth
                    >
                      <MenuItem value="">{projectsLoading ? 'Caricamento progetti...' : 'Seleziona un progetto'}</MenuItem>
                      {projects.map((p) => (
                        <MenuItem key={p.id} value={p.id}>
                          {p.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />

                <Controller
                  name="model"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      select
                      label="Model"
                      onChange={(e) => {
                        field.onChange(e);
                        setFormState((prev) => ({ ...prev, model: e.target.value }));
                      }}
                      value={formState.model}
                      error={!!errors.model}
                      helperText={errors.model?.message as string | undefined}
                      fullWidth
                    >
                      {modelOptions.length === 0 ? (
                        <MenuItem value={formState.model}>{formState.model || 'No models available'}</MenuItem>
                      ) : (
                        modelOptions.map((o) => (
                          <MenuItem key={o.key} value={o.key}>{o.label}</MenuItem>
                        ))
                      )}
                    </TextField>
                  )}
                />

                <Controller
                  name="tone"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      select
                      label="Tone"
                      disabled={isStreamActive}
                      onChange={(e) => {
                        field.onChange(e);
                        setFormState((prev) => ({ ...prev, tone: e.target.value }));
                      }}
                      value={formState.tone}
                      error={!!errors.tone}
                      helperText={errors.tone?.message as string | undefined}
                      fullWidth
                    >
                      {toneProfileOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </div>

              <Controller
                name="briefingFile"
                control={control}
                render={({ field }) => (
                  <div>
                    <Button
                      component="label"
                      variant="outlined"
                      disabled={!formState.projectId.trim() || isStreamActive}
                    >
                      Briefing File
                      <input
                        type="file"
                        hidden
                        accept=".docx,.txt,.md"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          field.onChange(file);
                          if (file) {
                            handleBriefingFileSelected(file);
                          } else {
                            handleBriefingReset();
                          }
                        }}
                      />
                    </Button>
                    {errors.briefingFile ? <span className={uiPrimitives.error}>{errors.briefingFile.message as string}</span> : null}
                  </div>
                )}
              />

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
                onPrimaryAction={handleSubmit((data) => {
                  setFormState((prev) => ({
                    ...prev,
                    projectId: data.projectId,
                    model: data.model,
                    tone: data.tone,
                  }));
                  if (data.briefingFile instanceof File) {
                    handleBriefingFileSelected(data.briefingFile);
                  }
                  handlePrimaryAction();
                })}
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
