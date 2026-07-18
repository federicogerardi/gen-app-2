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
  allowNoFiles?: boolean;
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
  | 'api-acquisition'
  | 'project-asset';

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
 * F-001: Policy entry for project-asset input family (DDD-192).
 * Declares which AssetTypes a tool can consume as input.
 */
export type ToolProjectAssetPolicyEntry = {
  key: string;
  label: string;
  assetType: string;
  requiredness: ToolInputFileRequiredness;
};

/**
 * Tool form state that maps to step dependencies and generation
 */
export type ToolFormState = {
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
  'meta-ads': {
    toolKey: 'meta-ads',
    availabilityPolicy: getToolAvailabilityPolicy('meta-ads'),
    displayName: 'MetaAds Generator',
    defaultPrompt: 'Genera copy Meta Ads ad alta chiarezza strategica a partire dal contesto estratto.',
    defaultModel: 'openrouter/auto',
    steps: TOOL_STEP_ORDER['meta-ads'],
    stepDependencies: TOOL_STEP_DEPENDENCIES['meta-ads'],
    defaults: {
      registrySnapshotRef: 'snapshot:default',
    },
  },
  'youtube-description': {
    toolKey: 'youtube-description',
    availabilityPolicy: getToolAvailabilityPolicy('youtube-description'),
    displayName: 'YT Description Generator',
    defaultPrompt: 'Genera una descrizione YouTube ad alta leggibilita con CTA above-the-fold e struttura SEO completa.',
    defaultModel: 'openrouter/auto',
    steps: TOOL_STEP_ORDER['youtube-description'],
    stepDependencies: TOOL_STEP_DEPENDENCIES['youtube-description'],
    defaults: {
      registrySnapshotRef: 'snapshot:default',
    },
  },
  geometric: {
    toolKey: 'geometric',
    availabilityPolicy: getToolAvailabilityPolicy('geometric'),
    displayName: 'Geometric',
    defaultPrompt: 'Analizza SERP e competitor. Genera report strategico e report unificato in italiano.',
    defaultModel: 'openrouter/auto',
    steps: TOOL_STEP_ORDER.geometric,
    stepDependencies: TOOL_STEP_DEPENDENCIES.geometric,
    defaults: {
      registrySnapshotRef: 'snapshot:default',
    },
  },
  'blog-article-generator': {
    toolKey: 'blog-article-generator',
    availabilityPolicy: getToolAvailabilityPolicy('blog-article-generator'),
    displayName: 'Blog Article Generator',
    defaultPrompt: 'Generate comprehensive blog articles with SEO optimization and in-depth research.',
    defaultModel: 'openrouter/auto',
    steps: TOOL_STEP_ORDER['blog-article-generator'],
    stepDependencies: TOOL_STEP_DEPENDENCIES['blog-article-generator'],
    defaults: {
      registrySnapshotRef: 'snapshot:default',
    },
  },
  'brief-generator': {
    toolKey: 'brief-generator',
    availabilityPolicy: getToolAvailabilityPolicy('brief-generator'),
    displayName: 'Brief Generator',
    defaultPrompt: 'Genera un brief strutturato completo a partire dai dati estratti dal documento.',
    defaultModel: 'openrouter/auto',
    steps: TOOL_STEP_ORDER['brief-generator'],
    stepDependencies: TOOL_STEP_DEPENDENCIES['brief-generator'],
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
  'meta-ads': {
    title: appCopy.ui.toolInstructions.title,
    summary: 'Carica un BriefingFile obbligatorio e, se disponibile, un AngleDetectorFile con insight aggiuntivi.',
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
      'product_or_service',
      'target_audience',
      'campaign_objective',
      'primary_offer',
      'proof_points',
      'dominant_pain_points',
      'objections',
    ],
    optionalFields: [
      'Contesto budget',
      'Awareness priority',
      'Priorita LF8',
      'Meccanismo unico',
      'Angle candidates',
      'Hook varianti',
      'Vincoli legali o compliance',
      'Blacklist claim',
      'Learned insights da campagne precedenti',
    ],
    examples: [
      'Campaign objective: acquisizione lead qualificati con CPL target sostenibile.',
      'Primary offer: consulenza + audit gratuito per attivare la call strategica.',
    ],
    notes: ['Il formato estrazione è markdown con sezioni canoniche e campi non disponibili esplicitati.', 'AngleDetectorFile resta opzionale: se assente la pipeline resta operativa.'],
    stepConstraints: ['La sequenza canonica è context-generation -> ads-generation.'],
  },
  'youtube-description': {
    title: appCopy.ui.toolInstructions.title,
    summary: 'Inserisci i campi diretti del video: il contesto viene costruito senza upload file.',
    inputFiles: [],
    allowNoFiles: true,
    requiredFiles: [],
    requiredFieldKeys: [],
    requiredFields: [
      'Video title',
      'Topic',
      'Keywords',
      'CTA text',
      'CTA link',
      'Credentials or proof',
      'Chapters with timestamps',
    ],
    optionalFields: ['Social links', 'Hashtags', 'Note contestuali', 'Vincoli lessicali', 'Audience nuance'],
    examples: [
      'Keywords: youtube seo, descrizione youtube, aumento watch time.',
      'Chapters with timestamps: 0:00 Hook, 1:35 Metodo, 3:40 CTA.',
    ],
    notes: [
      'Questo tool usa solo direct-input: nessun BriefingFile richiesto.',
      'Timestamps ammessi: m:ss, mm:ss, h:mm:ss.',
    ],
    stepConstraints: ['La sequenza canonica è youtube-description-generation.'],
  },
  geometric: {
    title: appCopy.ui.toolInstructions.title,
    summary: 'Inserisci query, lingua e paese per l\'analisi SERP e il report competitivo.',
    inputFiles: [],
    allowNoFiles: true,
    requiredFiles: [],
    requiredFieldKeys: [],
    requiredFields: ['Base query', 'Language', 'Country'],
    optionalFields: ['Note contestuali', 'Vincoli lessicali', 'Audience nuance'],
    examples: [
      'Base query: supplementi proteici migliori per massa muscolare',
      'Language: it-IT',
      'Country: google.it',
    ],
    notes: [
      'Questo tool usa solo direct-input: nessun BriefingFile richiesto.',
      'I dati SERP vengono raccolti in tempo reale tramite crawling.',
    ],
    stepConstraints: ['La sequenza canonica è serp-crawling -> competitor-scoring -> strategic-reporting -> unified-report.'],
  },
  'blog-article-generator': {
    title: appCopy.ui.toolInstructions.title,
    summary: 'Inserisci il titolo dell\'articolo da generare.',
    inputFiles: [],
    allowNoFiles: true,
    requiredFiles: [],
    requiredFieldKeys: [],
    requiredFields: ['Titolo'],
    optionalFields: [],
    examples: [
      'Titolo: Advanced React patterns for performance optimization',
    ],
    notes: ['Il titolo è l\'unico campo obbligatorio per avviare la generazione.'],
    stepConstraints: ['La sequenza canonica è blog_seo_structure -> blog_research -> blog_article.'],
  },
  'brief-generator': {
    title: appCopy.ui.toolInstructions.title,
    summary: 'Carica un documento con appunti, bullet points o descrizioni. Brief Generator estrae i dati rilevanti e produce un brief strutturato pronto per gli altri tool.',
    inputFiles: [
      {
        key: 'briefing-file',
        label: 'BriefingFile',
        accept: '.txt,.md,.docx',
        requiredness: 'always-required',
      },
    ],
    requiredFiles: ['BriefingFile (.txt, .md, .docx)'],
    requiredFieldKeys: ['product_or_service', 'target_audience', 'campaign_objective', 'primary_offer', 'tone'],
    optionalFields: [],
    examples: [
      'Appunti sparsi su prodotto, target e obiettivi campagna.',
      'Trascrizione di una call commerciale da strutturare in brief formale.',
    ],
    notes: [
      'Il brief in output è compatibile con funnel-pages, meta-ads, angle-generator, youtube-lf-script e nextland.',
    ],
    stepConstraints: [],
  },
};

