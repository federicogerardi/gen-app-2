/**
 * Centralized tool form configuration and contracts
 * Enables scalable, reusable form construction for multi-step tools
 */

import {
  canRoleAccessToolKey,
  getToolAvailabilityPolicy,
  TOOL_STEP_DEPENDENCIES,
  TOOL_STEP_ORDER,
  type ToolAccessRole,
  type ToolAvailabilityPolicy,
  normalizeToolKeyCandidate,
} from '@gen-app-2/contracts';
import { appCopy } from '../../../app/copy/system';
import type { ToolStep, SupportedTool } from '../machines/tool-flow.machine';
import type { ExtractionFieldKey } from './extraction-field-matrix';

/**
 * Configuration for a tool page form
 * Declares what each tool needs without implementation coupling
 */
export type ToolFormConfig = {
  toolKey: SupportedTool;
  availabilityPolicy: ToolAvailabilityPolicy;
  displayName: string;
  
  // Tool-specific prompts
  defaultPrompt: string;
  defaultModel: string;
  
  // Step workflow definition
  steps: readonly ToolStep[];
  stepDependencies: Partial<Record<ToolStep, readonly ToolStep[]>>;
  
  // Default form values
  defaults: {
    registrySnapshotRef: string;
  };
};

export type ToolFileInstructionsConfig = {
  title: string;
  summary: string;
  inputFiles: readonly ToolInputFilePolicyEntry[];
  apiAcquisitionInputs?: readonly ToolApiAcquisitionPolicyEntry[];
  // Deprecated alias retained for one deprecation cycle.
  requiredFiles: readonly string[];
  requiredFieldKeys: readonly ExtractionFieldKey[];
  // Deprecated alias retained for one deprecation cycle.
  requiredFields?: readonly string[];
  optionalFields: readonly string[];
  examples: readonly string[];
  notes: readonly string[];
  stepConstraints: readonly string[];
};

export type ToolInputFileRequiredness =
  | 'always-required'
  | 'required-by-tool-setting'
  | 'optional-by-tool-setting';

export type ToolInputSourceFamily =
  | 'direct-input'
  | 'tool-input-file'
  | 'api-acquisition';

export type ToolInputFilePolicyEntry = {
  key: string;
  label: string;
  accept: string;
  requiredness: ToolInputFileRequiredness;
};

export type ToolApiAcquisitionPolicyEntry = {
  key: string;
  label: string;
  requiredness: ToolInputFileRequiredness;
};

/**
 * Tool form state that maps to step dependencies and generation
 */
export type ToolFormState = {
  projectId: string;
  model: string;
  tone: string;
  registrySnapshotRef: string;
  briefingFile: File | null;
  briefingFileName: string | null;
  briefingError: string | null;
  briefingStatus: 'idle' | 'uploading' | 'extracting' | 'ready';
  selectedSteps: Set<ToolStep>;
  stepArtifactIds: Partial<Record<ToolStep, string>>;
};

/**
 * Registry of all supported tool configurations
 * Add new tools by registering here
 */
