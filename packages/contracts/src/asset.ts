/**
 * Asset Domain Model — Cross-Context Contracts
 *
 * Single authoritative source for Asset-related types shared between
 * Frontend and Backend. DDD-188 through DDD-207.
 *
 * DDD canonical terms:
 *   - AssetType (DDD-199): semantic content classification
 *   - AssetSource (DDD-190): origin classification
 *   - AssetStatus (DDD-191): lifecycle state
 *   - AssetGroupUsage (DDD-195): group consumption mode
 *   - ToolAssetContract (DDD-200): tool produces/consumes declaration
 *   - AssetCompatibilityMatrix (DDD-201): derived compatibility queries
 *   - AssetFieldMapping (DDD-207): structured injection rules
 *   - AssetReference (DDD-189): transport reference type
 *   - AssetInjectionDirective (DDD-193): prompt injection specification
 *
 * References:
 *   - DDD-023: @gen-app-2/contracts is the single authoritative FE source
 *   - DDD-199: AssetType authority lives here
 *   - DDD-200: ToolAssetContract authority lives here
 *   - DDD-207: AssetFieldMapping authority lives here
 */

import type { ToolKey } from './tool-workflows';

// =====================================================================
// A-001: AssetType (DDD-199)
// =====================================================================

/**
 * Canonical AssetType values — semantic content classification for Assets.
 * The bridge between producing and consuming Tools.
 *
 * DDD-199: AssetType is the semantic bridge; a Tool declares produces/consumes
 * via ToolAssetContract (DDD-200).
 */
