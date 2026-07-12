import { readFileSync } from 'node:fs';
import path from 'node:path';
import { normalizeStepKey, normalizeToolWorkflowKey } from '../workflow-normalizers';

const YOUTUBE_DESCRIPTION_CONTEXT_PROMPT_FILE =
  'src/lib/runtime/tool-prompts/youtube-description/prompt_context_generation.md';
const YOUTUBE_DESCRIPTION_GENERATION_PROMPT_FILE =
  'src/lib/runtime/tool-prompts/youtube-description/prompt_youtube_description_generation.md';

const PROMPT_FILE_BY_KEY = {
  extraction: 'src/lib/runtime/tool-prompts/extraction/prompt_generation.md',
  'youtube-lf-script:extraction': 'src/lib/runtime/tool-prompts/youtube-lf-script/prompt_extraction.md',
  'angle-generator:extraction': 'src/lib/runtime/tool-prompts/angle-generator/prompt_extraction.md',
  'meta-ads:extraction': 'src/lib/runtime/tool-prompts/meta-ads/prompt_extraction.md',
  'funnel-pages:optin': 'src/lib/runtime/tool-prompts/hl_funnel/prompt_optin_generator.md',
  'funnel-pages:quiz': 'src/lib/runtime/tool-prompts/hl_funnel/prompt_quiz_generator.md',
  'funnel-pages:vsl': 'src/lib/runtime/tool-prompts/hl_funnel/prompt_vsl_generator.md',
  'nextland:landing': 'src/lib/runtime/tool-prompts/nextland/prompt_landing_generator.md',
  'nextland:thank_you': 'src/lib/runtime/tool-prompts/nextland/prompt_thank_you_generator.md',
  'angle-generator:context-and-angle-matrix':
    'src/lib/runtime/tool-prompts/angle-generator/prompt_context_and_angle_matrix.md',
  'angle-generator:angle-prioritization':
    'src/lib/runtime/tool-prompts/angle-generator/prompt_angle_prioritization.md',
  'angle-generator:creative-activation':
    'src/lib/runtime/tool-prompts/angle-generator/prompt_creative_activation.md',
  'youtube-lf-script:pre-script-analysis': 'src/lib/runtime/tool-prompts/youtube-lf-script/prompt_pre_script_analysis.md',
  'youtube-lf-script:packaging': 'src/lib/runtime/tool-prompts/youtube-lf-script/prompt_packaging.md',
  'youtube-lf-script:intro-structure': 'src/lib/runtime/tool-prompts/youtube-lf-script/prompt_intro_structure.md',
  'youtube-lf-script:body-structure': 'src/lib/runtime/tool-prompts/youtube-lf-script/prompt_body_structure.md',
  'youtube-lf-script:native-cta-embeds': 'src/lib/runtime/tool-prompts/youtube-lf-script/prompt_native_cta_embeds.md',
  'youtube-lf-script:outro-structure': 'src/lib/runtime/tool-prompts/youtube-lf-script/prompt_outro_structure.md',
  'meta-ads:context-generation': 'src/lib/runtime/tool-prompts/meta-ads/prompt_context_generation.md',
  'meta-ads:ads-generation': 'src/lib/runtime/tool-prompts/meta-ads/prompt_ads_generation.md',
  'youtube-description:youtube-description-generation': YOUTUBE_DESCRIPTION_GENERATION_PROMPT_FILE,
  'geometric:strategic-reporting': 'src/lib/runtime/tool-prompts/geometric/prompt_strategic_reporting.md',
  'geometric:unified-report': 'src/lib/runtime/tool-prompts/geometric/prompt_unified_report.md',
  'blog-article-generator:blog_seo_structure': 'src/lib/runtime/tool-prompts/blog-article-generator/prompt_blog_seo_structure.md',
  'blog-article-generator:blog_research': 'src/lib/runtime/tool-prompts/blog-article-generator/prompt_blog_research.md',
  'blog-article-generator:blog_article': 'src/lib/runtime/tool-prompts/blog-article-generator/prompt_blog_article.md',
} as const;

const promptCache = new Map<string, string>();

const readPromptFile = (relativePath: string): string | null => {
  const cached = promptCache.get(relativePath);
  if (cached) {
    return cached;
  }

  const absolutePath = path.resolve(process.cwd(), relativePath);
  try {
    const content = readFileSync(absolutePath, 'utf8');
    promptCache.set(relativePath, content);
    return content;
  } catch {
    return null;
  }
};

const resolvePromptFilePath = (input: {
  toolKey?: string | null;
  workflowType?: string | null;
  artifactType?: string;
  stepKey?: unknown;
  extractionToolKey?: unknown;
}): string | null => {
  const toolKey = normalizeToolWorkflowKey(input.toolKey ?? input.workflowType ?? null);
  const artifactType = normalizeToolWorkflowKey(input.artifactType ?? null);
  const extractionToolKey = normalizeToolWorkflowKey(
    typeof input.extractionToolKey === 'string' ? input.extractionToolKey : null,
  );

  if (toolKey === 'extraction' || artifactType === 'extraction') {
    if (extractionToolKey === 'youtube-lf-script') {
      return PROMPT_FILE_BY_KEY['youtube-lf-script:extraction'];
    }
    if (extractionToolKey === 'angle-generator') {
      return PROMPT_FILE_BY_KEY['angle-generator:extraction'];
    }
    if (extractionToolKey === 'meta-ads') {
      return PROMPT_FILE_BY_KEY['meta-ads:extraction'];
    }
    return PROMPT_FILE_BY_KEY.extraction;
  }

  if (!toolKey) {
    return null;
  }

  const stepKey = normalizeStepKey(input.stepKey);
  if (!stepKey) {
    return null;
  }

  const key = `${toolKey}:${stepKey}` as keyof typeof PROMPT_FILE_BY_KEY;
  return PROMPT_FILE_BY_KEY[key] ?? null;
};

export type ResolvedToolPrompt = {
  key: string;
  filePath: string;
  prompt: string;
};

export const resolveToolPrompt = (input: {
  toolKey?: string | null;
  workflowType?: string | null;
  artifactType?: string;
  stepKey?: unknown;
  extractionToolKey?: unknown;
}): ResolvedToolPrompt | null => {
  const filePath = resolvePromptFilePath(input);
  if (!filePath) {
    return null;
  }

  const normalizedToolKey = normalizeToolWorkflowKey(input.toolKey ?? input.workflowType ?? null);
  const normalizedStepKey = normalizeStepKey(input.stepKey);
  if (
    normalizedToolKey === 'youtube-description'
    && normalizedStepKey === 'youtube-description-generation'
  ) {
    const contextPrompt = readPromptFile(YOUTUBE_DESCRIPTION_CONTEXT_PROMPT_FILE);
    const generationPrompt = readPromptFile(YOUTUBE_DESCRIPTION_GENERATION_PROMPT_FILE);
    if (!contextPrompt || !generationPrompt) {
      return null;
    }

    return {
      key: `${YOUTUBE_DESCRIPTION_CONTEXT_PROMPT_FILE}|${filePath}`,
      filePath,
      prompt: [
        contextPrompt,
        '',
        '## ORCHESTRATION CONTRACT',
        '- Execute context validation first and stop generation on blocking errors.',
        '- When validation status is ok, execute generation using the normalized context.',
        '',
        generationPrompt,
      ].join('\n'),
    };
  }

  const prompt = readPromptFile(filePath);
  if (!prompt) {
    return null;
  }

  return {
    key: filePath,
    filePath,
    prompt,
  };
};
