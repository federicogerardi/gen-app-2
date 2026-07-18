/**
 * Tool Step Display Configuration (DDD-132, DDD-133, DDD-134)
 *
 * Centralized configuration for per-step visibility and download-inclusion controls.
 * This is a code-level developer-maintained file — no user-facing UI.
 *
 * Defaults: all steps visible and included (backward-compatible).
 * If a tool or step is not explicitly mapped, the fallback is `visible: true, includeInDownload: true`.
 */

import type { ToolKey, ToolStep } from '@gen-app-2/contracts';
import { TOOL_STEP_ORDER, TOOL_KEYS } from '@gen-app-2/contracts';

// ── Type definitions ──────────────────────────────────────────────────────────

export type StepDisplayConfig = {
  /** Whether the step should appear in SessionSummaryDetailPage UI */
  visible: boolean;
  /** Whether the step content should be included in download exports */
  includeInDownload: boolean;
};

/** Per-tool step configuration mapping (DDD-133) */
export type ToolStepDisplayConfig = Partial<Record<ToolStep, StepDisplayConfig>>;

/** Top-level configuration mapping per ToolKey (DDD-134) */
export type ToolStepDisplayConfigMap = Partial<Record<ToolKey, ToolStepDisplayConfig>>;

// ── Default behaviour ─────────────────────────────────────────────────────────

const DEFAULT_STEP_CONFIG: StepDisplayConfig = {
  visible: true,
  includeInDownload: true,
};

const isToolKey = (value: string): value is ToolKey =>
  (TOOL_KEYS as readonly string[]).includes(value);

const isToolStep = (value: string): value is ToolStep => {
  for (const toolKey of TOOL_KEYS) {
    if ((TOOL_STEP_ORDER[toolKey] as readonly string[]).includes(value)) {
      return true;
    }
  }
  return false;
};

// ── Configuration map ─────────────────────────────────────────────────────────

/**
 * Central configuration map.
 *
 * Tools or steps omitted from this map will fall back to the default
 * `{ visible: true, includeInDownload: true }` to maintain backward compatibility.
 */
export const TOOL_STEP_DISPLAY_CONFIG: ToolStepDisplayConfigMap = {
  'funnel-pages': {
    optin: { visible: true, includeInDownload: true },
    quiz: { visible: true, includeInDownload: true },
    vsl: { visible: true, includeInDownload: true },
  },
  nextland: {
    landing: { visible: true, includeInDownload: true },
    'thank_you': { visible: true, includeInDownload: true },
  },
  'youtube-lf-script': {
    'pre-script-analysis': { visible: true, includeInDownload: true },
    packaging: { visible: true, includeInDownload: true },
    'intro-structure': { visible: true, includeInDownload: true },
    'body-structure': { visible: true, includeInDownload: true },
    'native-cta-embeds': { visible: true, includeInDownload: true },
    'outro-structure': { visible: true, includeInDownload: true },
  },
  'angle-generator': {
    'context-and-angle-matrix': { visible: true, includeInDownload: true },
    'angle-prioritization': { visible: true, includeInDownload: true },
    'creative-activation': { visible: true, includeInDownload: true },
  },
  'meta-ads': {
    'context-generation': { visible: false, includeInDownload: false },
    'ads-generation': { visible: true, includeInDownload: true },
  },
  'youtube-description': {
    'youtube-description-generation': { visible: true, includeInDownload: true },
  },
  geometric: {
    'serp-crawling': { visible: false, includeInDownload: false },
    'competitor-scoring': { visible: false, includeInDownload: false },
    'strategic-reporting': { visible: true, includeInDownload: false },
    'unified-report': { visible: true, includeInDownload: true },
  },
  'blog-article-generator': {
    'blog_seo_structure': { visible: true, includeInDownload: false },
    'blog_research': { visible: true, includeInDownload: false },
    'blog_article': { visible: true, includeInDownload: true },
  },
  'brief-generator': {
    'brief-generation': { visible: true, includeInDownload: true },
  },
  'tov-generator': {
    'tov-generation': { visible: true, includeInDownload: true },
  },
};

// ── Lookup helpers ────────────────────────────────────────────────────────────

function getStepConfig(toolKey: string | null, stepKey: string | null): StepDisplayConfig {
  if (!toolKey || !stepKey || !isToolKey(toolKey) || !isToolStep(stepKey)) {
    return DEFAULT_STEP_CONFIG;
  }

  const toolConfig = TOOL_STEP_DISPLAY_CONFIG[toolKey];
  if (!toolConfig) {
    return DEFAULT_STEP_CONFIG;
  }

  const stepConfig = toolConfig[stepKey as ToolStep];
  if (!stepConfig) {
    return DEFAULT_STEP_CONFIG;
  }

  return stepConfig;
}

/** Returns true if the step should be rendered in UI (defaults to true if no config) */
export function isStepVisible(stepKey: string, toolKey: string | null): boolean {
  return getStepConfig(toolKey, stepKey).visible;
}

/** Returns true if the step should be included in download exports (defaults to true if no config) */
export function isStepIncludedInDownload(stepKey: string, toolKey: string | null): boolean {
  return getStepConfig(toolKey, stepKey).includeInDownload;
}

/** Returns all step keys that should be visible for a given tool */
export function getVisibleSteps(toolKey: string | null): ToolStep[] {
  if (!toolKey || !isToolKey(toolKey)) {
    return [];
  }

  return TOOL_STEP_ORDER[toolKey].filter((stepKey) => isStepVisible(stepKey, toolKey));
}

/** Returns all step keys that should be included in download for a given tool */
export function getIncludedSteps(toolKey: string | null): ToolStep[] {
  if (!toolKey || !isToolKey(toolKey)) {
    return [];
  }

  return TOOL_STEP_ORDER[toolKey].filter((stepKey) => isStepIncludedInDownload(stepKey, toolKey));
}
