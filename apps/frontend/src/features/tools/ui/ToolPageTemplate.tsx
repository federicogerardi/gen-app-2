/**
 * ToolPageTemplate: Pure presentation component for all tool pages.
 * All orchestration logic (XState, side-effects, generation dispatch) lives in useToolPage.
 */

import { useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { MenuItem, TextField } from '@mui/material';
import { Upload } from 'lucide-react';
import { uiPrimitives } from '../../../app/ui/primitives';
import { UploadFieldButton } from '../../../app/ui/UploadFieldButton';
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
  const { data: modelOptions, loading: modelsLoading, error: modelsError } = useModelsQuery({
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
    briefingGuidance,
    dispatchError,
    artifactsReloadError,
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
    handleAngleDetectorFileSelected,
    handleBriefingReset,
  } = useToolPage(props);

  // Zod schema per validazione form tool page
  const toolFormSchema = z.object({
    projectId: z.string().min(1, 'Project richiesto'),
    model: z.string().min(1, 'Model richiesto'),
    tone: z.string().min(1, 'Tone richiesto'),
    briefingFile: z.any().optional(),
    angleDetectorFile: z.any().optional(),
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
      angleDetectorFile: undefined,
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

  // Sync external formState changes (e.g. route prefills from useToolPage) into RHF
  // so that handleSubmit always sees up-to-date values.
  useEffect(() => {
    setValue('projectId', formState.projectId);
  }, [formState.projectId, setValue]);

  useEffect(() => {
    setValue('model', formState.model);
  }, [formState.model, setValue]);

  useEffect(() => {
    setValue('tone', formState.tone);
  }, [formState.tone, setValue]);

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
                      value={field.value}
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
                      disabled={isStreamActive || modelsLoading || Boolean(modelsError)}
                      onChange={(e) => {
                        field.onChange(e);
                        setFormState((prev) => ({ ...prev, model: e.target.value }));
                      }}
                      value={field.value}
                      error={!!errors.model}
                      helperText={(errors.model?.message as string | undefined) ?? (modelsError ?? undefined)}
                      fullWidth
                    >
                      {modelsError ? (
                        <MenuItem value={field.value || ''}>{field.value || 'Catalog unavailable'}</MenuItem>
                      ) : modelOptions.length === 0 ? (
                        <MenuItem value={field.value}>{field.value || 'No models available'}</MenuItem>
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
                      value={field.value}
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
                    <UploadFieldButton
                      label="Briefing File"
                      disabled={!formState.projectId.trim() || isStreamActive}
                      icon={<Upload size={16} aria-hidden="true" />}
                      accept=".docx,.txt,.md"
                      onFileSelected={(file) => {
                        field.onChange(file);
                        if (file) {
                          handleBriefingFileSelected(file);
                        } else {
                          handleBriefingReset();
                        }
                      }}
                    />
                    {errors.briefingFile ? <span className={uiPrimitives.error}>{errors.briefingFile.message as string}</span> : null}
                  </div>
                )}
              />

              {props.toolKey === 'angle-generator' ? (
                <Controller
                  name="angleDetectorFile"
                  control={control}
                  render={({ field }) => (
                    <div>
                      <UploadFieldButton
                        label="Angle Detector File"
                        disabled={!formState.projectId.trim() || isStreamActive}
                        icon={<Upload size={16} aria-hidden="true" />}
                        accept=".docx,.txt,.md"
                        onFileSelected={(file) => {
                          field.onChange(file);
                          if (file) {
                            handleAngleDetectorFileSelected(file);
                          } else {
                            handleBriefingReset();
                          }
                        }}
                      />
                      {errors.angleDetectorFile ? <span className={uiPrimitives.error}>{errors.angleDetectorFile.message as string}</span> : null}
                    </div>
                  )}
                />
              ) : null}

              {briefingError ? <p className={uiPrimitives.error}>{briefingError}</p> : null}
              {briefingGuidance ? <p className={uiPrimitives.metaLine} role="status">{briefingGuidance}</p> : null}
              {artifactsReloadError ? <p className={uiPrimitives.error}>{artifactsReloadError}</p> : null}

                {/* DispatchError ownership contract:
                  This message is inline-action only (Setup Panel, adjacent to primary CTA).
                  It must not be mirrored to the global feedback channel. */}
                {dispatchError ? <p className={uiPrimitives.error}>{dispatchError}</p> : null}

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
                  if (props.toolKey === 'angle-generator' && data.angleDetectorFile instanceof File) {
                    handleAngleDetectorFileSelected(data.angleDetectorFile);
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
              briefingGuidance={briefingGuidance}
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
            />
          </section>
        </div>
      </div>
    </section>
  );
};
