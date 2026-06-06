/**
 * Reusable form components for tool pages
 * Renders common form sections without coupling to specific tools
 */

import type { ToolStep } from '../machines/tool-flow.machine';
import type { ProjectSummary } from '../../projects/runtime/projects-client';
import type { ToolFormConfig } from '../runtime/tool-form-architecture';
import type { LlmModelOption } from '../runtime/models-client';
import { appCopy, formatMeta } from '../../../app/copy/system';
import { uiPrimitives } from '../../../app/ui/primitives';

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
      {appCopy.ui.labels.projectId}
      <select value={projectId} onChange={e => onChange(e.target.value)} disabled={disabled || loading}>
        <option value="">Select a project</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.id})
          </option>
        ))}
      </select>
    </label>
    {error ? <p className={uiPrimitives.error} role="alert">{error}</p> : null}
    {loading ? <p className={uiPrimitives.metaLine}>{appCopy.ui.states.loadingProjects}</p> : null}
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
      {appCopy.ui.labels.briefFile}
      <input
        type="file"
        accept=".docx,.txt,.md"
        disabled={disabled || status === 'uploading' || status === 'extracting'}
        onChange={e => onFileSelected(e.target.files?.[0] ?? null)}
      />
    </label>
    {status === 'uploading' ? <p className={uiPrimitives.metaLine}>{appCopy.ui.states.uploadingBriefing}</p> : null}
    {status === 'extracting' ? <p className={uiPrimitives.metaLine}>{appCopy.ui.states.extractingInformation}</p> : null}
    {fileName ? <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.briefing, fileName)}</p> : null}
    {error ? <p className={uiPrimitives.error} role="alert">{error}</p> : null}
  </>
);

type GenerationInputsProps = {
  model: string;
  onModelChange: (model: string) => void;
  modelOptions: LlmModelOption[];
  registrySnapshotRef: string;
  onRegistryRefChange: (ref: string) => void;
  disabled: boolean;
};

export const GenerationInputs = ({
  model,
  onModelChange,
  modelOptions,
  registrySnapshotRef,
  onRegistryRefChange,
  disabled,
}: GenerationInputsProps) => (
  <>
    <label>
      {appCopy.ui.labels.model}
      <select value={model} onChange={e => onModelChange(e.target.value)} disabled={disabled}>
        {modelOptions.length === 0 ? (
          <option value={model} disabled>{model || 'No models available'}</option>
        ) : (
          modelOptions.map(o => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))
        )}
      </select>
    </label>

    <label>
      {appCopy.ui.labels.registrySnapshotRef}
      <input
        value={registrySnapshotRef}
        onChange={e => onRegistryRefChange(e.target.value)}
        disabled={disabled}
      />
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
    <legend>{config.displayName} steps</legend>
    {config.steps.map(step => (
      <label key={step} className={uiPrimitives.checkboxRow}>
        <input
          type="checkbox"
          checked={selectedSteps.has(step)}
          onChange={() => onToggleStep(step)}
          disabled={!availableSteps.includes(step)}
        />
        {step}
        {completedSteps.has(step) ? <span className={uiPrimitives.metaLine}> ✓ {appCopy.ui.states.completed}</span> : null}
        {!availableSteps.includes(step) && !completedSteps.has(step) ? (
          <span className={uiPrimitives.metaLine}> (waiting for dependencies)</span>
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
    <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.phase, phase)}</p>
    <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.extraction, extractionLifecycle)}</p>
    <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.briefing, briefingFileName ?? '-')}</p>
    {warnings.map((warning, i) => (
      <p key={i} className={uiPrimitives.error} role="alert">
        {warning}
      </p>
    ))}
  </div>
);
