import { readFileSync } from 'node:fs';
import path from 'node:path';

const PROMPT_FILE_BY_KEY = {
  extraction: 'src/lib/runtime/tool-prompts/extraction/prompt_generation.md',
  'funnel-pages:optin': 'src/lib/runtime/tool-prompts/hl_funnel/prompt_optin_generator.md',
  'funnel-pages:quiz': 'src/lib/runtime/tool-prompts/hl_funnel/prompt_quiz_generator.md',
  'funnel-pages:vsl': 'src/lib/runtime/tool-prompts/hl_funnel/prompt_vsl_generator.md',
  'nextland:landing': 'src/lib/runtime/tool-prompts/nextland/prompt_landing_generator.md',
  'nextland:thank_you': 'src/lib/runtime/tool-prompts/nextland/prompt_thank_you_generator.md',
  'youtube-long-form:hook': 'src/lib/runtime/tool-prompts/youtube_long_form/prompt_hook_generator.md',
  'youtube-long-form:script': 'src/lib/runtime/tool-prompts/youtube_long_form/prompt_script_generator.md',
  'youtube-long-form:description': 'src/lib/runtime/tool-prompts/youtube_long_form/prompt_description_generator.md',
} as const;

const promptCache = new Map<string, string>();

const normalizeToolKey = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  // @deprecated-compat: 'hl_funnel' normalizzato a 'funnel-pages' (DDD-030).
  // Rimuovere quando tutti i dati DB saranno migrati a 'funnel_pages'.
  if (normalized === 'funnel_pages' || normalized === 'hl_funnel' || normalized === 'funnelpages') {
    return 'funnel-pages';
  }

  if (normalized === 'thank-you' || normalized === 'thankyou') {
    return 'thank_you';
  }

  return normalized;
};

const normalizeStepKey = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === 'thank-you' || normalized === 'thankyou') {
    return 'thank_you';
  }

  return normalized;
};

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
}): string | null => {
  const toolKey = normalizeToolKey(input.toolKey ?? input.workflowType ?? null);
  const artifactType = normalizeToolKey(input.artifactType ?? null);

  if (toolKey === 'extraction' || artifactType === 'extraction') {
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