const validateToolInputFilePolicyRegistry = (
  registry: Record<SupportedTool, ToolFileInstructionsConfig>,
): void => {
  for (const [toolKey, instructions] of Object.entries(registry) as Array<[SupportedTool, ToolFileInstructionsConfig]>) {
    if (instructions.inputFiles.length === 0 && instructions.allowNoFiles !== true) {
      throw new Error(`[tool-form-architecture] ${toolKey}: inputFiles must include at least one file entry`);
    }

    if (instructions.inputFiles.length > 0 && instructions.inputFiles[0]?.requiredness !== 'always-required') {
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
  'meta-ads': appCopy.ui.navigation.metaAds,
  'youtube-description': appCopy.ui.navigation.youtubeDescription,
  'geometric': appCopy.ui.navigation.geometric,
  'blog-article-generator': 'Blog Article Generator',
  'brief-generator': 'Brief Generator',
};

const toolNavigationDescriptionByKey: Record<SupportedTool, string> = {
  'funnel-pages': 'Crea landing page, quiz e VSL per la tua pipeline di acquisizione.',
  nextland: 'Genera le pagine del sito Nextland a partire dal tuo brief di progetto.',
  'youtube-lf-script': 'Produci script video long-form guidato da una struttura passo passo.',
  'angle-generator': 'Prioritizza gli angoli marketing attivabili a partire dal contesto estratto.',
  'meta-ads': 'Produci asset Meta Ads coerenti con contesto, obiettivo campagna e priorita strategiche.',
  'youtube-description': 'Genera descrizioni YouTube complete con CTA iniziale, capitoli e blocchi SEO in un singolo step.',
  'geometric': 'Analizza SERP, scoring competitivo e report strategico unificato in italiano.',
  'blog-article-generator': 'Generate Italian blog articles with SEO optimization and in-depth research.',
  'brief-generator': 'Trasforma documenti grezzi in brief strutturati pronti per la generazione con altri tool.',
};

const toolRouteByKey: Record<SupportedTool, string> = {
  'funnel-pages': '/tools/funnel-pages',
  nextland: '/tools/nextland',
  'youtube-lf-script': '/tools/youtube-lf-script',
  'angle-generator': '/tools/angle-generator',
  'meta-ads': '/tools/meta-ads',
  'youtube-description': '/tools/youtube-description',
  'geometric': '/tools/geometric',
  'blog-article-generator': '/tools/blog-article-generator',
  'brief-generator': '/tools/brief-generator',
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

export const getToolRoute = (toolKey: string | null, workspaceId?: string): string | null => {
  if (toolKey === null) {
    return null;
  }

  const normalizedToolKey = normalizeToolKeyCandidate(toolKey);

  if (workspaceId) {
    const key = normalizedToolKey || toolKey;
    return `/workspaces/${workspaceId}/tools/${key}`;
  }

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
  workspaceId?: string,
): ToolNavigationItem[] => (
  getEnabledToolKeys(role).map((toolKey) => ({
    toolKey,
    to: workspaceId
      ? `/workspaces/${workspaceId}/tools/${toolKey}`
      : toolRouteByKey[toolKey],
    label: toolNavigationLabelByKey[toolKey],
    description: toolNavigationDescriptionByKey[toolKey],
  }  ))
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
  'meta-ads': {
    'context-generation': {
      displayName: 'Context Generation',
      description: 'Consolida il contesto strategico utile alla produzione degli asset Meta Ads',
      expectedOutputFormat: 'Markdown con strategia, messaggi e priorita di attivazione',
    },
    'ads-generation': {
      displayName: 'Ads Generation',
      description: 'Genera i set creativi Meta Ads a partire dal contesto validato',
      expectedOutputFormat: 'Markdown con ad set, varianti e piano di test',
    },
  },
  'youtube-description': {
    'youtube-description-generation': {
      displayName: 'YouTube Description Generation',
      description: 'Genera la descrizione finale con CTA above-the-fold, capitoli e blocchi SEO.',
      expectedOutputFormat: 'Markdown con descrizione completa e quality report',
    },
  },
  'geometric': {
    'serp-crawling': {
      displayName: 'SERP Crawling',
      description: 'Raccolta dati dalla Search Engine Results Page per la query di base e PAA correlate.',
      expectedOutputFormat: 'JSON con snippet AI Overview, sources e PAA queries',
    },
    'competitor-scoring': {
      displayName: 'Competitor Scoring',
      description: 'Analisi e scoring dei competitor su base domini e tipologia di fonti.',
      expectedOutputFormat: 'JSON con ranking competitivo e tier assignment',
    },
    'strategic-reporting': {
      displayName: 'Strategic Reporting',
      description: 'Generazione report strategico qualitativo in italiano dal panorama SERP.',
      expectedOutputFormat: 'Markdown con analisi strategica e raccomandazioni operative',
    },
    'unified-report': {
      displayName: 'Unified Report',
      description: 'Report unificato che combina analisi strategica e scoring quantitativo.',
      expectedOutputFormat: 'Markdown con tabelle competitor, analisi e raccomandazioni',
    },
  },
  'blog-article-generator': {
    'blog_seo_structure': {
      displayName: 'SEO Structure',
      description: 'Generate SEO-optimized article structure with headings and subheadings.',
      expectedOutputFormat: 'Markdown with H1 title and H2 subheadings',
    },
    'blog_research': {
      displayName: 'Research',
      description: 'Conduct in-depth research on the topic with data and statistics.',
      expectedOutputFormat: 'Structured research data per section',
    },
    'blog_article': {
      displayName: 'Article Writing',
      description: 'Write the complete Italian blog article with professional copywriting.',
      expectedOutputFormat: 'Full Italian article in Markdown (~800 words)',
    },
  },
  'brief-generator': {
    'brief-generation': {
      displayName: 'Brief Generation',
      description: 'Trasforma i dati estratti in un brief creativo strutturato e standardizzato pronto per il consumo da parte degli altri tool.',
      expectedOutputFormat: 'Markdown strutturato con tutte le sezioni canoniche del brief',
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
