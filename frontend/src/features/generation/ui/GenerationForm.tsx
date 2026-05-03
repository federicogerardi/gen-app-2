import { useEffect, useState, type FormEvent } from 'react';
import type {
  ArtifactType,
  GenerationRequest,
  OutputFormat,
} from '../contracts/backend-stream';
import {
  runExtraction,
  uploadBrief,
} from '../../tools/runtime/tools-client';
import {
  generateRequestId,
  isAllowedBriefingExtension,
} from '../../../app/runtime/shared-utils';
import type {
  ExtractionLifecycle,
  ToolIntent,
  ToolPhase,
} from './tool-ux-state';
import {
  selectCheckpointForProject,
  shouldRequireBriefingForResume,
  sortCheckpointsForResume,
  type ToolCheckpoint,
} from './tool-checkpoints';
import type { ExtractionContext } from '../runtime/GenerationWorkspaceProvider';
import { appCopy } from '../../../app/copy/system';
import { Button, Surface, uiPrimitives } from '../../../app/ui/primitives';

type GenerationFormProps = {
  userId: string;
  toolsUploadEnabled: boolean;
  projectOptions: Array<{
    id: string;
    name: string;
  }>;
  projectsLoading: boolean;
  projectsError: string | null;
  onStart: (request: GenerationRequest) => void;
  disabled: boolean;
  checkpoints: ToolCheckpoint[];
  prefillProjectId: string | null;
  onExtractionContextChange: (context: ExtractionContext) => void;
  getExtractionContext: (projectId: string) => ExtractionContext | null;
  onSetupStateChange: (state: {
    phase: ToolPhase;
    intent: ToolIntent;
    extractionLifecycle: ExtractionLifecycle;
    hasProject: boolean;
    hasBriefing: boolean;
    hasCheckpoint: boolean;
    checkpointHasExtractionContext: boolean;
    hasSourceArtifact: boolean;
  }) => void;
};