export const ASSET_TYPES = [
  'angle',
  'persona',
  'brand-voice',
  'hook',
  'competitor-analysis',
  'creative-brief',
  'ad-copy',
  'landing-page',
  'article-outline',
  'article',
  'script',
  'description',
  'brief',
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export const isAssetType = (value: string): value is AssetType =>
  (ASSET_TYPES as readonly string[]).includes(value);

// =====================================================================
// A-002: AssetSource, AssetStatus, AssetGroupUsage (DDD-190, 191, 195)
// =====================================================================

/**
 * AssetSource — origin classification (DDD-190).
 * Immutable after creation.
 */
export type AssetSource = 'generated' | 'uploaded' | 'manual';

/**
 * AssetStatus — lifecycle state (DDD-191).
 * 'active' = selectable as input; 'archived' = hidden but preserved.
 */
export type AssetStatus = 'active' | 'archived';

/**
 * AssetGroupUsage — how a group is consumed by a Tool (DDD-195).
 * 'individual' = iterate per Asset; 'bundled' = combine all into one context.
 */
export type AssetGroupUsage = 'individual' | 'bundled';

// =====================================================================
// A-003: ToolAssetContract (DDD-200)
// =====================================================================

/**
 * A single consumes entry: an AssetType, optionally suffixed with '?' to mark
 * it as optional (not required to start the tool).
 *
 * DDD-200: '?' suffix convention is parsed by parseConsumesEntry.
 */
export type ToolAssetContractConsumesEntry = AssetType | `${AssetType}?`;

/**
 * Declares which AssetType values a Tool produces and consumes.
 * '?' suffix in consumes means optional (not required to start).
 *
 * DDD-200: ToolAssetContract is the cornerstone of the capability mesh.
 */
export type ToolAssetContract = {
  produces: AssetType[];
  consumes: ToolAssetContractConsumesEntry[];
};

/**
 * Static ToolAssetContract registry — one entry per ToolKey.
 * Consumes entries without '?' are required; with '?' are optional.
 *
 * DDD-200: contract is static, defined in shared contracts package.
 */
export const TOOL_ASSET_CONTRACTS: Record<ToolKey, ToolAssetContract> = {
  'funnel-pages': {
    produces: ['landing-page'],
    consumes: ['persona', 'brand-voice', 'brief', 'angle'],
  },
  nextland: {
    produces: ['landing-page'],
    consumes: ['persona', 'brand-voice', 'competitor-analysis', 'brief'],
  },
  'youtube-lf-script': {
    produces: ['script'],
    consumes: ['persona', 'brand-voice', 'competitor-analysis', 'brief'],
  },
  'angle-generator': {
    produces: ['angle'],
    consumes: ['brief', 'persona?', 'competitor-analysis?'],
  },
  'meta-ads': {
    produces: ['ad-copy', 'hook'],
    consumes: ['angle', 'persona', 'brand-voice', 'hook', 'brief'],
  },
  'youtube-description': {
    produces: ['description'],
    consumes: ['brand-voice'],
  },
  geometric: {
    produces: ['competitor-analysis'],
    consumes: [],
  },
  'blog-article-generator': {
    produces: ['article-outline', 'article'],
    consumes: [],
  },
  'brief-generator': {
    produces: ['brief'],
    consumes: [],
  },
  'tov-generator': {
    produces: ['brand-voice'],
    consumes: [],
  },
  'personas-generator': {
    produces: ['persona'],
    consumes: ['brief', 'competitor-analysis?'],
  },
};

// =====================================================================
// A-004: AssetCompatibilityMatrix (DDD-201)
// =====================================================================

/**
 * Parse a consumes entry: 'angle' → { type: 'angle', required: true },
 * 'persona?' → { type: 'persona', required: false }.
 */
const parseConsumesEntry = (
  entry: string,
): { type: AssetType; required: boolean } => {
  const optional = entry.endsWith('?');
  const type = (optional ? entry.slice(0, -1) : entry) as AssetType;
  return { type, required: !optional };
};

/**
 * Given an AssetType, return all Tools that can consume it.
 *
 * DDD-201: getCompatibleConsumerTools(assetType) → ToolKey[]
 */
export const getCompatibleConsumerTools = (assetType: AssetType): ToolKey[] => {
  const consumers: ToolKey[] = [];
  for (const toolKey of Object.keys(TOOL_ASSET_CONTRACTS) as ToolKey[]) {
    const contract = TOOL_ASSET_CONTRACTS[toolKey];
    for (const entry of contract.consumes) {
      const { type } = parseConsumesEntry(entry);
      if (type === assetType) {
        consumers.push(toolKey);
        break;
      }
    }
  }
  return consumers;
};

/**
 * Given a ToolKey, return which AssetTypes it accepts, split by required/optional.
 *
 * DDD-201: getCompatibleAssetTypes(toolKey) → { required, optional }
 */
export const getCompatibleAssetTypes = (
  toolKey: ToolKey,
): { required: AssetType[]; optional: AssetType[] } => {
  const contract = TOOL_ASSET_CONTRACTS[toolKey];
  const required: AssetType[] = [];
  const optional: AssetType[] = [];

  for (const entry of contract.consumes) {
    const parsed = parseConsumesEntry(entry);
    if (parsed.required) {
      required.push(parsed.type);
    } else {
      optional.push(parsed.type);
    }
  }

  return { required, optional };
};

/**
 * Given a ToolKey, return which AssetTypes it produces.
 *
 * DDD-201: getProducedAssetTypes(toolKey) → AssetType[]
 */
export const getProducedAssetTypes = (toolKey: ToolKey): AssetType[] => {
  return [...TOOL_ASSET_CONTRACTS[toolKey].produces];
};

/**
 * Given two ToolKeys, return which AssetTypes connect them
 * (produced by fromToolKey, consumable by toToolKey).
 *
 * DDD-201: getToolProductionChain(from, to) → AssetType[]
 */
export const getToolProductionChain = (
  fromToolKey: ToolKey,
  toToolKey: ToolKey,
): AssetType[] => {
  const produced = getProducedAssetTypes(fromToolKey);
  const { required, optional } = getCompatibleAssetTypes(toToolKey);
  const consumable = new Set([...required, ...optional]);
  return produced.filter((type) => consumable.has(type));
};

// =====================================================================
// A-005: AssetFieldMapping (DDD-207)
// =====================================================================

/**
 * One field extraction rule for structured Asset injection.
 *
 * DDD-207: sourcePath extracts from Asset content; injectionTemplate
 * is a Markdown snippet with {{fieldKey}} placeholders.
 */
export type AssetFieldMappingEntry = {
  sourcePath: string;
  injectionTemplate: string;
  required: boolean;
};

/**
 * AssetFieldMapping — structured extraction rules per (assetType, toolKey).
 * Key convention: '{sourceAssetType}→{targetToolKey}'.
 *
 * DDD-207: authority lives in packages/contracts alongside ToolAssetContract.
 */
export type AssetFieldMapping = Record<string, AssetFieldMappingEntry>;

/**
 * Placeholder AssetFieldMapping entries for initial tool pairs.
 * These will be expanded as tools are integrated.
 */
export const ASSET_FIELD_MAPPINGS: Record<string, AssetFieldMapping> = {
  'angle→meta-ads': {
    title: {
      sourcePath: 'title',
      injectionTemplate: '## Angle: {{title}}',
      required: true,
    },
    hook: {
      sourcePath: 'hook',
      injectionTemplate: '### Primary Hook: {{hook}}',
      required: true,
    },
    targetPersona: {
      sourcePath: 'targetPersona',
      injectionTemplate: '### Target Audience: {{targetPersona}}',
      required: false,
    },
  },
  'persona→meta-ads': {
    name: {
      sourcePath: 'name',
      injectionTemplate: '## Persona: {{name}}',
      required: true,
    },
    painPoints: {
      sourcePath: 'painPoints',
      injectionTemplate: '### Pain Points: {{painPoints}}',
      required: true,
    },
    desires: {
      sourcePath: 'desires',
      injectionTemplate: '### Desired Outcomes: {{desires}}',
      required: false,
    },
  },
  'brand-voice→meta-ads': {
    tone: {
      sourcePath: 'tone',
      injectionTemplate: '## Brand Tone: {{tone}}',
      required: true,
    },
    guidelines: {
      sourcePath: 'guidelines',
      injectionTemplate: '### Voice Guidelines: {{guidelines}}',
      required: false,
    },
  },
  'brand-voice→funnel-pages': {
    tone: {
      sourcePath: 'tone',
      injectionTemplate: '## Brand Tone: {{tone}}',
      required: true,
    },
    guidelines: {
      sourcePath: 'guidelines',
      injectionTemplate: '### Voice Guidelines: {{guidelines}}',
      required: false,
    },
  },
  'brand-voice→nextland': {
    tone: {
      sourcePath: 'tone',
      injectionTemplate: '## Brand Tone: {{tone}}',
      required: true,
    },
    guidelines: {
      sourcePath: 'guidelines',
      injectionTemplate: '### Voice Guidelines: {{guidelines}}',
      required: false,
    },
  },
  'brand-voice→youtube-lf-script': {
    tone: {
      sourcePath: 'tone',
      injectionTemplate: '## Brand Tone: {{tone}}',
      required: true,
    },
    guidelines: {
      sourcePath: 'guidelines',
      injectionTemplate: '### Voice Guidelines: {{guidelines}}',
      required: false,
    },
  },
  'brand-voice→youtube-description': {
    tone: {
      sourcePath: 'tone',
      injectionTemplate: '## Brand Tone: {{tone}}',
      required: true,
    },
    guidelines: {
      sourcePath: 'guidelines',
      injectionTemplate: '### Voice Guidelines: {{guidelines}}',
      required: false,
    },
  },
};

/**
 * Resolve a field mapping by key (e.g., 'angle→meta-ads').
 * Returns the mapping if found, null otherwise.
 */
export const resolveFieldMapping = (
  fieldMappingKey: string,
): AssetFieldMapping | null => {
  return ASSET_FIELD_MAPPINGS[fieldMappingKey] ?? null;
};

// =====================================================================
// A-006: AssetReference, AssetInjectionDirective (DDD-189, 193)
// =====================================================================

/**
 * AssetReference — transport type for Asset usage in GenerationRequest.
 * xor: exactly one of assetId / assetGroupId must be set.
 *
 * DDD-189: carried in GenerationRequest.input.assetReferences.
 */
export type AssetReference = {
  assetId?: string;
  assetGroupId?: string;
  sourceToolKey: ToolKey;
  usageIntent: 'input' | 'injection';
};

/**
 * Validate an AssetReference: xor constraint on assetId/assetGroupId.
 */
export const isValidAssetReference = (ref: AssetReference): boolean => {
  const hasAssetId = ref.assetId != null && ref.assetId.length > 0;
  const hasGroupId = ref.assetGroupId != null && ref.assetGroupId.length > 0;
  return hasAssetId !== hasGroupId; // xor
};

/**
 * AssetInjectionDirective — specifies how an Asset is injected into a step.
 *
 * DDD-193: resolved at prompt assembly time by backend prompt resolver.
 */
export type AssetInjectionDirective = {
  assetId: string;
  stepKey: string;
  injectionMode: 'prepend' | 'append' | 'replace';
  fieldMappingKey?: string;
};

// =====================================================================
// A-007: ToolInputSourceFamily extension (DDD-192)
// =====================================================================

/**
 * Extended ToolInputSourceFamily with 'project-asset' value.
 *
 * DDD-192: extends ToolInputSourceFamily (DDD-106) with Asset-based input.
 * This type re-declares the full union for contracts-level authority;
 * Frontend tool-form-architecture.ts mirrors this definition.
 */
export type AssetToolInputSourceFamily =
  | 'direct-input'
  | 'tool-input-file'
  | 'api-acquisition'
  | 'project-asset';

// =====================================================================
// Derived Types — row mapping helpers (for backend use)
// =====================================================================

/**
 * Asset DTO — the shape returned by API endpoints.
 * Matches DDD-188 core fields.
 */
export type AssetDto = {
  assetId: string;
  projectId: string;
  assetType: AssetType;
  source: AssetSource;
  sourceArtifactId: string | null;
  status: AssetStatus;
  content: string;
  label: string;
  currentVersion: number;
  staleUpstream: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * AssetGroup DTO — the shape returned by API endpoints.
 * Matches DDD-194 core fields.
 */
export type AssetGroupDto = {
  groupId: string;
  projectId: string;
  label: string;
  assetIds: string[];
  groupUsage: AssetGroupUsage;
  createdAt: string;
  updatedAt: string;
};

/**
 * AssetVersion DTO — immutable version snapshot.
 * Matches DDD-196 shape.
 */
export type AssetVersionDto = {
  versionNumber: number;
  assetId: string;
  content: string;
  sourceArtifactId: string | null;
  createdAt: string;
};

/**
 * AssetDerivationChain DTO — genealogical link.
 * Matches DDD-197 core fields.
 */
export type AssetDerivationChainDto = {
  upstreamAssetId: string;
  upstreamVersion: number;
  downstreamAssetId: string;
  toolKey: ToolKey;
  sessionId: string;
  createdAt: string;
};

/**
 * CompatibleAssetsResponse — returned by discovery endpoint.
 */
export type CompatibleAssetsResponse = {
  compatibleAssets: AssetDto[];
  gaps: {
    assetType: AssetType;
    canBeProducedBy: ToolKey[];
  }[];
};
