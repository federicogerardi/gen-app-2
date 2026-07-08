import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCompletedArtifactsByStep } from '../runtime/tool-workflow-registry';
import { canRoleAccessToolKey, getToolAvailabilityPolicy } from '@gen-app-2/contracts';

test('buildCompletedArtifactsByStep resolves blog article dependencies correctly', async () => {
  const completedArtifactsByStep = await buildCompletedArtifactsByStep(
    'user-blog-001',
    'blog-article-generator',
    [
      {
        artifactId: 'artifact-seo-001',
        workflowType: 'blog_article_generator',
        artifactType: 'content',
        stepKey: 'blog_seo_structure',
      },
      {
        artifactId: 'artifact-research-001',
        workflowType: 'blog_article_generator',
        artifactType: 'content',
        stepKey: 'blog_research',
      },
    ],
    async () => [],
    '/api/tools/orchestrate',
    'corr-blog-test',
  );

  assert.deepEqual(completedArtifactsByStep, {
    blog_seo_structure: 'artifact-seo-001',
    blog_research: 'artifact-research-001',
  });
});

test('buildCompletedArtifactsByStep handles empty blog article artifacts', async () => {
  const completedArtifactsByStep = await buildCompletedArtifactsByStep(
    'user-blog-002',
    'blog-article-generator',
    [],
    async () => [],
    '/api/tools/orchestrate',
    'corr-blog-empty',
  );

  assert.deepEqual(completedArtifactsByStep, {});
});

test('blog-article-generator tool availability matches enabled-for-all policy', () => {
  const policy = getToolAvailabilityPolicy('blog-article-generator');
  assert.equal(policy, 'enabled-for-all');
  assert.equal(canRoleAccessToolKey('blog-article-generator', 'member'), true);
  assert.equal(canRoleAccessToolKey('blog-article-generator', 'admin'), true);
});

test('blog-article-generator step dependencies are correctly defined', async () => {
  const { TOOL_STEP_ORDER, TOOL_STEP_DEPENDENCIES } = await import('@gen-app-2/contracts');

  const steps = TOOL_STEP_ORDER['blog-article-generator'];
  assert.deepEqual(steps, ['blog_seo_structure', 'blog_research', 'blog_article']);

  const deps = TOOL_STEP_DEPENDENCIES['blog-article-generator'];
  assert.deepEqual(deps['blog_seo_structure'], []);
  assert.deepEqual(deps['blog_research'], ['blog_seo_structure']);
  assert.deepEqual(deps['blog_article'], ['blog_research']);
});