export const toolFormRegistry: Record<SupportedTool, ToolFormConfig> = {
  'funnel-pages': {
    toolKey: 'funnel-pages',
    availabilityPolicy: getToolAvailabilityPolicy('funnel-pages'),
    displayName: 'Hotlead Funnel',
    defaultPrompt: 'Genera lo step Funnel richiesto con coerenza al brief estratto.',
    defaultModel: 'openrouter/auto',
    steps: TOOL_STEP_ORDER['funnel-pages'],
    stepDependencies: TOOL_STEP_DEPENDENCIES['funnel-pages'],
    defaults: {
      registrySnapshotRef: 'snapshot:default',
    },
  },
  nextland: {
    toolKey: 'nextland',
    availabilityPolicy: getToolAvailabilityPolicy('nextland'),
    displayName: 'Nextland',
    defaultPrompt: 'Genera lo step Nextland richiesto con coerenza al brief estratto.',
    defaultModel: 'openrouter/auto',
    steps: TOOL_STEP_ORDER.nextland,
    stepDependencies: TOOL_STEP_DEPENDENCIES.nextland,
    defaults: {
      registrySnapshotRef: 'snapshot:default',
    },
  },
  'youtube-lf-script': {
    toolKey: 'youtube-lf-script',
    availabilityPolicy: getToolAvailabilityPolicy('youtube-lf-script'),
    displayName: 'YouTube LF Script',
    defaultPrompt: 'Genera lo step YouTube LF Script richiesto con coerenza al brief estratto.',
    defaultModel: 'openrouter/auto',
    steps: TOOL_STEP_ORDER['youtube-lf-script'],
    stepDependencies: TOOL_STEP_DEPENDENCIES['youtube-lf-script'],
    defaults: {
      registrySnapshotRef: 'snapshot:default',
    },
  },
  'angle-generator': {
    toolKey: 'angle-generator',
    availabilityPolicy: getToolAvailabilityPolicy('angle-generator'),
    displayName: 'Angle Generator',
    defaultPrompt: 'Genera angoli marketing prioritizzati e attivabili a partire dal contesto estratto.',
    defaultModel: 'openrouter/auto',
    steps: TOOL_STEP_ORDER['angle-generator'],
    stepDependencies: TOOL_STEP_DEPENDENCIES['angle-generator'],
    defaults: {
      registrySnapshotRef: 'snapshot:default',
    },
  },
};

export const toolFileInstructionsRegistry: Record<SupportedTool, ToolFileInstructionsConfig> = {
  'funnel-pages': {
    title: appCopy.ui.toolInstructions.title,
    summary: 'Carica un solo BriefingFile completo: il funnel viene costruito a partire da obiettivo, target e offerta.',
    inputFiles: [
      {
        key: 'briefing-file',
        label: 'BriefingFile',
        accept: '.docx,.txt,.md',
        requiredness: 'always-required',
      },
    ],
    requiredFiles: ['BriefingFile (.docx, .txt, .md)'],
    requiredFieldKeys: ['funnel_goal', 'target_audience', 'offer', 'proof', 'primary_cta'],
    optionalFields: ['Vincoli di tono', 'Riferimenti visual', 'Esempi di competitor', 'Note sul funnel attuale'],
    examples: [
      'Obiettivo: generare lead qualificati per il prodotto principale.',
      'Target: imprenditori e marketer che cercano una landing ad alta conversione.',
    ],
    notes: ['Se un campo non è disponibile, scrivi "non disponibile" invece di ometterlo.'],
    stepConstraints: ['Gli step optin, quiz e vsl devono restare coerenti con lo stesso brief.'],
  },
  nextland: {
    title: appCopy.ui.toolInstructions.title,
    summary: 'Usa un BriefingFile ordinato e descrittivo per definire sito, sezioni e risultato atteso.',
    inputFiles: [
      {
        key: 'briefing-file',
        label: 'BriefingFile',
        accept: '.docx,.txt,.md',
        requiredness: 'always-required',
      },
    ],
    requiredFiles: ['BriefingFile (.docx, .txt, .md)'],
    requiredFieldKeys: ['website_goal', 'brand_or_company', 'target_audience', 'offer_or_service', 'required_sections'],
    optionalFields: ['Tone of voice', 'Referenze di stile', 'Vincoli di copy', 'Materiali già esistenti'],
    examples: [
      'Obiettivo: presentare il brand e portare l’utente alla pagina contatto.',
      'Sezioni richieste: hero, proof, servizi, CTA finale.',
    ],
    notes: ['Indica chiaramente quali pagine o blocchi devono essere prodotti.', 'Evita richieste implicite: la pagina deve poter essere ricostruita solo dal brief.'],
    stepConstraints: ['Gli step landing e thank_you devono usare la stessa base informativa del BriefingFile.'],
  },
  'youtube-lf-script': {
    title: appCopy.ui.toolInstructions.title,
    summary: 'Compila il brief con i campi canonici richiesti per l’estrazione e la generazione dello script long-form.',
    inputFiles: [
      {
        key: 'briefing-file',
        label: 'BriefingFile',
        accept: '.docx,.txt,.md',
        requiredness: 'always-required',
      },
    ],
    requiredFiles: ['BriefingFile (.docx, .txt, .md)'],
    requiredFieldKeys: [
      'knowledge_content',
      'avatar',
      'pain_point',
      'purchase_process_type',
      'offer',
      'proof',
      'target_duration_minutes',
      'proprietary_methodology_disclosure',
    ],
    optionalFields: ['Link o riferimenti di supporto', 'Note sul posizionamento', 'Vincoli editoriali'],
    examples: [
      'knowledge_content: punti chiave della conoscenza da trasformare in script.',
      'target_duration_minutes: 12.',
    ],
    notes: ['I campi mancanti devono essere espliciti e valorizzati a null nel payload estratto.', 'Il tone del brief non sostituisce il ToneProfile di generazione.'],
    stepConstraints: ['La sequenza canonica è pre-script-analysis -> packaging -> intro-structure -> body-structure -> native-cta-embeds -> outro-structure.'],
  },
  'angle-generator': {
    title: appCopy.ui.toolInstructions.title,
    summary: 'Carica un BriefingFile obbligatorio e, se disponibile, un AngleDetectorFile complementare.',
    inputFiles: [
      {
        key: 'briefing-file',
        label: 'BriefingFile',
        accept: '.docx,.txt,.md',
        requiredness: 'always-required',
      },
      {
        key: 'angle-detector-file',
        label: 'AngleDetectorFile',
        accept: '.docx,.txt,.md',
        requiredness: 'optional-by-tool-setting',
      },
    ],
    requiredFiles: ['BriefingFile (.docx, .txt, .md)'],
    requiredFieldKeys: [
      'goal',
      'product_or_service',
      'market',
      'target_audience',
      'pain_point',
      'offer',
      'proof',
      'creative_constraints',
    ],
    optionalFields: ['Tone of voice', 'Esempi di angoli già usati', 'Benchmark o competitor', 'Note strategiche'],
    examples: [
      'Briefing: descrizione del brand e del prodotto da posizionare.',
      'Angle detector: insight di mercato e segnali competitivi da confrontare con il brief.',
    ],
    notes: ['Se carichi entrambi i file, devono descrivere lo stesso contesto di lavoro.', 'AngleDetectorFile arricchisce il contesto ma non blocca la generazione se assente.'],
    stepConstraints: ['La sequenza canonica è context-and-angle-matrix -> angle-prioritization -> creative-activation.'],
  },
};

