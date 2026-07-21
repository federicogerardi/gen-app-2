/**
 * Asset Injection Resolver — Prompt Assembly with Asset Content
 *
 * Resolves AssetReferences into prompt content injection at dispatch time.
 * Implements DDD-189 (AssetReference), DDD-193 (AssetInjectionDirective),
 * DDD-196 (snapshot semantics), DDD-198 (AssetStalenessPolicy),
 * and DDD-207 (AssetFieldMapping).
 *
 * DDD canonical terms:
 *   - AssetReference (DDD-189): transport reference type
 *   - AssetInjectionDirective (DDD-193): prompt injection specification
 *   - AssetStalenessPolicy (DDD-198): upstream version change warnings
 *   - AssetFieldMapping (DDD-207): structured extraction rules
 */

import type {
  AssetReference,
  AssetType,
} from '@gen-app-2/contracts';
import {
  resolveFieldMapping,
  isValidAssetReference,
} from '@gen-app-2/contracts';

// =====================================================================
// D-001: Extended GenerationRequestInput with assetReferences
// =====================================================================

/**
 * Asset reference in a generation request.
 * DDD-189: carried in GenerationRequest.input.assetReferences.
 */
export type AssetReferenceInput = {
  assetId?: string;
  assetGroupId?: string;
  sourceToolKey: string;
  usageIntent: 'input' | 'injection';
};

/**
 * Injection directive for a specific step.
 * DDD-193: specifies how an Asset is injected into a step.
 */
export type InjectionDirectiveInput = {
  assetId: string;
  stepKey: string;
  injectionMode: 'prepend' | 'append' | 'replace';
  fieldMappingKey?: string;
};

/**
 * Extended request input with asset references.
 * This is the shape that GenerationRequest.input will carry.
 */
export type AssetAwareRequestInput = {
  assetReferences?: AssetReferenceInput[];
  injectionDirectives?: InjectionDirectiveInput[];
  [key: string]: unknown;
};

/**
 * Validate assetReferences in a request input.
 * DDD-189: xor constraint — exactly one of assetId/assetGroupId must be set.
 */
