import { readFileSync } from 'node:fs';
import path from 'node:path';
import { normalizeStepKey, normalizeToolWorkflowKey } from '../workflow-normalizers';

const PROMPT_FILE_BY_KEY = {
  extraction: 'src/lib/runtime/tool-prompts/extraction/prompt_generation.md',
  'youtube-lf-script:extraction': 'src/lib/runtime/tool-prompts/youtube-lf-script/prompt_extraction.md',
  'funnel-pages:optin': 'src/lib/runtime/tool-prompts/hl_funnel/prompt_optin_generator.md',
  'funnel-pages:quiz': 'src/lib/runtime/tool-prompts/hl_funnel/prompt_quiz_generator.md',
  'funnel-pages:vsl': 'src/lib/runtime/tool-prompts/hl_funnel/prompt_vsl_generator.md',
  'nextland:landing': 'src/lib/runtime/tool-prompts/nextland/prompt_landing_generator.md',
  'nextland:thank_you': 'src/lib/runtime/tool-prompts/nextland/prompt_thank_you_generator.md',
  'youtube-lf-script:pre-script-analysis': 'src/lib/runtime/tool-prompts/youtube-lf-script/prompt_pre_script_analysis.md',
  'youtube-lf-script:packaging': 'src/lib/runtime/tool-prompts/youtube-lf-script/prompt_packaging.md',
  'youtube-lf-script:intro-structure': 'src/lib/runtime/tool-prompts/youtube-lf-script/prompt_intro_structure.md',
  'youtube-lf-script:body-structure': 'src/lib/runtime/tool-prompts/youtube-lf-script/prompt_body_structure.md',
  'youtube-lf-script:native-cta-embeds': 'src/lib/runtime/tool-prompts/youtube-lf-script/prompt_native_cta_embeds.md',
  'youtube-lf-script:outro-structure': 'src/lib/runtime/tool-prompts/youtube-lf-script/prompt_outro_structure.md',
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
