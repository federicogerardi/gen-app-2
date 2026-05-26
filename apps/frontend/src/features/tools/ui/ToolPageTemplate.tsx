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
import { SecondaryCtaButton } from '../../../app/ui/CtaButtons';
import { UploadFieldButton } from '../../../app/ui/UploadFieldButton';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { appCopy } from '../../../app/copy/system';
import type { SupportedTool } from '../machines/tool-flow.machine';
import { useToolPage } from '../runtime/useToolPage';
import {
  deriveToolInputRequirementMatrix,
  selectToolFileInstructions,
} from '../runtime/tool-page-selectors';
import { useToolApiBindingStatusAdapter } from '../runtime/tool-api-binding-status-adapter';
import { useModelsQuery } from '../../../app/runtime/queries/useModelsQuery';
import { ToolGenerationFlowVertical } from './ToolGenerationFlowVertical';
import type { ToolGenerationFlowVerticalProps } from './ToolGenerationFlowVertical';
import { ToolFileInstructionsSection } from './ToolFileInstructionsSection';
import { derivePrimaryActionLabel } from '../../generation/ui/tool-ux-state';

const toneProfileOptions = appCopy.ui.toolPage.toneProfiles;
const campaignObjectiveOptions = appCopy.ui.toolPage.form.campaignObjectiveOptions;

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
  campaignObjective: string;
  videoTitle: string;
  topic: string;
  keywords: string;
  ctaText: string;
  ctaLink: string;
  credentialsOrProof: string;
  chaptersWithTimestamps: string;
  socialLinks: string;
  hashtags: string;
};

