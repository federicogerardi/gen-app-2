import { useState, type FormEvent } from 'react';
import type {
  ArtifactType,
  GenerationRequest,
  OutputFormat,
} from '../contracts/backend-stream';

type GenerationFormProps = {
  userId: string;
  onStart: (request: GenerationRequest) => void;
  disabled: boolean;
};

const randomId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `req-${Date.now()}`;
};

export const GenerationForm = ({ userId, onStart, disabled }: GenerationFormProps) => {
  const [projectId, setProjectId] = useState('project-demo');
  const [artifactType, setArtifactType] = useState<ArtifactType>('content');
  const [model, setModel] = useState('openrouter:auto');
  const [prompt, setPrompt] = useState('Scrivi una landing page sintetica in stile diretto.');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('markdown');
  const [workflowType, setWorkflowType] = useState('meta_ads');
  const [toolKey, setToolKey] = useState('meta_ads');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [registrySnapshotRef, setRegistrySnapshotRef] = useState('snapshot:default');

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const request: GenerationRequest = {
      requestId: randomId(),
      userId,
      projectId,
      artifactType,
      model,
      input: {
        prompt,
      },
      outputFormat,
      toolKey,
      workflowType,
      registrySnapshotRef,
    };

    if (idempotencyKey.trim().length > 0) {
      request.idempotencyKey = idempotencyKey.trim();
    }

    onStart(request);
  };

  return (
    <form className="panel grid" onSubmit={onSubmit}>
      <h2>Nuova generazione</h2>

      <label>
        Project ID
        <input value={projectId} onChange={(e) => setProjectId(e.target.value)} required />
      </label>

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
        <input value={model} onChange={(e) => setModel(e.target.value)} required />
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

      <button type="submit" disabled={disabled}>Avvia stream</button>
    </form>
  );
};
