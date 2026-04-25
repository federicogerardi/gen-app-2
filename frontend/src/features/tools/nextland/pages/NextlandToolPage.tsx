import { useEffect, useMemo, useState } from 'react';
import { appCopy, formatMeta } from '../../../../app/copy/system';
import { useAuthSession } from '../../../../app/providers/AuthSessionProvider';
import { useGenerationWorkspace } from '../../../generation/runtime/GenerationWorkspaceProvider';
import type { GenerationRequest } from '../../../generation/contracts/backend-stream';
import { createStepRequest, getStepDependencies, toolStepOrder } from '../../runtime/tool-generation-engine';
import { runExtraction, uploadBrief } from '../../runtime/tools-client';
import { listProjects, type ProjectSummary } from '../../../projects/runtime/projects-client';
import { Button, Surface, uiPrimitives } from '../../../../app/ui/primitives';

const hasAllowedBriefingExtension = (name: string): boolean => {
  const normalized = name.toLowerCase();
  return normalized.endsWith('.docx') || normalized.endsWith('.txt') || normalized.endsWith('.md');
};

export const NextlandToolPage = () => {
  const auth = useAuthSession();
  const generation = useGenerationWorkspace();
  const [projectId, setProjectId] = useState(generation.focusedProjectId ?? '');
  const [model, setModel] = useState('openrouter/auto');
  const [registrySnapshotRef, setRegistrySnapshotRef] = useState('snapshot:default');
  const [prompt, setPrompt] = useState<string>(appCopy.editorial.tools.nextland.defaultPrompt);
  const [briefingFile, setBriefingFile] = useState<File | null>(null);
  const [briefingFileName, setBriefingFileName] = useState<string | null>(null);
  const [briefingError, setBriefingError] = useState<string | null>(null);
  const [briefingStatus, setBriefingStatus] = useState<'idle' | 'uploading' | 'extracting' | 'ready'>('idle');
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.session || !auth.capabilities.projects) {
      setProjects([]);
      setProjectsLoading(false);
      setProjectsError(null);
      return;
    }

    let cancelled = false;
    setProjectsLoading(true);

    void (async () => {
      try {
        const nextProjects = await listProjects({
          apiBaseUrl: auth.apiBaseUrl,
          capabilities: auth.capabilities,
        });

        if (cancelled) {
          return;
        }

        setProjects(nextProjects);
        setProjectsError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setProjects([]);
        setProjectsError(loadError instanceof Error ? loadError.message : appCopy.ui.fallbackErrors.loadProjects);
      } finally {
        if (!cancelled) {
          setProjectsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth.apiBaseUrl, auth.capabilities, auth.session]);

  const extractionContext = generation.getExtractionContext(projectId.trim());

  const completedArtifactsByStep = useMemo(() => {
    return generation.artifacts
      .filter((artifact) =>
        artifact.projectId === projectId.trim()
        && artifact.status === 'completed'
        && artifact.toolKey === 'nextland')
      .reduce<Partial<Record<(typeof toolStepOrder)['nextland'][number], string>>>((acc, artifact) => {
        const step = artifact.sourceRequest.input.step;
        if (typeof step === 'string' && (step === 'landing' || step === 'thank_you')) {
          acc[step] = artifact.artifactId;
        }

        return acc;
      }, {});
  }, [generation.artifacts, projectId]);

  const nextStep = useMemo(() => {
    return toolStepOrder.nextland.find((step) => !completedArtifactsByStep[step]) ?? null;
  }, [completedArtifactsByStep]);

  const canRun =
    Boolean(auth.session)
    && !generation.isStreamActive
    && projectId.trim().length > 0
    && extractionContext !== null
    && nextStep !== null;

  const processBriefing = async (): Promise<void> => {
    if (!auth.session || !auth.capabilities.toolsUpload || !briefingFile || !projectId.trim()) {
      if (!auth.capabilities.toolsUpload) {
        setBriefingError('Capability toolsUpload disabilitata: upload/extraction non disponibili.');
      }
      return;
    }

    setBriefingStatus('uploading');
    setBriefingError(null);

    try {
      const uploaded = await uploadBrief(
        {
          projectId: projectId.trim(),
          toolKey: 'nextland',
          file: briefingFile,
        },
        {
          apiBaseUrl: auth.apiBaseUrl,
          capabilities: { toolsUpload: auth.capabilities.toolsUpload },
        },
      );

      setBriefingStatus('extracting');

      const extraction = await runExtraction(
        {
          userId: auth.session.user.id,
          projectId: projectId.trim(),
          model,
          toolKey: 'nextland',
          prompt,
          briefingId: uploaded.briefingId,
          briefingText: uploaded.normalizedText,
          registrySnapshotRef,
        },
        {
          apiBaseUrl: auth.apiBaseUrl,
          capabilities: { toolsUpload: auth.capabilities.toolsUpload },
        },
      );

      generation.upsertExtractionContext({
        projectId: projectId.trim(),
        briefingId: uploaded.briefingId,
        extractionArtifactId: extraction.artifactId,
        extractionPayload: extraction.payload,
        normalizedText: uploaded.normalizedText,
        parsedFormat: uploaded.parsedFormat,
        updatedAt: new Date().toISOString(),
      });

      setBriefingFileName(uploaded.fileName);
      setBriefingStatus('ready');
      setBriefingError(null);
    } catch (error) {
      setBriefingStatus('idle');
      setBriefingError(error instanceof Error ? error.message : 'Errore durante upload/extraction brief');
    }
  };

  const onBriefingFileSelected = (file: File | null): void => {
    if (!file) {
      setBriefingFile(null);
      setBriefingFileName(null);
      setBriefingError(null);
      setBriefingStatus('idle');
      return;
    }

    if (!hasAllowedBriefingExtension(file.name)) {
      setBriefingFile(null);
      setBriefingFileName(null);
      setBriefingStatus('idle');
      setBriefingError('Formato briefing non supportato. Usa .docx, .txt o .md');
      return;
    }

    setBriefingFile(file);
    setBriefingFileName(file.name);
    setBriefingError(null);
    setBriefingStatus('idle');
  };

  const runNextStep = (): void => {
    if (!auth.session || !nextStep || !extractionContext) {
      return;
    }

    const baseRequest: GenerationRequest = {
      requestId: crypto.randomUUID(),
      userId: auth.session.user.id,
      projectId: projectId.trim(),
      artifactType: 'content',
      model,
      outputFormat: 'markdown',
      toolKey: 'nextland',
      workflowType: 'nextland',
      registrySnapshotRef,
      input: {
        prompt,
        intent: 'new',
        briefingId: extractionContext.briefingId,
        extractionArtifactId: extractionContext.extractionArtifactId,
        extractionPayload: extractionContext.extractionPayload,
      },
    };

    const dependencies = getStepDependencies('nextland', completedArtifactsByStep, nextStep);
    const dependencyArtifactContentsByStep = Object.fromEntries(
      Object.entries(dependencies)
        .map(([stepKey, artifactId]) => {
          const dependencyArtifact = generation.artifacts.find((artifact) => artifact.artifactId === artifactId);
          return [stepKey, dependencyArtifact?.content ?? ''];
        })
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim().length > 0),
    );

    const request = createStepRequest(
      baseRequest,
      'nextland',
      nextStep,
      dependencies,
      dependencyArtifactContentsByStep,
    );
    generation.start(request);
  };

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <h2>{appCopy.editorial.tools.nextland.title}</h2>
      <p className={uiPrimitives.metaLine}>{appCopy.editorial.tools.nextland.orderRule}</p>

      <label>
        {appCopy.ui.labels.projectId}
        <select
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          disabled={projectsLoading || projects.length === 0}
        >
          <option value="">Seleziona progetto</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name} ({project.id})
            </option>
          ))}
        </select>
      </label>

      {projectsLoading ? <p className={uiPrimitives.metaLine}>{appCopy.ui.states.loadingProjects}</p> : null}
      {projectsError ? <p className={uiPrimitives.error}>{projectsError}</p> : null}

      <label>
        {appCopy.ui.labels.model}
        <input value={model} onChange={(event) => setModel(event.target.value)} />
      </label>

      <label>
        {appCopy.ui.labels.registrySnapshotRef}
        <input value={registrySnapshotRef} onChange={(event) => setRegistrySnapshotRef(event.target.value)} />
      </label>

      <label>
        {appCopy.ui.labels.promptFallback}
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={3} />
      </label>

      <label>
        {appCopy.ui.labels.briefFile}
        <input
          type="file"
          accept=".docx,.txt,.md"
          disabled={!projectId.trim() || generation.isStreamActive}
          onChange={(event) => onBriefingFileSelected(event.target.files?.[0] ?? null)}
        />
      </label>

      <Button
        type="button"
        onClick={() => {
          void processBriefing();
        }}
        disabled={!projectId.trim() || !briefingFile || generation.isStreamActive || !auth.capabilities.toolsUpload}
      >
        {appCopy.ui.actions.processBrief}
      </Button>

      <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.briefStatus, briefingStatus)}</p>
      <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.briefFile, briefingFileName ?? extractionContext?.briefingId ?? '-')}</p>
      {!auth.capabilities.toolsUpload ? <p className={uiPrimitives.metaLine}>{appCopy.ui.states.toolsUploadDisabled}</p> : null}
      {briefingError ? <p className={uiPrimitives.error}>{briefingError}</p> : null}

      <ul className={uiPrimitives.listClean}>
        {toolStepOrder.nextland.map((step) => (
          <Surface as="li" key={step}>
            <p><strong>{step}</strong> | {completedArtifactsByStep[step] ? appCopy.ui.states.completed : appCopy.ui.states.pending}</p>
            <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.artifact, completedArtifactsByStep[step] ?? '-')}</p>
          </Surface>
        ))}
      </ul>

      <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.nextStep, nextStep ?? '-')}</p>
      <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.streamStatus, generation.streamStatus)}</p>
      {auth.session ? null : <p className={uiPrimitives.error}>{appCopy.ui.session.unavailable}</p>}

      {projectId.trim() && !extractionContext
        ? <p className={uiPrimitives.error}>{appCopy.ui.states.extractionContextMissing}</p>
        : null}

      <div className={uiPrimitives.actions}>
        <Button type="button" onClick={runNextStep} disabled={!canRun}>
          {appCopy.ui.actions.runNextStep}
        </Button>
      </div>
    </Surface>
  );
};
