import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveToolPrompt } from '../runtime/tool-prompts';
import { buildCompletedArtifactsByStep } from '../runtime/tool-workflow-registry';
import { canRoleAccessToolKey, getToolAvailabilityPolicy } from '@gen-app-2/contracts';

type PromptCase = {
  stepKey: string;
  filePathPattern: RegExp;
  contentPatterns: RegExp[];
};

type ToolPromptConfig = {
  toolKey: string;
  workflowType: string;
  extractionFields: string[];
  prompts: PromptCase[];
};

const TOOL_PROMPT_CONFIGS: ToolPromptConfig[] = [
  {
    toolKey: 'brief-generator',
    workflowType: 'brief_generator',
    extractionFields: ['product_or_service', 'target_audience', 'campaign_objective', 'primary_offer', 'tone'],
    prompts: [{
      stepKey: 'brief-generation',
      filePathPattern: /prompt_brief_generation\.md$/,
      contentPatterns: [/BRIEF GENERATION/i, /Italian only/i],
    }],
  },
  {
    toolKey: 'tov-generator',
    workflowType: 'tov_generator',
    extractionFields: ['brand_or_company', 'target_audience', 'tone', 'product_or_service', 'market'],
    prompts: [{
      stepKey: 'tov-generation',
      filePathPattern: /prompt_tov_generation\.md$/,
      contentPatterns: [/TOV GENERATION/i, /Italian only/i],
    }],
  },
  {
    toolKey: 'blog-article-generator',
    workflowType: 'blog_article_generator',
    extractionFields: [],
    prompts: [
      {
        stepKey: 'blog_seo_structure',
        filePathPattern: /prompt_blog_seo_structure\.md$/,
        contentPatterns: [/SEO and Content Strategist/i, /\{\{titolo\}\}/],
      },
      {
        stepKey: 'blog_research',
        filePathPattern: /prompt_blog_research\.md$/,
        contentPatterns: [/SEO Structure Reference/i, /\{\{output_step_blog_seo_structure\}\}/],
      },
      {
        stepKey: 'blog_article',
        filePathPattern: /prompt_blog_article\.md$/,
        contentPatterns: [/professional copywriter/i, /Write the article content in Italian/i],
      },
    ],
  },
  {
    toolKey: 'personas-generator',
    workflowType: 'personas_generator',
    extractionFields: ['demographics', 'goals', 'pain_point', 'behaviors', 'objections'],
    prompts: [{
      stepKey: 'personas-generation',
      filePathPattern: /prompt_personas_generation\.md$/,
      contentPatterns: [/PERSONAS GENERATION/i, /Italian only/i],
    }],
  },
];

type WorkflowRegistryConfig = {
  toolKey: 'brief-generator' | 'tov-generator' | 'blog-article-generator' | 'personas-generator';
  workflowType: string;
  stepKeys: string[];
  dependencies: Record<string, string[]>;
  sampleArtifacts: Array<{ artifactId: string; stepKey: string }>;
};

const WORKFLOW_REGISTRY_CONFIGS: WorkflowRegistryConfig[] = [
  {
    toolKey: 'brief-generator',
    workflowType: 'brief_generator',
    stepKeys: ['brief-generation'],
    dependencies: { 'brief-generation': [] },
    sampleArtifacts: [{ artifactId: 'artifact-brief-001', stepKey: 'brief-generation' }],
  },
  {
    toolKey: 'tov-generator',
    workflowType: 'tov_generator',
    stepKeys: ['tov-generation'],
    dependencies: { 'tov-generation': [] },
    sampleArtifacts: [{ artifactId: 'artifact-tov-001', stepKey: 'tov-generation' }],
  },
  {
    toolKey: 'blog-article-generator',
    workflowType: 'blog_article_generator',
    stepKeys: ['blog_seo_structure', 'blog_research', 'blog_article'],
    dependencies: {
      blog_seo_structure: [],
      blog_research: ['blog_seo_structure'],
      blog_article: ['blog_research'],
    },
    sampleArtifacts: [
      { artifactId: 'artifact-seo-001', stepKey: 'blog_seo_structure' },
      { artifactId: 'artifact-research-001', stepKey: 'blog_research' },
    ],
  },
  {
    toolKey: 'personas-generator',
    workflowType: 'personas_generator',
    stepKeys: ['personas-generation'],
    dependencies: { 'personas-generation': [] },
    sampleArtifacts: [{ artifactId: 'artifact-personas-001', stepKey: 'personas-generation' }],
  },
];