const validateToolInputFilePolicyRegistry = (
  registry: Record<SupportedTool, ToolFileInstructionsConfig>,
): void => {
  for (const [toolKey, instructions] of Object.entries(registry) as Array<[SupportedTool, ToolFileInstructionsConfig]>) {
    if (instructions.inputFiles.length === 0) {
      throw new Error(`[tool-form-architecture] ${toolKey}: inputFiles must include at least one file entry`);
    }

    if (instructions.inputFiles[0]?.requiredness !== 'always-required') {
      throw new Error(`[tool-form-architecture] ${toolKey}: inputFiles[0] must be always-required`);
    }

    const invalidFile = instructions.inputFiles.find((entry, index) => {
      if (!entry.requiredness) {
        return true;
      }

      if (!entry.key.trim() || !entry.label.trim() || !entry.accept.trim()) {
        return true;
      }

      if (index === 0) {
        return entry.requiredness !== 'always-required';
      }

      return entry.requiredness !== 'required-by-tool-setting' && entry.requiredness !== 'optional-by-tool-setting';
    });

    if (invalidFile) {
      throw new Error(`[tool-form-architecture] ${toolKey}: invalid inputFiles entry detected`);
    }
  }
};

validateToolInputFilePolicyRegistry(toolFileInstructionsRegistry);

export const getEnabledToolKeys = (role: ToolAccessRole = 'member'): SupportedTool[] => {
  return (Object.keys(toolFormRegistry) as SupportedTool[]).filter(
    (toolKey) => canRoleAccessToolKey(toolKey, role),
  );
};