export const ToolPageTemplate = (props: ToolPageTemplateProps) => {
  const copy = appCopy.ui.toolPage;
  const isMetaAdsTool = props.toolKey === 'meta-ads';
  const isYoutubeDescriptionTool = props.toolKey === 'youtube-description';
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
  const apiAcquisitionInputs = toolFileInstructions?.apiAcquisitionInputs ?? [];
  const apiBindingStatusAdapter = useToolApiBindingStatusAdapter({
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
    toolKey: props.toolKey,
    apiAcquisitionInputs,
  });
  const hasProjectSelected = formState.projectId.trim().length > 0;
  const completedFileKeys = [
    ...((effectiveBriefingFileName || effectiveBriefingStatus === 'ready') ? ['briefing-file'] : []),
    ...(angleDetectorFileName ? ['angle-detector-file'] : []),
  ];
  const inputRequirementMatrix = deriveToolInputRequirementMatrix({
    toolKey: props.toolKey,
    hasProjectSelected,
    completedFileKeys,
    includeApiAcquisition: apiBindingStatusAdapter.enabled,
    apiAcquisitionStatus: apiBindingStatusAdapter.data,
  });
  const hasToolInputFiles = inputFiles.length > 0;

  const formatStepLabel = (stepKey: string) => stepKey
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  const inputFilePayload: NonNullable<ToolGenerationFlowVerticalProps['inputFilePayload']> = inputFiles.map((fileEntry) => {
    const fileName = fileEntry.key === 'briefing-file'
      ? effectiveBriefingFileName ?? null
      : fileEntry.key === 'angle-detector-file'
        ? angleDetectorFileName ?? null
        : null;
    const isBriefingFile = fileEntry.key === 'briefing-file';
    const isAngleDetectorFile = fileEntry.key === 'angle-detector-file';
    const status: 'done' | 'todo' = fileName ? 'done' : 'todo';

    return {
      key: fileEntry.key,
      label: isBriefingFile
        ? copy.filePayloadLabel.briefing
        : isAngleDetectorFile
          ? copy.filePayloadLabel.angleDetector
          : fileEntry.label,
      requiredness: fileEntry.requiredness,
      status,
      fileName,
    };
  });

  const apiAcquisitionPayload: NonNullable<ToolGenerationFlowVerticalProps['apiAcquisitionPayload']> = inputRequirementMatrix.entries
    .filter((entry) => entry.sourceFamily === 'api-acquisition')
    .map((entry) => ({
      key: entry.key,
      label: entry.label,
      requiredness: entry.requiredness,
      status: entry.satisfied ? 'done' : 'todo',
    }));

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

  const extractionProgress = (() => {
    const totalCount = 3;
    if (effectiveBriefingStatus === 'uploading') {
      return {
        completedCount: 1,
        totalCount,
        currentStepLabel: copy.extraction.uploadStepLabel,
        statusLabel: copy.extraction.uploadStatusLabel,
      };
    }

    if (effectiveBriefingStatus === 'extracting') {
      return {
        completedCount: 2,
        totalCount,
        currentStepLabel: copy.extraction.extractingStepLabel,
        statusLabel: copy.extraction.extractingStatusLabel,
      };
    }

    if (effectiveBriefingStatus === 'ready') {
      return {
        completedCount: 3,
        totalCount,
        currentStepLabel: copy.extraction.completedStepLabel,
        statusLabel: copy.extraction.completedStatusLabel,
      };
    }

    return {
      completedCount: 0,
      totalCount,
      currentStepLabel: copy.extraction.idleStepLabel,
      statusLabel: copy.extraction.idleStatusLabel,
    };
  })();

  const generationProgress = {
    completedCount: effectiveCanonicalState === 'completed' ? toolConfig.steps.length : completedStepsForFlow.size,
    totalCount: toolConfig.steps.length,
    currentStepLabel: (() => {
      const activeStep = currentRunningStep ?? nextAvailableStep ?? (pausedCheckpointStep && effectiveCanonicalState === 'paused-with-checkpoint' ? pausedCheckpointStep : null);
      return activeStep ? formatStepLabel(activeStep) : null;
    })(),
    stepItems,
    sessionId,
    extractionProgress,
  };

  const fileFieldShape = Object.fromEntries(
    inputFiles.map((entry) => [entry.key, z.any().optional()]),
  ) as Record<string, z.ZodTypeAny>;

  // Zod schema per validazione form tool page
  const toolFormSchema = z.object({
    projectId: z.string().min(1, copy.form.validation.projectRequired),
    model: z.string().min(1, copy.form.validation.modelRequired),
    tone: z.string().min(1, copy.form.validation.toneRequired),
    campaignObjective: z.string(),
    videoTitle: z.string(),
    topic: z.string(),
    keywords: z.string(),
    ctaText: z.string(),
    ctaLink: z.string(),
    credentialsOrProof: z.string(),
    chaptersWithTimestamps: z.string(),
    socialLinks: z.string(),
    hashtags: z.string(),
    ...fileFieldShape,
  }).superRefine((value, context) => {
    if (isYoutubeDescriptionTool) {
      const requiredDirectFields: Array<{ key: keyof ToolPageFormValues; label: string }> = [
        { key: 'videoTitle', label: 'Video title' },
        { key: 'topic', label: 'Topic' },
        { key: 'keywords', label: 'Keywords' },
        { key: 'ctaText', label: 'CTA text' },
        { key: 'ctaLink', label: 'CTA link' },
        { key: 'credentialsOrProof', label: 'Credentials or proof' },
        { key: 'chaptersWithTimestamps', label: 'Chapters with timestamps' },
      ];

      for (const field of requiredDirectFields) {
        const candidate = value[field.key];
        if (typeof candidate !== 'string' || candidate.trim().length === 0) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field.key],
            message: `${field.label} required`,
          });
        }
      }

    }

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
          message: `${copy.form.validation.uploadToContinuePrefix}${fileEntry.label}${copy.form.validation.uploadToContinueSuffix}`,
        });
      }
    }
  });

  const extractionInProgress = effectiveBriefingStatus === 'uploading' || effectiveBriefingStatus === 'extracting';
  const extractionAlreadyReady = effectiveBriefingStatus === 'ready';
  const canStartExtraction = hasToolInputFiles
    && !isStreamActive
    && !extractionInProgress
    && !extractionAlreadyReady
    && inputRequirementMatrix.requiredEntriesSatisfied;
  const isGenerationLocked = isGenerating || effectiveCanonicalState === 'running';
  const generationInProgressPrimaryOverride: { label: string; disabled: boolean; tooltip?: string } | undefined = effectiveCanonicalState === 'running'
    ? {
      label: copy.flow.progressAria.generationInProgress,
      disabled: true,
    }
    : undefined;
  const extractionInProgressPrimaryOverride: { label: string; disabled: boolean; tooltip?: string } | undefined = extractionInProgress
    ? {
      label: copy.primaryActionPolicy.startGenerationLabel,
      disabled: true,
    }
    : undefined;
  const matrixBlockingPrimaryOverride: { label: string; disabled: boolean; tooltip?: string } | undefined =
    !inputRequirementMatrix.requiredEntriesSatisfied
      && machineViewModel.primaryActionPolicy !== 'open-last-artifact'
      ? {
        label: copy.primaryActionPolicy.disabledLabel,
        disabled: true,
        tooltip: copy.primaryActionPolicy.disabledTooltip,
      }
      : undefined;
  const extractionPrimaryOverride = canStartExtraction
    ? {
      label: copy.extraction.startActionLabel,
      disabled: false,
      tooltip: copy.extraction.startActionTooltip,
    }
    : undefined;

  const executePrimaryActionFromForm = (data: ToolPageFormValues & Record<string, unknown>) => {
    setFormState((prev) => ({
      ...prev,
      projectId: data.projectId,
      model: data.model,
      tone: data.tone,
      campaignObjective: isMetaAdsTool ? data.campaignObjective : prev.campaignObjective,
      videoTitle: isYoutubeDescriptionTool ? data.videoTitle : prev.videoTitle,
      topic: isYoutubeDescriptionTool ? data.topic : prev.topic,
      keywords: isYoutubeDescriptionTool ? data.keywords : prev.keywords,
      ctaText: isYoutubeDescriptionTool ? data.ctaText : prev.ctaText,
      ctaLink: isYoutubeDescriptionTool ? data.ctaLink : prev.ctaLink,
      credentialsOrProof: isYoutubeDescriptionTool ? data.credentialsOrProof : prev.credentialsOrProof,
      chaptersWithTimestamps: isYoutubeDescriptionTool
        ? data.chaptersWithTimestamps
        : prev.chaptersWithTimestamps,
      socialLinks: isYoutubeDescriptionTool ? data.socialLinks : prev.socialLinks,
      hashtags: isYoutubeDescriptionTool ? data.hashtags : prev.hashtags,
    }));

    for (const fileEntry of inputFiles) {
      const file = (data as Record<string, unknown>)[fileEntry.key];
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
  };

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
      campaignObjective: formState.campaignObjective,
      videoTitle: formState.videoTitle,
      topic: formState.topic,
      keywords: formState.keywords,
      ctaText: formState.ctaText,
      ctaLink: formState.ctaLink,
      credentialsOrProof: formState.credentialsOrProof,
      chaptersWithTimestamps: formState.chaptersWithTimestamps,
      socialLinks: formState.socialLinks,
      hashtags: formState.hashtags,
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

  useEffect(() => {
    setValue('campaignObjective', formState.campaignObjective);
  }, [formState.campaignObjective, setValue]);

  useEffect(() => {
    setValue('videoTitle', formState.videoTitle);
  }, [formState.videoTitle, setValue]);

  useEffect(() => {
    setValue('topic', formState.topic);
  }, [formState.topic, setValue]);

  useEffect(() => {
    setValue('keywords', formState.keywords);
  }, [formState.keywords, setValue]);

  useEffect(() => {
    setValue('ctaText', formState.ctaText);
  }, [formState.ctaText, setValue]);

  useEffect(() => {
    setValue('ctaLink', formState.ctaLink);
  }, [formState.ctaLink, setValue]);

  useEffect(() => {
    setValue('credentialsOrProof', formState.credentialsOrProof);
  }, [formState.credentialsOrProof, setValue]);

  useEffect(() => {
    setValue('chaptersWithTimestamps', formState.chaptersWithTimestamps);
  }, [formState.chaptersWithTimestamps, setValue]);

  useEffect(() => {
    setValue('socialLinks', formState.socialLinks);
  }, [formState.socialLinks, setValue]);

  useEffect(() => {
    setValue('hashtags', formState.hashtags);
  }, [formState.hashtags, setValue]);

  const basePrimaryAction = generationInProgressPrimaryOverride
    ?? extractionInProgressPrimaryOverride
    ?? matrixBlockingPrimaryOverride
    ?? extractionPrimaryOverride
    ?? derivePrimaryActionLabel(machineViewModel.primaryActionPolicy);
  const isGenerationInProgressCta = generationInProgressPrimaryOverride !== undefined;
  const handleUnifiedPrimaryActionClick = machineViewModel.primaryActionPolicy === 'open-last-artifact'
    ? handlePrimaryAction
    : handleSubmit((data) => {
      executePrimaryActionFromForm(data);
    });

  const unifiedPrimaryActionCta: NonNullable<ToolGenerationFlowVerticalProps['primaryActionCta']> = {
    label: machineViewModel.primaryActionPolicy === 'open-last-artifact' ? copy.openSessionLabel : basePrimaryAction.label,
    disabled: (basePrimaryAction.disabled ?? false) || isStreamActive,
    isLoading: isStreamActive && !isGenerationInProgressCta,
    onClick: handleUnifiedPrimaryActionClick,
    ...(basePrimaryAction.tooltip ? { tooltip: basePrimaryAction.tooltip } : {}),
  };

  return (
    <section className="ui-tool-page-template">
      <div className={uiPrimitives.stack}>
        <div className="ui-tool-layout-grid">
          <section className="ui-tool-column ui-tool-column-inputs">
            <header>
              <h2>{toolConfig.displayName}</h2>
              <p className={uiPrimitives.metaLine}>{toolConfig.displayName} {copy.headingMetaSuffix}</p>
            </header>

            <form className="ui-tool-form" onSubmit={handleSubmit((data) => {
              executePrimaryActionFromForm(data);
            })}>

              <div className="ui-tool-form-row ui-tool-form-row--triple">
                <Controller
                  name="projectId"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      select
                      label={copy.form.projectLabel}
                      disabled={projectsLoading || isGenerationLocked}
                      onChange={(e) => {
                        field.onChange(e);
                        setFormState((prev) => ({ ...prev, projectId: e.target.value }));
                      }}
                      value={field.value}
                      error={!!errors.projectId}
                      helperText={errors.projectId?.message as string | undefined}
                      fullWidth
                    >
                      <MenuItem value="">{projectsLoading ? copy.form.loadingProjects : copy.form.selectProject}</MenuItem>
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
                      label={copy.form.modelLabel}
                      disabled={isGenerationLocked || modelsLoading || Boolean(modelsError)}
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
                        <MenuItem value={field.value || ''}>{field.value || copy.form.catalogUnavailable}</MenuItem>
                      ) : modelOptions.length === 0 ? (
                        <MenuItem value={field.value}>{field.value || copy.form.noModelsAvailable}</MenuItem>
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
                      label={copy.form.toneLabel}
                      disabled={isGenerationLocked}
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

              {isMetaAdsTool ? (
                <div className="ui-tool-form-row">
                  <Controller
                    name="campaignObjective"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        select
                        label={copy.form.campaignObjectiveLabel}
                        disabled={isGenerationLocked}
                        onChange={(e) => {
                          field.onChange(e);
                          setFormState((prev) => ({ ...prev, campaignObjective: e.target.value }));
                        }}
                        value={field.value ?? ''}
                        fullWidth
                      >
                        <MenuItem value="">{copy.form.campaignObjectivePlaceholder}</MenuItem>
                        {campaignObjectiveOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                </div>
              ) : null}

              {isYoutubeDescriptionTool ? (
                <div className="ui-tool-form-row">
                  <Controller
                    name="videoTitle"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        label="Video title"
                        disabled={isGenerationLocked}
                        value={field.value}
                        error={!!errors.videoTitle}
                        helperText={errors.videoTitle?.message as string | undefined}
                        onChange={(e) => {
                          field.onChange(e);
                          setFormState((prev) => ({ ...prev, videoTitle: e.target.value }));
                        }}
                        fullWidth
                      />
                    )}
                  />
                </div>
              ) : null}

              {isYoutubeDescriptionTool ? (
                <div className="ui-tool-form-row">
                  <Controller
                    name="topic"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        label="Topic"
                        disabled={isGenerationLocked}
                        value={field.value}
                        error={!!errors.topic}
                        helperText={errors.topic?.message as string | undefined}
                        onChange={(e) => {
                          field.onChange(e);
                          setFormState((prev) => ({ ...prev, topic: e.target.value }));
                        }}
                        fullWidth
                      />
                    )}
                  />
                </div>
              ) : null}

              {isYoutubeDescriptionTool ? (
                <div className="ui-tool-form-row">
                  <Controller
                    name="keywords"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        label="Keywords (comma-separated)"
                        disabled={isGenerationLocked}
                        value={field.value}
                        error={!!errors.keywords}
                        helperText={errors.keywords?.message as string | undefined}
                        onChange={(e) => {
                          field.onChange(e);
                          setFormState((prev) => ({ ...prev, keywords: e.target.value }));
                        }}
                        fullWidth
                      />
                    )}
                  />
                </div>
              ) : null}

              {isYoutubeDescriptionTool ? (
                <div className="ui-tool-form-row ui-tool-form-row--double">
                  <Controller
                    name="ctaText"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        label="CTA text"
                        disabled={isGenerationLocked}
                        value={field.value}
                        error={!!errors.ctaText}
                        helperText={errors.ctaText?.message as string | undefined}
                        onChange={(e) => {
                          field.onChange(e);
                          setFormState((prev) => ({ ...prev, ctaText: e.target.value }));
                        }}
                        fullWidth
                      />
                    )}
                  />
                  <Controller
                    name="ctaLink"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        label="CTA link"
                        disabled={isGenerationLocked}
                        value={field.value}
                        error={!!errors.ctaLink}
                        helperText={errors.ctaLink?.message as string | undefined}
                        onChange={(e) => {
                          field.onChange(e);
                          setFormState((prev) => ({ ...prev, ctaLink: e.target.value }));
                        }}
                        fullWidth
                      />
                    )}
                  />
                </div>
              ) : null}

              {isYoutubeDescriptionTool ? (
                <div className="ui-tool-form-row">
                  <Controller
                    name="credentialsOrProof"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        label="Credentials or proof"
                        disabled={isGenerationLocked}
                        value={field.value}
                        error={!!errors.credentialsOrProof}
                        helperText={errors.credentialsOrProof?.message as string | undefined}
                        onChange={(e) => {
                          field.onChange(e);
                          setFormState((prev) => ({ ...prev, credentialsOrProof: e.target.value }));
                        }}
                        multiline
                        minRows={2}
                        fullWidth
                      />
                    )}
                  />
                </div>
              ) : null}

              {isYoutubeDescriptionTool ? (
                <div className="ui-tool-form-row">
                  <Controller
                    name="chaptersWithTimestamps"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        label="Chapters with timestamps (one per line)"
                        disabled={isGenerationLocked}
                        value={field.value}
                        error={!!errors.chaptersWithTimestamps}
                        helperText={errors.chaptersWithTimestamps?.message as string | undefined}
                        onChange={(e) => {
                          field.onChange(e);
                          setFormState((prev) => ({ ...prev, chaptersWithTimestamps: e.target.value }));
                        }}
                        multiline
                        minRows={3}
                        fullWidth
                      />
                    )}
                  />
                </div>
              ) : null}

              {isYoutubeDescriptionTool ? (
                <div className="ui-tool-form-row">
                  <Controller
                    name="socialLinks"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        label="Social links (one per line)"
                        disabled={isGenerationLocked}
                        value={field.value}
                        error={!!errors.socialLinks}
                        helperText={errors.socialLinks?.message as string | undefined}
                        onChange={(e) => {
                          field.onChange(e);
                          setFormState((prev) => ({ ...prev, socialLinks: e.target.value }));
                        }}
                        multiline
                        minRows={2}
                        fullWidth
                      />
                    )}
                  />
                </div>
              ) : null}

              {isYoutubeDescriptionTool ? (
                <div className="ui-tool-form-row">
                  <Controller
                    name="hashtags"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        label="Hashtags (comma-separated, max 5)"
                        disabled={isGenerationLocked}
                        value={field.value}
                        error={!!errors.hashtags}
                        helperText={errors.hashtags?.message as string | undefined}
                        onChange={(e) => {
                          field.onChange(e);
                          setFormState((prev) => ({ ...prev, hashtags: e.target.value }));
                        }}
                        fullWidth
                      />
                    )}
                  />
                </div>
              ) : null}

              {inputFiles.map((fileEntry) => (
                <Controller
                  key={fileEntry.key}
                  name={fileEntry.key as never}
                  control={control}
                  render={({ field }) => (
                    <div>
                      <UploadFieldButton
                        label={fileEntry.label.replace(/([a-z])([A-Z])/g, '$1 $2')}
                        disabled={!formState.projectId.trim() || isGenerationLocked}
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

              <div className="ui-tool-action-buttons">
                {isGenerating ? (
                  <SecondaryCtaButton
                    type="button"
                    onClick={handleCancelGeneration}
                    title={copy.form.cancelGenerationTooltip}
                  >
                    {copy.form.cancelGeneration}
                  </SecondaryCtaButton>
                ) : null}
              </div>
            </form>
          </section>

          <section className="ui-tool-column ui-tool-column-status">
            <ToolGenerationFlowVertical
              canonicalState={effectiveCanonicalState}
              projectName={currentProject?.name ?? null}
              errorMessage={machineViewModel.messages.error ?? briefingError ?? null}
              inputFilePayload={inputFilePayload}
              apiAcquisitionPayload={apiAcquisitionPayload}
              generationProgress={generationProgress}
              primaryActionCta={unifiedPrimaryActionCta}
            />
          </section>
        </div>
      </div>
    </section>
  );
};