export const GenerationForm = ({
  userId,
  toolsUploadEnabled,
  projectOptions,
  projectsLoading,
  projectsError,
  onStart,
  disabled,
  checkpoints,
  prefillProjectId,
  onExtractionContextChange,
  getExtractionContext,
  onSetupStateChange,
}: GenerationFormProps) => {
  const [projectId, setProjectId] = useState('');
  const [artifactType, setArtifactType] = useState<ArtifactType>('content');
  const [model, setModel] = useState('openrouter/auto');
  const [prompt, setPrompt] = useState<string>(appCopy.editorial.generation.defaultPrompt);
  const [tone, setTone] = useState<string>(appCopy.editorial.generation.defaultTone);
  const [notes, setNotes] = useState('');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('markdown');
  const [workflowType, setWorkflowType] = useState('meta_ads');
  const [toolKey, setToolKey] = useState('meta_ads');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [intent, setIntent] = useState<ToolIntent>('new');
  const [hasCheckpoint, setHasCheckpoint] = useState(false);
  const [sourceArtifactId, setSourceArtifactId] = useState('');
  const [selectedCheckpointArtifactId, setSelectedCheckpointArtifactId] = useState('');
  const [phase, setPhase] = useState<ToolPhase>('idle');
  const [extractionLifecycle, setExtractionLifecycle] = useState<ExtractionLifecycle>('idle');
  const [briefingFile, setBriefingFile] = useState<File | null>(null);
  const [briefingFileName, setBriefingFileName] = useState<string | null>(null);
  const [briefingError, setBriefingError] = useState<string | null>(null);
  const [registrySnapshotRef, setRegistrySnapshotRef] = useState('snapshot:default');

  const extractionContext = getExtractionContext(projectId.trim());

  const hasProject = projectId.trim().length > 0;
  const checkpointsForProject = sortCheckpointsForResume(
    checkpoints.filter((checkpoint) => checkpoint.projectId === projectId.trim()),
  );
  const hasBriefing = briefingFileName !== null || extractionContext !== null;
  const hasSourceArtifact = sourceArtifactId.trim().length > 0;
  const selectedCheckpoint = selectCheckpointForProject(
    checkpoints,
    projectId,
    selectedCheckpointArtifactId || undefined,
  );
  const checkpointHasExtractionContext = selectedCheckpoint?.extractionContextAvailable ?? false;

  useEffect(() => {
    onSetupStateChange({
      phase,
      intent,
      extractionLifecycle,
      hasProject,
      hasBriefing,
      hasCheckpoint,
      checkpointHasExtractionContext,
      hasSourceArtifact,
    });
  }, [
    checkpointHasExtractionContext,
    extractionLifecycle,
    hasBriefing,
    hasCheckpoint,
    hasProject,
    hasSourceArtifact,
    intent,
    onSetupStateChange,
    phase,
  ]);

  useEffect(() => {
    if (!prefillProjectId) {
      return;
    }

    setProjectId(prefillProjectId);
  }, [prefillProjectId]);

  useEffect(() => {
    if (!extractionContext || briefingFileName) {
      return;
    }

    setExtractionLifecycle('completed_partial');
    setPhase('review');
    setBriefingError(null);
  }, [briefingFileName, extractionContext]);

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const request: GenerationRequest = {
      requestId: generateRequestId(),
      userId,
      projectId: projectId.trim(),
      artifactType,
      model,
      input: {
        prompt,
        tone,
        notes,
        intent,
        briefingFileName: briefingFileName ?? null,
        briefingId: extractionContext?.briefingId ?? null,
        extractionArtifactId: extractionContext?.extractionArtifactId ?? null,
        stepDependencyArtifactIds: [
          ...(extractionContext?.extractionArtifactId ? [extractionContext.extractionArtifactId] : []),
          ...(hasSourceArtifact ? [sourceArtifactId.trim()] : []),
        ],
        extractionPayload: extractionContext?.extractionPayload ?? null,
        sourceArtifactId: hasSourceArtifact ? sourceArtifactId.trim() : null,
        checkpointArtifactId: selectedCheckpoint?.artifactId ?? null,
      },
      outputFormat,
      toolKey,
      workflowType,
      registrySnapshotRef,
    };

    if (idempotencyKey.trim().length > 0) {
      request.idempotencyKey = idempotencyKey.trim();
    }

    setPhase('generating');
    onStart(request);
  };

  const onBriefingFileSelected = (file: File | null): void => {
    if (!file) {
      setBriefingFile(null);
      setBriefingFileName(null);
      setBriefingError(null);
      setExtractionLifecycle('idle');
      setPhase('idle');
      return;
    }

    if (!isAllowedBriefingExtension(file.name)) {
      setBriefingFile(null);
      setBriefingFileName(null);
      setBriefingError('Formato briefing non supportato. Usa .docx, .txt o .md');
      setExtractionLifecycle('failed_hard');
      setPhase('idle');
      return;
    }

    setBriefingFile(file);
    setBriefingFileName(file.name);
    setBriefingError(null);
    setExtractionLifecycle('idle');
    setPhase('idle');
  };

  const processBriefing = async (): Promise<void> => {
    if (!hasProject || !briefingFile || disabled || !toolsUploadEnabled) {
      if (!toolsUploadEnabled) {
        setBriefingError('Capability toolsUpload disabilitata: upload/extraction non disponibili.');
      }
      return;
    }

    setPhase('uploading');
    setExtractionLifecycle('in_progress');
    setBriefingError(null);

    try {
      const uploaded = await uploadBrief(
        {
          projectId: projectId.trim(),
          toolKey,
          file: briefingFile,
        },
        {
          capabilities: { toolsUpload: toolsUploadEnabled },
        },
      );

      setPhase('extracting');

      const extraction = await runExtraction(
        {
          userId,
          projectId: projectId.trim(),
          model,
          toolKey,
          tone,
          notes,
          briefingId: uploaded.briefingId,
          briefingText: uploaded.normalizedText,
          registrySnapshotRef,
          ...(idempotencyKey.trim() ? { idempotencyKey: idempotencyKey.trim() } : {}),
        },
        {
          capabilities: { toolsUpload: toolsUploadEnabled },
        },
      );

      onExtractionContextChange({
        projectId: projectId.trim(),
        briefingId: uploaded.briefingId,
        extractionArtifactId: extraction.artifactId,
        extractionPayload: extraction.payload,
        normalizedText: uploaded.normalizedText,
        parsedFormat: uploaded.parsedFormat,
        updatedAt: new Date().toISOString(),
      });

      setBriefingFileName(uploaded.fileName);
      setPhase('review');
      setExtractionLifecycle('completed_full');
    } catch (error) {
      setPhase('idle');
      setExtractionLifecycle('failed_hard');
      setBriefingError(error instanceof Error ? error.message : 'Errore durante upload/extraction');
    }
  };

  const hasGenerationPrerequisites =
    (() => {
      const resumeWithoutBriefing = intent === 'resume'
        && hasCheckpoint
        && hasSourceArtifact
        && !shouldRequireBriefingForResume(selectedCheckpoint);
      return hasBriefing || resumeWithoutBriefing;
    })();

  const canStartGeneration =
    !disabled
    && hasProject
    && hasGenerationPrerequisites
    && extractionLifecycle !== 'in_progress'
    && briefingError === null;

  const applyCheckpoint = (nextIntent: ToolIntent): void => {
    if (!selectedCheckpoint) {
      return;
    }

    setIntent(nextIntent);
    setHasCheckpoint(true);
    setSourceArtifactId(selectedCheckpoint.artifactId);

    if (selectedCheckpoint.extractionContextAvailable) {
      setExtractionLifecycle('completed_partial');
      setPhase('review');
      return;
    }

    setExtractionLifecycle('idle');
    setPhase('idle');
  };

  return (
    <Surface as="form" className={uiPrimitives.grid} onSubmit={onSubmit}>
      <h2>{appCopy.editorial.generation.setupTitle}</h2>

      <label>
        {appCopy.ui.labels.intent}
        <select value={intent} onChange={(e) => setIntent(e.target.value as ToolIntent)}>
          {appCopy.ui.options.intent.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>

      <label className={uiPrimitives.checkboxRow}>
        <input
          type="checkbox"
          checked={hasCheckpoint}
          onChange={(e) => setHasCheckpoint(e.target.checked)}
        />
        {appCopy.ui.labels.checkpointAvailable}
      </label>

      <label>
        {appCopy.ui.labels.recentCheckpoint}
        <select
          value={selectedCheckpointArtifactId}
          onChange={(e) => setSelectedCheckpointArtifactId(e.target.value)}
          disabled={!hasProject || checkpointsForProject.length === 0}
        >
          <option value="">auto</option>
          {checkpointsForProject.map((checkpoint) => (
            <option key={checkpoint.artifactId} value={checkpoint.artifactId}>
              {checkpoint.artifactId} | {checkpoint.status} | {new Date(checkpoint.updatedAt).toLocaleString()}
            </option>
          ))}
        </select>
      </label>

      {selectedCheckpoint ? (
        <div>
          <p className={uiPrimitives.metaLine}>
            Stato: {selectedCheckpoint.status}
          </p>
          <p className={uiPrimitives.metaLine}>
            Brief: {selectedCheckpoint.extractionContextAvailable ? 'disponibile' : 'non disponibile'}
          </p>
          <div className={uiPrimitives.actions}>
            <Button type="button" onClick={() => applyCheckpoint('resume')} disabled={disabled}>
              {appCopy.ui.actions.useCheckpointResume}
            </Button>
            <Button type="button" onClick={() => applyCheckpoint('regenerate')} disabled={disabled}>
              {appCopy.ui.actions.useCheckpointRegenerate}
            </Button>
          </div>
        </div>
      ) : null}

      {(intent === 'resume' || intent === 'regenerate') ? (
        <label>
          {appCopy.ui.labels.sourceArtifactId}
          <input
            value={sourceArtifactId}
            onChange={(e) => setSourceArtifactId(e.target.value)}
            placeholder={appCopy.ui.placeholders.sourceArtifactId}
          />
        </label>
      ) : null}

      <label>
        {appCopy.ui.labels.projectId}
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          disabled={projectsLoading || projectOptions.length === 0}
          required
        >
          <option value="">Seleziona progetto</option>
          {projectOptions.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name} ({project.id})
            </option>
          ))}
        </select>
      </label>

      {projectsLoading ? <p className={uiPrimitives.metaLine}>Caricamento progetti...</p> : null}
      {projectsError ? <p className={uiPrimitives.error}>{projectsError}</p> : null}

      <label>
        {appCopy.ui.labels.briefingFile}
        <input
          type="file"
          accept=".docx,.txt,.md"
          disabled={!hasProject || disabled}
          onChange={(e) => onBriefingFileSelected(e.target.files?.[0] ?? null)}
        />
      </label>

      <Button
        type="button"
        onClick={() => {
          void processBriefing();
        }}
        disabled={
          !hasProject
          || !briefingFile
          || disabled
          || extractionLifecycle === 'in_progress'
          || !toolsUploadEnabled
        }
      >
        {appCopy.ui.actions.processBriefing}
      </Button>

      {briefingError ? <p className={uiPrimitives.error}>{briefingError}</p> : null}
      {!toolsUploadEnabled ? <p className={uiPrimitives.metaLine}>{appCopy.ui.states.toolsUploadDisabled}</p> : null}

      <label>
        {appCopy.ui.labels.artifactType}
        <select
          value={artifactType}
          onChange={(e) => setArtifactType(e.target.value as ArtifactType)}
        >
          {appCopy.ui.options.artifactTypes.slice(1).map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>

      <label>
        {appCopy.ui.labels.model}
        <input value={model} onChange={(e) => setModel(e.target.value)} />
      </label>

      <label>
        {appCopy.ui.labels.toneOptional}
        <input value={tone} onChange={(e) => setTone(e.target.value)} />
      </label>

      <label>
        {appCopy.ui.labels.notesOptional}
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </label>

      <label>
        {appCopy.ui.labels.prompt}
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} required />
      </label>

      <label>
        {appCopy.ui.labels.outputFormat}
        <select
          value={outputFormat}
          onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
        >
          {appCopy.ui.options.outputFormats.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>

      <label>
        {appCopy.ui.labels.workflowType}
        <input value={workflowType} onChange={(e) => setWorkflowType(e.target.value)} />
      </label>

      <label>
        {appCopy.ui.labels.toolKey}
        <input value={toolKey} onChange={(e) => setToolKey(e.target.value)} />
      </label>

      <label>
        {appCopy.ui.labels.idempotencyKey}
        <input value={idempotencyKey} onChange={(e) => setIdempotencyKey(e.target.value)} />
      </label>

      <label>
        {appCopy.ui.labels.registrySnapshotRef}
        <input
          value={registrySnapshotRef}
          onChange={(e) => setRegistrySnapshotRef(e.target.value)}
          required
        />
      </label>

      <button type="submit" disabled={!canStartGeneration}>{appCopy.ui.actions.startGeneration}</button>
    </Surface>
  );
};
