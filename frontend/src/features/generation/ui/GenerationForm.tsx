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
import type {
  ExtractionLifecycle,
  ToolIntent,
  ToolPhase,
} from './tool-ux-state';
import {
  selectBestCheckpointForProject,
  shouldRequireBriefingForResume,
  sortCheckpointsForResume,
  type ToolCheckpoint,
} from './tool-checkpoints';
import type { ToolExtractionContext } from '../runtime/GenerationWorkspaceProvider';

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
  onExtractionContextChange: (context: ToolExtractionContext) => void;
  getExtractionContext: (projectId: string) => ToolExtractionContext | null;
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

const randomId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `req-${Date.now()}`;
};

const hasAllowedBriefingExtension = (name: string): boolean => {
  const normalized = name.toLowerCase();
  return normalized.endsWith('.docx') || normalized.endsWith('.txt') || normalized.endsWith('.md');
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
  const [prompt, setPrompt] = useState('Scrivi una landing page sintetica in stile diretto.');
  const [tone, setTone] = useState('diretto');
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
  const hasBriefing = briefingFileName !== null || extractionContext !== null;
  const hasSourceArtifact = sourceArtifactId.trim().length > 0;
  const checkpointsForProject = sortCheckpointsForResume(
    checkpoints.filter((checkpoint) => checkpoint.projectId === projectId.trim()),
  );
  const selectedCheckpoint = selectedCheckpointArtifactId
    ? checkpointsForProject.find((checkpoint) => checkpoint.artifactId === selectedCheckpointArtifactId) ?? null
    : selectBestCheckpointForProject(checkpointsForProject, projectId);
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
      requestId: randomId(),
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

    if (!hasAllowedBriefingExtension(file.name)) {
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
          prompt,
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
    <form className="panel grid" onSubmit={onSubmit}>
      <h2>Tool setup comune</h2>

      <label>
        Intent
        <select value={intent} onChange={(e) => setIntent(e.target.value as ToolIntent)}>
          <option value="new">new</option>
          <option value="resume">resume</option>
          <option value="regenerate">regenerate</option>
        </select>
      </label>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={hasCheckpoint}
          onChange={(e) => setHasCheckpoint(e.target.checked)}
        />
        Checkpoint disponibile
      </label>

      <label>
        Checkpoint recente (progetto)
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
          <p className="meta-line">checkpoint status: {selectedCheckpoint.status}</p>
          <p className="meta-line">
            extraction context: {selectedCheckpoint.extractionContextAvailable ? 'present' : 'missing'}
          </p>
          <div className="actions">
            <button type="button" onClick={() => applyCheckpoint('resume')} disabled={disabled}>
              Usa checkpoint per resume
            </button>
            <button type="button" onClick={() => applyCheckpoint('regenerate')} disabled={disabled}>
              Usa checkpoint per regenerate
            </button>
          </div>
        </div>
      ) : null}

      {(intent === 'resume' || intent === 'regenerate') ? (
        <label>
          Source artifact ID
          <input
            value={sourceArtifactId}
            onChange={(e) => setSourceArtifactId(e.target.value)}
            placeholder="artifact-..."
          />
        </label>
      ) : null}

      <label>
        Project ID
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

      {projectsLoading ? <p className="meta-line">Caricamento progetti...</p> : null}
      {projectsError ? <p className="error-message">{projectsError}</p> : null}

      <label>
        Briefing file (.docx, .txt, .md)
        <input
          type="file"
          accept=".docx,.txt,.md"
          disabled={!hasProject || disabled}
          onChange={(e) => onBriefingFileSelected(e.target.files?.[0] ?? null)}
        />
      </label>

      <button
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
        Processa briefing
      </button>

      <p className="meta-line">phase: {phase}</p>
      <p className="meta-line">extraction: {extractionLifecycle}</p>
      <p className="meta-line">briefing: {briefingFileName ?? '-'}</p>
      {!toolsUploadEnabled ? <p className="meta-line">toolsUpload capability: disabled</p> : null}
      {briefingError ? <p className="error-message">{briefingError}</p> : null}

      <label>
        Artifact type
        <select
          value={artifactType}
          onChange={(e) => setArtifactType(e.target.value as ArtifactType)}
        >
          <option value="content">content</option>
          <option value="seo">seo</option>
          <option value="code">code</option>
          <option value="extraction">extraction</option>
        </select>
      </label>

      <label>
        Model
        <input value={model} onChange={(e) => setModel(e.target.value)} />
      </label>

      <label>
        Tone (optional)
        <input value={tone} onChange={(e) => setTone(e.target.value)} />
      </label>

      <label>
        Notes (optional)
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </label>

      <label>
        Prompt
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} required />
      </label>

      <label>
        Output format
        <select
          value={outputFormat}
          onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
        >
          <option value="plain">plain</option>
          <option value="json">json</option>
          <option value="markdown">markdown</option>
        </select>
      </label>

      <label>
        Workflow type
        <input value={workflowType} onChange={(e) => setWorkflowType(e.target.value)} />
      </label>

      <label>
        Tool key
        <input value={toolKey} onChange={(e) => setToolKey(e.target.value)} />
      </label>

      <label>
        Idempotency key
        <input value={idempotencyKey} onChange={(e) => setIdempotencyKey(e.target.value)} />
      </label>

      <label>
        Registry snapshot ref
        <input
          value={registrySnapshotRef}
          onChange={(e) => setRegistrySnapshotRef(e.target.value)}
          required
        />
      </label>

      <button type="submit" disabled={!canStartGeneration}>Avvia generazione</button>
    </form>
  );
};