export const getToolInputFilePolicy = (
  toolKey: SupportedTool,
): readonly ToolInputFilePolicyEntry[] => toolFileInstructionsRegistry[toolKey].inputFiles;

export const getRequiredToolInputFiles = (
  toolKey: SupportedTool,
): readonly ToolInputFilePolicyEntry[] => getToolInputFilePolicy(toolKey).filter((entry) => (
  entry.requiredness === 'always-required' || entry.requiredness === 'required-by-tool-setting'
));

export const getToolApiAcquisitionPolicy = (
  toolKey: SupportedTool,
): readonly ToolApiAcquisitionPolicyEntry[] => toolFileInstructionsRegistry[toolKey].apiAcquisitionInputs ?? [];

export const isToolEnabled = (
  toolKey: SupportedTool,
  role: ToolAccessRole = 'member',
): boolean => {
  return canRoleAccessToolKey(toolKey, role);
};

export type ToolNavigationItem = {
  toolKey: SupportedTool;
  to: string;
  label: string;
  description: string;
};

const toolNavigationLabelByKey: Record<SupportedTool, string> = {
  'funnel-pages': appCopy.ui.navigation.funnelPages,
  nextland: appCopy.ui.navigation.nextland,
  'youtube-lf-script': appCopy.ui.navigation.youtubeLfScript,
  'angle-generator': appCopy.ui.navigation.angleGenerator,
};

const toolNavigationDescriptionByKey: Record<SupportedTool, string> = {
  'funnel-pages': 'Crea landing page, quiz e VSL per la tua pipeline di acquisizione.',
  nextland: 'Genera le pagine del sito Nextland a partire dal tuo brief di progetto.',
  'youtube-lf-script': 'Produci script video long-form guidato da una struttura passo passo.',
  'angle-generator': 'Prioritizza gli angoli marketing attivabili a partire dal contesto estratto.',
};

const toolRouteByKey: Record<SupportedTool, string> = {
  'funnel-pages': '/tools/funnel-pages',
  nextland: '/tools/nextland',
  'youtube-lf-script': '/tools/youtube-lf-script',
  'angle-generator': '/tools/angle-generator',
};

export const getToolLabel = (toolKey: string | null): string => {
  if (toolKey === null) {
    return '—';
  }

  const normalizedToolKey = normalizeToolKeyCandidate(toolKey);
  if (normalizedToolKey && normalizedToolKey in toolNavigationLabelByKey) {
    return toolNavigationLabelByKey[normalizedToolKey as SupportedTool];
  }

  if (toolKey in toolNavigationLabelByKey) {
    return toolNavigationLabelByKey[toolKey as SupportedTool];
  }

  return toolKey;
};

export const getToolRoute = (toolKey: string | null): string | null => {
  if (toolKey === null) {
    return null;
  }

  const normalizedToolKey = normalizeToolKeyCandidate(toolKey);
  if (normalizedToolKey && normalizedToolKey in toolRouteByKey) {
    return toolRouteByKey[normalizedToolKey as SupportedTool];
  }

  if (toolKey in toolRouteByKey) {
    return toolRouteByKey[toolKey as SupportedTool];
  }

  return null;
};

export const getEnabledToolNavigationItems = (
  role: ToolAccessRole = 'member',
): ToolNavigationItem[] => (
  getEnabledToolKeys(role).map((toolKey) => ({
    toolKey,
    to: toolRouteByKey[toolKey],
    label: toolNavigationLabelByKey[toolKey],
    description: toolNavigationDescriptionByKey[toolKey],
  }))
);

/**
 * Get config for a tool
 */
export const getToolFormConfig = (toolKey: SupportedTool): ToolFormConfig => {
  const config = toolFormRegistry[toolKey];
  if (!config) {
    throw new Error(`Unknown tool: ${toolKey}`);
  }
  return config;
};

/**
 * Calculate which steps can be generated based on dependencies
 */