export const validateAssetReferences = (
  refs: AssetReferenceInput[],
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  for (let i = 0; i < refs.length; i++) {
    const ref = refs[i];
    if (!isValidAssetReference(ref as AssetReference)) {
      errors.push(
        `assetReferences[${i}]: exactly one of assetId/assetGroupId must be set`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
};

// =====================================================================
// D-002: resolveAssetInjections — content composition
// =====================================================================

/**
 * Resolved asset content for injection into a prompt.
 */
export type ResolvedAssetContent = {
  assetId: string;
  assetType: AssetType;
  label: string;
  content: string;
  versionNumber: number;
  staleUpstream: boolean;
  upstreamLabel?: string;
};

/**
 * D-002: Resolve asset content from AssetReference using field mapping.
 * Extracts fields from Asset content and applies injection templates.
 */
export const resolveAssetContent = (
  asset: ResolvedAssetContent,
  fieldMappingKey?: string,
): string => {
  if (!fieldMappingKey) {
    // No field mapping — inject full content as raw text
    return asset.content;
  }

  const mapping = resolveFieldMapping(fieldMappingKey);
  if (!mapping) {
    // Mapping not found — fall back to raw content
    return asset.content;
  }

  // Try to parse asset content as JSON for structured extraction
  let parsedContent: Record<string, unknown> = {};
  try {
    parsedContent = JSON.parse(asset.content);
  } catch {
    // Content is not JSON — use raw content for template substitution
    parsedContent = { _raw: asset.content };
  }

  // Apply field mapping templates
  const injectedParts: string[] = [];

  for (const [fieldKey, entry] of Object.entries(mapping)) {
    const sourceValue = getSourceValue(parsedContent, entry.sourcePath);
    if (sourceValue !== undefined && sourceValue !== null) {
      const rendered = entry.injectionTemplate.replace(
        new RegExp(`\\{\\{${fieldKey}\\}\\}`, 'g'),
        String(sourceValue),
      );
      injectedParts.push(rendered);
    } else if (entry.required) {
      // Required field missing — log warning but continue
      injectedParts.push(`<!-- Warning: required field "${fieldKey}" not found in asset -->`);
    }
  }

  return injectedParts.join('\n\n');
};

/**
 * Get a value from a parsed object using a dot-notation path.
 */
const getSourceValue = (
  obj: Record<string, unknown>,
  path: string,
): unknown => {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
};

// =====================================================================
// D-003: resolveAssetInjectedPrompt — apply injections to prompt
// =====================================================================

/**
 * D-003: Apply asset injections to a resolved prompt.
 * Called after readPromptFile, before dispatching to LLM.
 */
export const resolveAssetInjectedPrompt = (
  basePrompt: string,
  assets: ResolvedAssetContent[],
  directives: InjectionDirectiveInput[],
  stepKey: string,
): string => {
  // Filter directives for this step
  const stepDirectives = directives.filter((d) => d.stepKey === stepKey);

  if (stepDirectives.length === 0) {
    return basePrompt;
  }

  // Resolve each directive's content
  const resolvedInjections: { mode: string; content: string }[] = [];

  for (const directive of stepDirectives) {
    const asset = assets.find((a) => a.assetId === directive.assetId);
    if (!asset) {
      continue; // Asset not found — skip silently
    }

    const content = resolveAssetContent(asset, directive.fieldMappingKey);
    resolvedInjections.push({
      mode: directive.injectionMode,
      content,
    });
  }

  // Apply injections based on mode
  let prompt = basePrompt;

  for (const injection of resolvedInjections) {
    switch (injection.mode) {
      case 'prepend':
        prompt = `${injection.content}\n\n---\n\n${prompt}`;
        break;
      case 'append':
        prompt = `${prompt}\n\n---\n\n${injection.content}`;
        break;
      case 'replace':
        // Replace mode: replace the entire prompt with asset content
        prompt = injection.content;
        break;
    }
  }

  return prompt;
};

// =====================================================================
// D-004: Snapshot semantics — resolve assets at dispatch time
// =====================================================================

/**
 * D-004: Resolve asset content at dispatch time using current_version.
 * Once a generation starts, it uses the version current at that moment;
 * later updates do not affect in-flight generations.
 */
export type AssetSnapshotResolver = {
  /**
   * Get the current version content for an asset.
   * Returns the snapshot that should be used for this generation.
   */
  getAssetSnapshot(assetId: string): Promise<ResolvedAssetContent | null>;

  /**
   * Get the current version content for an asset in a group.
   */
  getGroupAssetSnapshots(
    assetGroupId: string,
  ): Promise<ResolvedAssetContent[]>;
};

/**
 * Create an asset snapshot resolver that reads from the database.
 * The resolver fetches the current_version at call time, ensuring
 * snapshot semantics — once resolved, the content is immutable.
 */
export const createAssetSnapshotResolver = (
  getAssetById: (id: string) => Promise<{
    assetId: string;
    assetType: AssetType;
    label: string;
    content: string;
    currentVersion: number;
    staleUpstream: boolean;
  } | null>,
  getAssetVersions: (assetId: string) => Promise<{
    versionNumber: number;
    content: string;
  }[]>,
  getAssetGroupById: (groupId: string) => Promise<{
    assetIds: string[];
  } | null>,
): AssetSnapshotResolver => ({
  getAssetSnapshot: async (assetId: string) => {
    const asset = await getAssetById(assetId);
    if (!asset) return null;

    // Fetch the current version's content (snapshot semantics)
    const versions = await getAssetVersions(assetId);
    const currentVersion = versions.find(
      (v) => v.versionNumber === asset.currentVersion,
    );

    return {
      assetId: asset.assetId,
      assetType: asset.assetType,
      label: asset.label,
      content: currentVersion?.content ?? asset.content,
      versionNumber: asset.currentVersion,
      staleUpstream: asset.staleUpstream,
    };
  },

  getGroupAssetSnapshots: async (assetGroupId: string) => {
    const group = await getAssetGroupById(assetGroupId);
    if (!group) return [];

    const snapshots: ResolvedAssetContent[] = [];
    for (const assetId of group.assetIds) {
      const snapshot = await createAssetSnapshotResolver(
        getAssetById,
        getAssetVersions,
        getAssetGroupById,
      ).getAssetSnapshot(assetId);
      if (snapshot) {
        snapshots.push(snapshot);
      }
    }
    return snapshots;
  },
});

// =====================================================================
// D-005: AssetStalenessPolicy check with structured logging
// =====================================================================

/**
 * D-005: Staleness check result.
 */
export type StalenessCheckResult = {
  isStale: boolean;
  upstreamAssetId?: string | undefined;
  upstreamLabel?: string | undefined;
  warningMessage?: string | undefined;
};

/**
 * D-005: Check asset staleness per AssetStalenessPolicy (DDD-198).
 * When an Asset with staleUpstream is used as input, log a warning
 * and return advisory metadata for the frontend.
 */
export const checkAssetStaleness = (
  asset: ResolvedAssetContent,
  upstreamAssets?: ResolvedAssetContent[],
): StalenessCheckResult => {
  if (!asset.staleUpstream) {
    return { isStale: false };
  }

  // Find the upstream asset that caused staleness
  const upstream = upstreamAssets?.find(
    (u) => u.assetId !== asset.assetId,
  );

  const upstreamLabel = upstream?.label ?? 'unknown';
  const warningMessage =
    `This asset was generated from an older version of "${upstreamLabel}". ` +
    `Output may be suboptimal. Consider regenerating with the latest version.`;

  // DDD-198: Log warning for stale asset usage
  console.warn(
    `[AssetStalenessPolicy] Stale asset used: assetId=${asset.assetId}, ` +
    `version=${asset.versionNumber}, upstreamLabel=${upstreamLabel}`,
  );

  return {
    isStale: true,
    upstreamAssetId: upstream?.assetId,
    upstreamLabel,
    warningMessage,
  };
};

/**
 * D-005: Structured logger for asset injection events.
 */
export type AssetInjectionLogger = {
  logInjectionResolved: (params: {
    assetId: string;
    assetType: AssetType;
    fieldMappingKey?: string;
    contentLength: number;
  }) => void;

  logStalenessWarning: (params: {
    assetId: string;
    upstreamLabel: string;
    versionNumber: number;
  }) => void;

  logInjectionError: (params: {
    assetId: string;
    error: string;
  }) => void;
};

/**
 * Create a structured logger for asset injection events.
 */
export const createAssetInjectionLogger = (
  logger?: { warn: (msg: string) => void; info: (msg: string) => void; error: (msg: string) => void },
): AssetInjectionLogger => {
  const log = logger ?? console;

  return {
    logInjectionResolved: (params) => {
      log.info(
        `[AssetInjection] Resolved: assetId=${params.assetId}, ` +
        `assetType=${params.assetType}, ` +
        `fieldMappingKey=${params.fieldMappingKey ?? 'none'}, ` +
        `contentLength=${params.contentLength}`,
      );
    },

    logStalenessWarning: (params) => {
      log.warn(
        `[AssetStalenessPolicy] Stale upstream: assetId=${params.assetId}, ` +
        `upstreamLabel=${params.upstreamLabel}, version=${params.versionNumber}`,
      );
    },

    logInjectionError: (params) => {
      log.error(
        `[AssetInjection] Error: assetId=${params.assetId}, error=${params.error}`,
      );
    },
  };
};
