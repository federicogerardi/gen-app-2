import { useEffect, useMemo, useState } from 'react';
import { useAuthSession } from '../../../../app/providers/AuthSessionProvider';
import { useGenerationWorkspace } from '../../../generation/runtime/GenerationWorkspaceProvider';
import type { GenerationRequest } from '../../../generation/contracts/backend-stream';
import { createStepRequest, getStepDependencies, toolStepOrder } from '../../runtime/tool-generation-engine';
import { runExtraction, uploadBrief } from '../../runtime/tools-client';
import { listProjects, type ProjectSummary } from '../../../projects/runtime/projects-client';

const hasAllowedBriefingExtension = (name: string): boolean => {
  const normalized = name.toLowerCase();
  return normalized.endsWith('.docx') || normalized.endsWith('.txt') || normalized.endsWith('.md');
};

export const FunnelPagesToolPage = () => {
  const auth = useAuthSession();
  const generation = useGenerationWorkspace();
  const [projectId, setProjectId] = useState(generation.focusedProjectId ?? '');
  const [model, setModel] = useState('openrouter/auto');
  const [registrySnapshotRef, setRegistrySnapshotRef] = useState('snapshot:default');
  const [prompt, setPrompt] = useState('Genera lo step Funnel richiesto con coerenza al brief estratto.');
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
        setProjectsError(loadError instanceof Error ? loadError.message : 'Unable to load projects');
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
        && artifact.toolKey === 'funnel-pages')
      .reduce<Partial<Record<(typeof toolStepOrder)['funnel-pages'][number], string>>>((acc, artifact) => {
        const step = artifact.sourceRequest.input.step;
        if (typeof step === 'string' && (step === 'optin' || step === 'quiz' || step === 'vsl')) {
          acc[step] = artifact.artifactId;
        }

        return acc;
      }, {});
  }, [generation.artifacts, projectId]);

  const nextStep = useMemo(() => {
    return toolStepOrder['funnel-pages'].find((step) => !completedArtifactsByStep[step]) ?? null;
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
          toolKey: 'funnel-pages',
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
          toolKey: 'funnel-pages',
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
      toolKey: 'funnel-pages',
      workflowType: 'funnel-pages',
      registrySnapshotRef,
      input: {
        prompt,
        intent: 'new',
        briefingId: extractionContext.briefingId,
        extractionArtifactId: extractionContext.extractionArtifactId,
        extractionPayload: extractionContext.extractionPayload,
      },
    };

    const dependencies = getStepDependencies('funnel-pages', completedArtifactsByStep, nextStep);
    const dependencyArtifactContentsByStep = Object.fromEntries(
      Object.entries(dependencies)
        .map(([stepKey, artifactId]) => {
          const dependencyArtifact = generation.artifacts.find((artifact) => artifact.artifactId === artifactId);
          return [stepKey, dependencyArtifact?.content ?? ''];
        })
        .filter((entry): entry is [string, string] => entry[1].trim().length > 0),
    );

    const request = createStepRequest(
      baseRequest,
      'funnel-pages',
      nextStep,
      dependencies,
      dependencyArtifactContentsByStep,
    );
    generation.start(request);
  };

  return (
    <section className="panel page-stack">
      <h2>Funnel Pages Tool</h2>
      <p className="meta-line">Ordine step obbligatorio: optin -&gt; quiz -&gt; vsl</p>

      <label>
        Project ID
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

      {projectsLoading ? <p className="meta-line">Caricamento progetti...</p> : null}
      {projectsError ? <p className="error-message">{projectsError}</p> : null}

      <label>
        Model
        <input value={model} onChange={(event) => setModel(event.target.value)} />
      </label>

      <label>
        Registry snapshot ref
        <input value={registrySnapshotRef} onChange={(event) => setRegistrySnapshotRef(event.target.value)} />
      </label>

      <label>
        Prompt fallback
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={3} />
      </label>

      <label>
        Brief file (.docx, .txt, .md)
        <input
          type="file"
          accept=".docx,.txt,.md"
          disabled={!projectId.trim() || generation.isStreamActive}
          onChange={(event) => onBriefingFileSelected(event.target.files?.[0] ?? null)}
        />
      </label>

      <button
        type="button"
        onClick={() => {
          void processBriefing();
        }}
        disabled={!projectId.trim() || !briefingFile || generation.isStreamActive || !auth.capabilities.toolsUpload}
      >
        Processa brief
      </button>

      <p className="meta-line">brief status: {briefingStatus}</p>
      <p className="meta-line">brief file: {briefingFileName ?? extractionContext?.briefingId ?? '-'}</p>
      {!auth.capabilities.toolsUpload ? <p className="meta-line">toolsUpload capability: disabled</p> : null}
      {briefingError ? <p className="error-message">{briefingError}</p> : null}

      <ul className="list-clean">
        {toolStepOrder['funnel-pages'].map((step) => (
          <li key={step} className="panel">
            <p><strong>{step}</strong> | {completedArtifactsByStep[step] ? 'completed' : 'pending'}</p>
            <p className="meta-line">artifact: {completedArtifactsByStep[step] ?? '-'}</p>
          </li>
        ))}
      </ul>

      <p className="meta-line">next step: {nextStep ?? '-'}</p>
      <p className="meta-line">stream status: {generation.streamStatus}</p>
      {auth.session ? null : <p className="error-message">Sessione non disponibile.</p>}
      {projectId.trim() && !extractionContext
        ? <p className="error-message">Extraction context mancante per il progetto selezionato. Carica e processa un brief.</p>
        : null}

      <div className="actions">
        <button type="button" onClick={runNextStep} disabled={!canRun}>
          Esegui prossimo step reale
        </button>
      </div>
    </section>
  );
};