export const getAvailableSteps = (
  toolKey: SupportedTool,
  completedSteps: Set<ToolStep>,
): ToolStep[] => {
  const config = getToolFormConfig(toolKey);
  return config.steps.filter(step => {
    if (completedSteps.has(step)) {
      return false;
    }

    const deps = config.stepDependencies[step] ?? [];
    return deps.every(dep => completedSteps.has(dep));
  });
};

/**
 * Step card metadata: description and expected output format per step
 * Used by ToolStepCard for rendering
 */
export type StepCardConfig = {
  displayName: string;
  description: string;
  expectedOutputFormat: string; // e.g., "Landing page HTML", "Quiz structure"
};

/**
 * Mapping of step metadata for UI rendering
 * Extend this record when adding new tools
 */
export const stepCardConfigRegistry: Record<
  SupportedTool,
  Partial<Record<ToolStep, StepCardConfig>>
> = {
  'funnel-pages': {
    optin: {
      displayName: 'Opt-In Page',
      description: 'Landing page to capture email addresses',
      expectedOutputFormat: 'HTML page with form',
    },
    quiz: {
      displayName: 'Quiz Page',
      description: 'Interactive quiz to segment leads',
      expectedOutputFormat: 'Multi-step quiz with logic',
    },
    vsl: {
      displayName: 'Video Sales Letter',
      description: 'Long-form video sales page',
      expectedOutputFormat: 'HTML with VSL embed placeholder',
    },
  },
  nextland: {
    landing: {
      displayName: 'Landing Page',
      description: 'Marketing landing page',
      expectedOutputFormat: 'Complete landing page HTML',
    },
    thank_you: {
      displayName: 'Thank You Page',
      description: 'Post-conversion thank you page',
      expectedOutputFormat: 'HTML thank you page',
    },
  },
  'youtube-lf-script': {
    'pre-script-analysis': {
      displayName: 'Pre-Script Analysis',
      description: 'Strategic business and positioning analysis before script drafting',
      expectedOutputFormat: 'Structured markdown analysis',
    },
    packaging: {
      displayName: 'Packaging',
      description: 'Title strategy and visual hooks aligned with positioning',
      expectedOutputFormat: 'Markdown with title candidates and recommended angle',
    },
    'intro-structure': {
      displayName: 'Intro Structure',
      description: 'Retention-first intro flow with trust and contrarian setup',
      expectedOutputFormat: 'Markdown intro checkpoint structure',
    },
    'body-structure': {
      displayName: 'Body Structure',
      description: 'Core narrative flow with value loops and rehook cadence',
      expectedOutputFormat: 'Markdown body block framework',
    },
    'native-cta-embeds': {
      displayName: 'Native CTA Embeds',
      description: 'Contextual CTA placements integrated into educational flow',
      expectedOutputFormat: 'Markdown CTA placement plan',
    },
    'outro-structure': {
      displayName: 'Outro Structure',
      description: 'Final recap, gap closure, and CTA finale',
      expectedOutputFormat: 'Markdown outro framework',
    },
  },
  'angle-generator': {
    'context-and-angle-matrix': {
      displayName: 'Context and Angle Matrix',
      description: 'Mappa contesto e costruisce la matrice degli angle rilevanti',
      expectedOutputFormat: 'Markdown con matrice angle strutturata',
    },
    'angle-prioritization': {
      displayName: 'Angle Prioritization',
      description: 'Valuta e priorizza gli angle in base a impatto e differenziazione',
      expectedOutputFormat: 'Markdown con ranking e motivazioni',
    },
    'creative-activation': {
      displayName: 'Creative Activation',
      description: 'Trasforma gli angle prioritari in asset creativi attivabili',
      expectedOutputFormat: 'Markdown con headline e attivazioni creative',
    },
  },
};

/**
 * Get step card metadata for rendering
 */
export const mapToolStepToCardConfig = (
  toolKey: SupportedTool,
  step: ToolStep,
): StepCardConfig => {
  const stepConfig = stepCardConfigRegistry[toolKey]?.[step];
  if (!stepConfig) {
    // Fallback for unmapped steps
    return {
      displayName: step,
      description: `Generate ${step}`,
      expectedOutputFormat: 'Generated content',
    };
  }
  return stepConfig;
};
