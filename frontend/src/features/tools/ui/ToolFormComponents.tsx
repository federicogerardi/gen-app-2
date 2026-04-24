/**
 * Reusable form components for tool pages
 * Renders common form sections without coupling to specific tools
 */

import type { SupportedTool, ToolStep } from '../machines/tool-flow.machine';
import type { ProjectSummary } from '../../projects/runtime/projects-client';
import type { ToolFormConfig } from '../runtime/tool-form-architecture';

type ProjectSelectorProps = {
  projectId: string;
  onChange: (projectId: string) => void;
  projects: ProjectSummary[];
  loading: boolean;
  error: string | null;
  disabled: boolean;
};

export const ProjectSelector = ({
  projectId,
  onChange,
  projects,
  loading,
  error,
  disabled,
}: ProjectSelectorProps) => (
  <>
    <label>
      Project ID
      <select value={projectId} onChange={e => onChange(e.target.value)} disabled={disabled || loading}>
        <option value="">Select a project</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.id})
          </option>
        ))}
      </select>
    </label>
    {error ? <p className="error-message">{error}</p> : null}
    {loading ? <p className="meta-line">Loading projects...</p> : null}
  </>
);

type BriefingUploadProps = {
  fileName: string | null;
  error: string | null;
  status: 'idle' | 'uploading' | 'extracting' | 'ready';
  onFileSelected: (file: File | null) => Promise<void>;
  disabled: boolean;
};

export const BriefingUpload = ({
  fileName,
  error,
  status,
  onFileSelected,
  disabled,
}: BriefingUploadProps) => (
  <>
    <label>
      Brief file (.docx, .txt, .md)
      <input
        type="file"
        accept=".docx,.txt,.md"
        disabled={disabled || status === 'uploading' || status === 'extracting'}
        onChange={e => onFileSelected(e.target.files?.[0] ?? null)}
      />
    </label>
    {status === 'uploading' ? <p className="meta-line">Uploading briefing...</p> : null}
    {status === 'extracting' ? <p className="meta-line">Extracting information...</p> : null}
    {fileName ? <p className="meta-line">Briefing: {fileName}</p> : null}
    {error ? <p className="error-message">{error}</p> : null}
  </>
);

type GenerationInputsProps = {
  model: string;
  onModelChange: (model: string) => void;
  registrySnapshotRef: string;
  onRegistryRefChange: (ref: string) => void;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  disabled: boolean;
};

export const GenerationInputs = ({
  model,
  onModelChange,
  registrySnapshotRef,
  onRegistryRefChange,
  prompt,
  onPromptChange,
  disabled,
}: GenerationInputsProps) => (
  <>
    <label>
      Model
      <input value={model} onChange={e => onModelChange(e.target.value)} disabled={disabled} />
    </label>

    <label>
      Registry snapshot ref
      <input
        value={registrySnapshotRef}
        onChange={e => onRegistryRefChange(e.target.value)}
        disabled={disabled}
      />
    </label>

    <label>
      Prompt
      <textarea value={prompt} onChange={e => onPromptChange(e.target.value)} rows={5} disabled={disabled} />
    </label>
  </>
);

type StepSelectorProps = {
  config: ToolFormConfig;
  selectedSteps: Set<ToolStep>;
  completedSteps: Set<ToolStep>;
  availableSteps: ToolStep[];
  onToggleStep: (step: ToolStep) => void;
  disabled: boolean;
};

export const StepSelector = ({
  config,
  selectedSteps,
  completedSteps,
  availableSteps,
  onToggleStep,
  disabled,
}: StepSelectorProps) => (
  <fieldset disabled={disabled}>
    <legend>Steps</legend>
    {config.steps.map(step => (
      <label key={step} className="checkbox-row">
        <input
          type="checkbox"
          checked={selectedSteps.has(step)}
          onChange={() => onToggleStep(step)}
          disabled={!availableSteps.includes(step)}
        />
        {step}
        {completedSteps.has(step) ? <span className="meta-line"> ✓ completed</span> : null}
        {!availableSteps.includes(step) && !completedSteps.has(step) ? (
          <span className="meta-line"> (waiting for dependencies)</span>
        ) : null}
      </label>
    ))}
  </fieldset>
);

type FormStatusProps = {
  phase: string;
  extractionLifecycle: string;
  briefingFileName: string | null;
  warnings: string[];
};

export const FormStatus = ({
  phase,
  extractionLifecycle,
  briefingFileName,
  warnings,
}: FormStatusProps) => (
  <div>
    <p className="meta-line">phase: {phase}</p>
    <p className="meta-line">extraction: {extractionLifecycle}</p>
    <p className="meta-line">briefing: {briefingFileName ?? '-'}</p>
    {warnings.map((warning, i) => (
      <p key={i} className="error-message">
        {warning}
      </p>
    ))}
  </div>
);
