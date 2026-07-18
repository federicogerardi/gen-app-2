/**
 * ToolPageTemplate: Pure presentation component for all tool pages.
 * All orchestration logic (XState, side-effects, generation dispatch) lives in useToolPage.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { MenuItem, TextField } from '@mui/material';
import { uiPrimitives } from '../../../app/ui/primitives';
import { SecondaryCtaButton } from '../../../app/ui/CtaButtons';
import { useApiConfig } from '../../../app/providers/AuthSessionProvider';
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
import { derivePrimaryActionLabel } from '../../generation/ui/tool-ux-state';
import { AssetKnowledgePanel } from '../../workspace/ui/AssetKnowledgePanel';
import { useWorkspace } from '../../workspace/runtime/WorkspaceProvider';
import { getToolAssetInputs } from '../../workspace/runtime/toolAssetRegistry';

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
  titolo: string;
  campaignObjective: string;
  copyLengthFormat: 'short-form' | 'medium-form' | 'long-form';
  videoTitle: string;
  topic: string;
  baseQuery: string;
  language: string;
  country: string;
  brandName: string;
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
  const isGeometricTool = props.toolKey === 'geometric';
  const isBlogArticleGeneratorTool = props.toolKey === 'blog-article-generator';
  const youtubeDescriptionSingleRowClassName = 'ui-tool-form-row ui-tool-form-row--full';
  const { apiBaseUrl, capabilities } = useApiConfig();
  const { data: modelOptions, loading: modelsLoading, error: modelsError } = useModelsQuery({
    apiBaseUrl,
    capabilities,
  });
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);

  // ── Workspace context (project auto-resolved from URL) ──
  const workspaceContext = (() => {
    try {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      return useWorkspace();
    } catch {
      return null;
    }
  })();
  const workspaceProjectId = workspaceContext?.workspace.id ?? '';

  const {
    toolConfig,
    formState,
    setFormState,
    briefingError,
    dispatchError,
    artifactsReloadError,
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
    handleBriefingReset: _handleBriefingReset,
    angleDetectorFileName,
  } = useToolPage({ ...props, selectedAssetIds });

  // ── Auto-set projectId from workspace context ──
  useEffect(() => {
    if (workspaceProjectId && formState.projectId !== workspaceProjectId) {
      setFormState((prev) => ({ ...prev, projectId: workspaceProjectId }));
    }
  }, [workspaceProjectId, formState.projectId, setFormState]);

  const [isFormLocked, setIsFormLocked] = useState(false);
  const toolFileInstructions = selectToolFileInstructions(props.toolKey);
  const inputFiles = toolFileInstructions?.inputFiles ?? [];
  const apiAcquisitionInputs = toolFileInstructions?.apiAcquisitionInputs ?? [];
  const apiBindingStatusAdapter = useToolApiBindingStatusAdapter({
    apiBaseUrl,
    capabilities,
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
  const hasContextGenerationStep = toolConfig.steps.includes('context-generation');

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
    titolo: z.string(),
    campaignObjective: z.string(),
    copyLengthFormat: z.enum(['short-form', 'medium-form', 'long-form']),
    videoTitle: z.string(),
    topic: z.string(),
    baseQuery: z.string(),
    language: z.string(),
    country: z.string(),
    brandName: z.string(),
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

        if (isGeometricTool) {
          const requiredDirectFields: Array<{ key: keyof ToolPageFormValues; label: string }> = [
            { key: 'baseQuery', label: 'Base query' },
            { key: 'language', label: 'Language' },
            { key: 'country', label: 'Country' },
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

        if (isBlogArticleGeneratorTool) {
          const candidate = value.titolo;
          if (typeof candidate !== 'string' || candidate.trim().length === 0) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['titolo'],
              message: 'Titolo articolo richiesto',
            });
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
  const canStartExtraction = (hasToolInputFiles || hasContextGenerationStep)
    && !isStreamActive
    && !extractionInProgress
    && !extractionAlreadyReady
    && inputRequirementMatrix.requiredEntriesSatisfied;
  const isFormBusy = extractionInProgress || isGenerating || isStreamActive;
  const isGenerationLocked = isFormLocked || isFormBusy;

  useEffect(() => {
    if (isFormBusy) {
      setIsFormLocked(false);
    }
  }, [isFormBusy]);

  const lockedPrimaryOverride: { label: string; disabled: boolean; tooltip?: string } | undefined = isFormLocked
    ? { label: copy.flow.progressAria.generationInProgress, disabled: true }
    : undefined;
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
      label: copy.primaryActionPolicy.startGenerationLabel,
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
      titolo: isBlogArticleGeneratorTool ? data.titolo : prev.titolo,
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
      baseQuery: isGeometricTool ? data.baseQuery : prev.baseQuery,
      language: isGeometricTool ? data.language : prev.language,
      country: isGeometricTool ? data.country : prev.country,
      brandName: isGeometricTool ? data.brandName : prev.brandName,
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
      handleExtractionStart({ autoStartGeneration: true });
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
      titolo: formState.titolo ?? '',
      campaignObjective: formState.campaignObjective,
      copyLengthFormat: formState.copyLengthFormat ?? 'medium-form',
      videoTitle: formState.videoTitle ?? '',
      topic: formState.topic ?? '',
      baseQuery: formState.baseQuery ?? '',
      language: formState.language ?? '',
      country: formState.country ?? '',
      brandName: formState.brandName ?? '',
      keywords: formState.keywords ?? '',
      ctaText: formState.ctaText ?? '',
      ctaLink: formState.ctaLink ?? '',
      credentialsOrProof: formState.credentialsOrProof ?? '',
      chaptersWithTimestamps: formState.chaptersWithTimestamps ?? '',
      socialLinks: formState.socialLinks ?? '',
      hashtags: formState.hashtags ?? '',
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
    setValue('titolo', formState.titolo ?? '');
  }, [formState.titolo, setValue]);

  useEffect(() => {
    setValue('campaignObjective', formState.campaignObjective);
  }, [formState.campaignObjective, setValue]);

  useEffect(() => {
    setValue('copyLengthFormat', formState.copyLengthFormat ?? 'medium-form');
  }, [formState.copyLengthFormat, setValue]);

  useEffect(() => {
    setValue('videoTitle', formState.videoTitle ?? '');
  }, [formState.videoTitle, setValue]);

  useEffect(() => {
    setValue('topic', formState.topic ?? '');
  }, [formState.topic, setValue]);

  useEffect(() => {
    setValue('brandName', formState.brandName ?? '');
  }, [formState.brandName, setValue]);

  useEffect(() => {
    setValue('keywords', formState.keywords ?? '');
  }, [formState.keywords, setValue]);

  useEffect(() => {
    setValue('ctaText', formState.ctaText ?? '');
  }, [formState.ctaText, setValue]);

  useEffect(() => {
    setValue('ctaLink', formState.ctaLink ?? '');
  }, [formState.ctaLink, setValue]);

  useEffect(() => {
    setValue('credentialsOrProof', formState.credentialsOrProof ?? '');
  }, [formState.credentialsOrProof, setValue]);

  useEffect(() => {
    setValue('chaptersWithTimestamps', formState.chaptersWithTimestamps ?? '');
  }, [formState.chaptersWithTimestamps, setValue]);

  useEffect(() => {
    setValue('socialLinks', formState.socialLinks ?? '');
  }, [formState.socialLinks, setValue]);

  useEffect(() => {
    setValue('hashtags', formState.hashtags ?? '');
  }, [formState.hashtags, setValue]);

   useEffect(() => {
    setValue('baseQuery', formState.baseQuery ?? '');
  }, [formState.baseQuery, setValue]);

  useEffect(() => {
    setValue('language', formState.language ?? '');
  }, [formState.language, setValue]);

  useEffect(() => {
    setValue('country', formState.country ?? '');
  }, [formState.country, setValue]);

 const basePrimaryAction = lockedPrimaryOverride
    ?? generationInProgressPrimaryOverride
    ?? extractionInProgressPrimaryOverride
    ?? matrixBlockingPrimaryOverride
    ?? extractionPrimaryOverride
    ?? derivePrimaryActionLabel(machineViewModel.primaryActionPolicy);
  const isGenerationInProgressCta = generationInProgressPrimaryOverride !== undefined;
  const handleUnifiedPrimaryActionClick = machineViewModel.primaryActionPolicy === 'open-last-artifact'
    ? handlePrimaryAction
    : handleSubmit((data) => {
      setIsFormLocked(true);
      executePrimaryActionFromForm(data);
    });

  const handleCancelWithLockReset = useCallback(() => {
    setIsFormLocked(false);
    handleCancelGeneration();
  }, [handleCancelGeneration]);

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

              {/* ── Configuration Section ── */}
              <div className="ui-tool-setup-section">
                <p className="ui-tool-setup-section__label">{copy.sections.configuration}</p>

              <div className={isBlogArticleGeneratorTool ? "ui-tool-form-row ui-tool-form-row--double" : "ui-tool-form-row ui-tool-form-row--triple"}>
                {/* Project is auto-resolved from workspace context — no selector needed */}

                {isBlogArticleGeneratorTool ? null : (
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
                )}

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

              {isBlogArticleGeneratorTool ? (
                <div className="ui-tool-form-row">
                  <Controller
                    name="titolo"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        label="Titolo articolo"
                        disabled={isGenerationLocked}
                        value={field.value}
                        error={!!errors.titolo}
                        helperText={errors.titolo?.message as string | undefined}
                        onChange={(e) => {
                          field.onChange(e);
                          setFormState((prev) => ({ ...prev, titolo: e.target.value }));
                        }}
                        fullWidth
                      />
                    )}
                  />
                </div>
              ) : null}

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

              {isMetaAdsTool ? (
                <div className="ui-tool-form-row">
                  <Controller
                    name="copyLengthFormat"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        select
                        label={copy.form.copyLengthFormatLabel}
                        disabled={isGenerationLocked}
                        onChange={(e) => {
                          field.onChange(e);
                          setFormState((prev) => ({ ...prev, copyLengthFormat: e.target.value as 'short-form' | 'medium-form' | 'long-form' }));
                        }}
                        value={field.value ?? 'medium-form'}
                        fullWidth
                      >
                        {copy.form.copyLengthFormatOptions.map((option) => (
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
                <div className={youtubeDescriptionSingleRowClassName}>
                  <Controller
                    name="videoTitle"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        label={appCopy.ui.toolPageForm.videoTitleLabel}
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
                <div className={youtubeDescriptionSingleRowClassName}>
                  <Controller
                    name="topic"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        label={appCopy.ui.toolPageForm.topicLabel}
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
                <div className={youtubeDescriptionSingleRowClassName}>
                  <Controller
                    name="keywords"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        label={appCopy.ui.toolPageForm.keywordsLabel}
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
                        label={appCopy.ui.toolPageForm.ctaTextLabel}
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
                        label={appCopy.ui.toolPageForm.ctaLinkLabel}
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
                <div className={youtubeDescriptionSingleRowClassName}>
                  <Controller
                    name="credentialsOrProof"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        label={appCopy.ui.toolPageForm.credentialsLabel}
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
                <div className={youtubeDescriptionSingleRowClassName}>
                  <Controller
                    name="chaptersWithTimestamps"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        label={appCopy.ui.toolPageForm.chaptersLabel}
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
                <div className={youtubeDescriptionSingleRowClassName}>
                  <Controller
                    name="socialLinks"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        label={appCopy.ui.toolPageForm.socialLinksLabel}
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
                <div className={youtubeDescriptionSingleRowClassName}>
                  <Controller
                    name="hashtags"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        label={appCopy.ui.toolPageForm.hashtagsLabel}
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

              {/* Geometric direct-input fields */}
              {isGeometricTool ? (
                <>
                  <div className="ui-tool-form-row ui-tool-form-row--full">
                    <Controller
                      name="baseQuery"
                      control={control}
                      render={({ field }) => (
                          <TextField
                            label={appCopy.ui.toolPageForm.baseQueryLabel}
                          disabled={isGenerationLocked}
                          value={field.value}
                          error={!!errors.baseQuery}
                          helperText={errors.baseQuery?.message as string | undefined}
                          onChange={(e) => {
                            field.onChange(e);
                            setFormState((prev) => ({ ...prev, baseQuery: e.target.value }));
                          }}
                          fullWidth
                        />
                      )}
                    />
                  </div>

                  <div className="ui-tool-form-row ui-tool-form-row--full">
                    <Controller
                      name="language"
                      control={control}
                      render={({ field }) => (
                          <TextField
                          select
                          label={appCopy.ui.toolPageForm.languageLabel}
                          disabled={isGenerationLocked}
                          value={field.value}
                          error={!!errors.language}
                          helperText={errors.language?.message as string | undefined}
                          onChange={(e) => {
                            field.onChange(e);
                            setFormState((prev) => ({ ...prev, language: e.target.value }));
                          }}
                          fullWidth
                        >
                          <MenuItem value="">{appCopy.ui.toolPageForm.selectLanguagePlaceholder}</MenuItem>
                          <MenuItem value="it">{appCopy.ui.toolPageForm.languageOptionIt}</MenuItem>
                          <MenuItem value="en">{appCopy.ui.toolPageForm.languageOptionEn}</MenuItem>
                          <MenuItem value="es">{appCopy.ui.toolPageForm.languageOptionEs}</MenuItem>
                          <MenuItem value="fr">{appCopy.ui.toolPageForm.languageOptionFr}</MenuItem>
                          <MenuItem value="de">{appCopy.ui.toolPageForm.languageOptionDe}</MenuItem>
                        </TextField>
                      )}
                    />
                  </div>

                  <div className="ui-tool-form-row ui-tool-form-row--full">
                    <Controller
                      name="country"
                      control={control}
                      render={({ field }) => (
                          <TextField
                          select
                          label={appCopy.ui.toolPageForm.countryDomainLabel}
                          disabled={isGenerationLocked}
                          value={field.value}
                          error={!!errors.country}
                          helperText={errors.country?.message as string | undefined}
                          onChange={(e) => {
                            field.onChange(e);
                            setFormState((prev) => ({ ...prev, country: e.target.value }));
                          }}
                          fullWidth
                        >
                          <MenuItem value="">{appCopy.ui.toolPageForm.selectDomainPlaceholder}</MenuItem>
                          <MenuItem value="google.it">{appCopy.ui.toolPageForm.domainOptionGoogleIt}</MenuItem>
                          <MenuItem value="google.com">{appCopy.ui.toolPageForm.domainOptionGoogleCom}</MenuItem>
                          <MenuItem value="google.es">{appCopy.ui.toolPageForm.domainOptionGoogleEs}</MenuItem>
                          <MenuItem value="google.fr">{appCopy.ui.toolPageForm.domainOptionGoogleFr}</MenuItem>
                          <MenuItem value="google.de">{appCopy.ui.toolPageForm.domainOptionGoogleDe}</MenuItem>
                          <MenuItem value="google.co.uk">{appCopy.ui.toolPageForm.domainOptionGoogleCoUk}</MenuItem>
                        </TextField>
                      )}
                    />
                   </div>

                   <div className="ui-tool-form-row ui-tool-form-row--full">
                     <Controller
                       name="brandName"
                       control={control}
                       render={({ field }) => (
                          <TextField
                            label={appCopy.ui.toolPageForm.brandNameLabel}
                           disabled={isGenerationLocked}
                           value={field.value}
                           error={!!errors.brandName}
                           helperText={errors.brandName?.message as string | undefined}
                           onChange={(e) => {
                             field.onChange(e);
                             setFormState((prev) => ({ ...prev, brandName: e.target.value }));
                           }}
                           fullWidth
                         />
                       )}
                     />
                   </div>
                 </>
                ) : null}

              </div>{/* end configuration section */}

              {/* ── Knowledge Section (workspace assets) ── */}
              <AssetKnowledgePanelWrapper toolKey={props.toolKey} onAssetSelect={setSelectedAssetIds} />

                {/* DispatchError ownership contract (DDD-061):
                  This message is inline-action only (Setup Panel, adjacent to primary CTA).
                  It must not be mirrored to the global feedback channel. */}
                {dispatchError ? (
                  <div className={uiPrimitives.error} role="alert">
                    <p>{dispatchError}</p>
                    {(dispatchError.includes('tempo') || dispatchError.includes('Timeout') || dispatchError.includes('Connessione persa')) && (
                      <button
                        type="button"
                        className={uiPrimitives.button}
                        onClick={handlePrimaryAction}
                        disabled={isFormLocked || isFormBusy}
                      >
                        Riprova
                      </button>
                    )}
                  </div>
                ) : null}

              <div className="ui-tool-action-buttons">
                {isFormLocked || isFormBusy ? (
                  <SecondaryCtaButton
                    type="button"
                    onClick={handleCancelWithLockReset}
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
              errorMessage={machineViewModel.messages.error ?? briefingError ?? artifactsReloadError ?? null}
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

const AssetKnowledgePanelWrapper: React.FC<{ toolKey: SupportedTool; onAssetSelect?: (ids: string[]) => void }> = ({ toolKey, onAssetSelect }) => {
  let workspace;
  try {
    // useWorkspace throws if not inside WorkspaceProvider
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const ctx = useWorkspace();
    workspace = ctx.workspace;
  } catch {
    return null;
  }

  const assetInputs = useMemo(() => getToolAssetInputs(toolKey), [toolKey]);

  const handleCreateAssetAction = useCallback((_assetType: string, sourceToolKey?: SupportedTool) => {
    if (sourceToolKey && workspace.id) {
      window.location.href = `/workspaces/${workspace.id}/tools/${sourceToolKey}`;
    }
  }, [workspace.id]);

  if (assetInputs.length === 0) return null;

  return (
    <div className="ui-tool-setup-section ui-tool-setup-section--knowledge">
      <p className="ui-tool-setup-section__label">{appCopy.ui.toolPage.sections.knowledge}</p>
      <AssetKnowledgePanel
        workspaceAssets={workspace.assets}
        toolAssetInputs={assetInputs}
        projectId={workspace.id}
        onAssetSelect={onAssetSelect ?? (() => {})}
        onCreateAssetAction={handleCreateAssetAction}
      />
    </div>
  );
};
