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
import { useToolPage } from '../runtime/useToolPage';
import {
  deriveToolInputFileCompletion,
  selectToolFileInstructions,
} from '../runtime/tool-page-selectors';
import { useModelsQuery } from '../../../app/runtime/queries/useModelsQuery';
import { ToolGenerationFlowVertical } from './ToolGenerationFlowVertical';
import { ToolActionButtons } from './ToolActionButtons';
import { ToolFileInstructionsSection } from './ToolFileInstructionsSection';

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

type ToolPageFormValues = {
  projectId: string;
  model: string;
  tone: string;
} & Record<string, unknown>;

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
    dispatchError,
    effectiveBriefingStatus,
    effectiveBriefingFileName,
    machineViewModel,
    isGenerating,
    effectiveCanonicalState,
    currentProject,
    isStreamActive,
    completedStepsForFlow,
    currentRunningStep,
    pausedCheckpointStep,
    nextAvailableStep,
    sessionId,
    handlePrimaryAction,
    handleCancelGeneration,
    handleBriefingFileSelected,
    handleAngleDetectorFileSelected,
    handleExtractionStart,
    handleBriefingReset,
    angleDetectorFileName,
  } = useToolPage(props);
  const toolFileInstructions = selectToolFileInstructions(props.toolKey);
  const inputFiles = toolFileInstructions?.inputFiles ?? [];
  const completedFileKeys = [
    ...((effectiveBriefingFileName || effectiveBriefingStatus === 'ready') ? ['briefing-file'] : []),
    ...(angleDetectorFileName ? ['angle-detector-file'] : []),
  ];

  const formatStepLabel = (stepKey: string) => stepKey
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  const inputFilePayload = inputFiles.map((fileEntry) => {
    const fileName = fileEntry.key === 'briefing-file'
      ? effectiveBriefingFileName ?? null
      : fileEntry.key === 'angle-detector-file'
        ? angleDetectorFileName ?? null
        : null;
    const isBriefingFile = fileEntry.key === 'briefing-file';
    const isAngleDetectorFile = fileEntry.key === 'angle-detector-file';
    const status = fileName
      ? (isBriefingFile && (effectiveBriefingStatus === 'uploading' || effectiveBriefingStatus === 'extracting') ? 'active' : 'done')
      : (isBriefingFile && (effectiveBriefingStatus === 'uploading' || effectiveBriefingStatus === 'extracting') ? 'active' : 'todo');

    return {
      key: fileEntry.key,
      label: isBriefingFile ? 'BriefingFile' : isAngleDetectorFile ? 'AngleDetectorFile' : fileEntry.label,
      requiredness: fileEntry.requiredness,
      status,
      fileName,
    };
  });

  const stepItems = toolConfig.steps.map((stepKey) => {
    const isDone = completedStepsForFlow.has(stepKey) || effectiveCanonicalState === 'completed';
    const isActive = currentRunningStep === stepKey || (!currentRunningStep && effectiveCanonicalState === 'running' && nextAvailableStep === stepKey);
    const isError = pausedCheckpointStep === stepKey && effectiveCanonicalState === 'paused-with-checkpoint';

    return {
      key: stepKey,
      label: formatStepLabel(stepKey),
      status: isError ? 'error' : isActive ? 'running' : isDone ? 'done' : 'idle',
    };
  });

  const generationProgress = {
    completedCount: effectiveCanonicalState === 'completed' ? toolConfig.steps.length : completedStepsForFlow.size,
    totalCount: toolConfig.steps.length,
    currentStepLabel: (() => {
      const activeStep = currentRunningStep ?? nextAvailableStep ?? (pausedCheckpointStep && effectiveCanonicalState === 'paused-with-checkpoint' ? pausedCheckpointStep : null);
      return activeStep ? formatStepLabel(activeStep) : null;
    })(),
    stepItems,
    sessionId,
  };

  const fileFieldShape = Object.fromEntries(
    inputFiles.map((entry) => [entry.key, z.any().optional()]),
  ) as Record<string, z.ZodTypeAny>;

  // Zod schema per validazione form tool page
  const toolFormSchema = z.object({
    projectId: z.string().min(1, 'Project richiesto'),
    model: z.string().min(1, 'Model richiesto'),
    tone: z.string().min(1, 'Tone richiesto'),
    ...fileFieldShape,
  }).superRefine((value, context) => {
    for (const fileEntry of inputFiles) {
      if (
        fileEntry.requiredness !== 'always-required'
        && fileEntry.requiredness !== 'required-by-tool-setting'
      ) {
        continue;
      }

      if (completedFileKeys.includes(fileEntry.key)) {
        continue;
      }

      const candidate = (value as Record<string, unknown>)[fileEntry.key];
      if (!(candidate instanceof File)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [fileEntry.key],
          message: `Carica ${fileEntry.label} per continuare.`,
        });
      }
    }
  });

  const fileCompletion = deriveToolInputFileCompletion({
    toolKey: props.toolKey,
    completedFileKeys,
  });
  const extractionInProgress = effectiveBriefingStatus === 'uploading' || effectiveBriefingStatus === 'extracting';
  const extractionAlreadyReady = effectiveBriefingStatus === 'ready';
  const canStartExtraction = !isStreamActive
    && !extractionInProgress
    && !extractionAlreadyReady
    && formState.projectId.trim().length > 0
    && fileCompletion.requiredFilesComplete;
  const extractionPrimaryOverride = canStartExtraction
    ? {
      label: 'Avvia estrazione',
      disabled: false,
      tooltip: "Avvia l'estrazione del contesto briefing",
    }
    : undefined;

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ToolPageFormValues>({
    resolver: zodResolver(toolFormSchema),
    defaultValues: {
      projectId: formState.projectId,
      model: formState.model,
      tone: formState.tone,
      ...Object.fromEntries(inputFiles.map((entry) => [entry.key, undefined])),
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

              {inputFiles.map((fileEntry) => (
                <Controller
                  key={fileEntry.key}
                  name={fileEntry.key as keyof ToolPageFormValues}
                  control={control}
                  render={({ field }) => (
                    <div>
                      <UploadFieldButton
                        label={fileEntry.label.replace(/([a-z])([A-Z])/g, '$1 $2')}
                        disabled={!formState.projectId.trim() || isStreamActive}
                        icon={<Upload size={16} aria-hidden="true" />}
                        accept={fileEntry.accept}
                        onFileSelected={(file) => {
                          field.onChange(file);
                          if (!file) {
                            handleBriefingReset();
                            return;
                          }

                          if (fileEntry.key === 'angle-detector-file') {
                            handleAngleDetectorFileSelected(file);
                            return;
                          }

                          handleBriefingFileSelected(file);
                        }}
                      />
                    </div>
                  )}
                />
              ))}

              <ToolFileInstructionsSection instructions={toolFileInstructions} />

                {/* DispatchError ownership contract (DDD-061):
                  This message is inline-action only (Setup Panel, adjacent to primary CTA).
                  It must not be mirrored to the global feedback channel. */}
                {dispatchError ? <p className={uiPrimitives.error}>{dispatchError}</p> : null}

              <ToolActionButtons
                primaryPolicy={machineViewModel.primaryActionPolicy}
                {...(extractionPrimaryOverride ? { primaryOverride: extractionPrimaryOverride } : {})}
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
                  for (const fileEntry of inputFiles) {
                    const file = data[fileEntry.key];
                    if (!(file instanceof File)) {
                      continue;
                    }

                    if (fileEntry.key === 'angle-detector-file') {
                      handleAngleDetectorFileSelected(file);
                    } else {
                      handleBriefingFileSelected(file);
                    }
                  }
                  if (canStartExtraction) {
                    handleExtractionStart();
                    return;
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
              errorMessage={machineViewModel.messages.error ?? briefingError ?? null}
              inputFilePayload={inputFilePayload}
              generationProgress={generationProgress}
            />
          </section>
        </div>
      </div>
    </section>
  );
};