for (const config of TOOL_PROMPT_CONFIGS) {
  if (config.extractionFields.length > 0) {
    test(`resolveToolPrompt loads ${config.toolKey} extraction prompt`, () => {
      const resolved = resolveToolPrompt({
        toolKey: 'extraction',
        artifactType: 'extraction',
        extractionToolKey: config.toolKey,
      });

      assert.ok(resolved);
      assert.match(resolved.filePath, /prompt_extraction\.md$/);
      assert.match(resolved.prompt, /Extraction Fields/i);
      for (const field of config.extractionFields) {
        assert.match(resolved.prompt, new RegExp(field));
      }
    });
  }

  for (const promptCase of config.prompts) {
    test(`resolveToolPrompt loads ${config.toolKey} ${promptCase.stepKey} prompt`, () => {
      const resolved = resolveToolPrompt({
        toolKey: config.toolKey,
        workflowType: config.workflowType,
        artifactType: 'content',
        stepKey: promptCase.stepKey,
      });

      assert.ok(resolved);
      assert.match(resolved.filePath, promptCase.filePathPattern);
      for (const pattern of promptCase.contentPatterns) {
        assert.match(resolved.prompt, pattern);
      }
    });
  }

  test(`resolveToolPrompt returns null for unknown ${config.toolKey} step`, () => {
    const resolved = resolveToolPrompt({
      toolKey: config.toolKey,
      workflowType: config.workflowType,
      artifactType: 'content',
      stepKey: 'unknown-step',
    });

    assert.equal(resolved, null);
  });
}

for (const config of WORKFLOW_REGISTRY_CONFIGS) {
  test(`buildCompletedArtifactsByStep resolves ${config.toolKey} correctly`, async () => {
    const completedArtifactsByStep = await buildCompletedArtifactsByStep(
      `user-${config.toolKey}-001`,
      config.toolKey,
      config.sampleArtifacts.map((a) => ({
        artifactId: a.artifactId,
        workflowType: config.workflowType,
        artifactType: 'content' as const,
        stepKey: a.stepKey,
      })),
      async () => [],
      '/api/tools/orchestrate',
      `corr-${config.toolKey}-test`,
    );

    const expected: Record<string, string> = {};
    for (const artifact of config.sampleArtifacts) {
      expected[artifact.stepKey] = artifact.artifactId;
    }
    assert.deepEqual(completedArtifactsByStep, expected);
  });

  test(`buildCompletedArtifactsByStep handles empty ${config.toolKey} artifacts`, async () => {
    const completedArtifactsByStep = await buildCompletedArtifactsByStep(
      `user-${config.toolKey}-002`,
      config.toolKey,
      [],
      async () => [],
      '/api/tools/orchestrate',
      `corr-${config.toolKey}-empty`,
    );

    assert.deepEqual(completedArtifactsByStep, {});
  });

  test(`${config.toolKey} tool availability matches enabled-for-all policy`, () => {
    const policy = getToolAvailabilityPolicy(config.toolKey);
    assert.equal(policy, 'enabled-for-all');
    assert.equal(canRoleAccessToolKey(config.toolKey, 'member'), true);
    assert.equal(canRoleAccessToolKey(config.toolKey, 'admin'), true);
  });

  test(`${config.toolKey} step dependencies are correctly defined`, async () => {
    const { TOOL_STEP_ORDER, TOOL_STEP_DEPENDENCIES } = await import('@gen-app-2/contracts');

    const steps = TOOL_STEP_ORDER[config.toolKey];
    assert.deepEqual(steps, config.stepKeys);

    const deps = TOOL_STEP_DEPENDENCIES[config.toolKey];
    for (const [stepKey, expectedDeps] of Object.entries(config.dependencies)) {
      assert.deepEqual(deps[stepKey as keyof typeof deps], expectedDeps);
    }
  });
}
