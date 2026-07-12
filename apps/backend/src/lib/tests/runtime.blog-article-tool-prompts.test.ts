import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveToolPrompt } from '../runtime/tool-prompts';

test('resolveToolPrompt loads blog-article-generator SEO structure prompt', () => {
  const resolved = resolveToolPrompt({
    toolKey: 'blog-article-generator',
    workflowType: 'blog_article_generator',
    artifactType: 'content',
    stepKey: 'blog_seo_structure',
  });

  assert.ok(resolved);
  assert.match(resolved.filePath, /prompt_blog_seo_structure\.md$/);
  assert.match(resolved.prompt, /SEO and Content Strategist/i);
  assert.match(resolved.prompt, /\{\{titolo\}\}/);
});

test('resolveToolPrompt loads blog research prompt with structure injection placeholders', () => {
  const resolved = resolveToolPrompt({
    toolKey: 'blog-article-generator',
    workflowType: 'blog_article_generator',
    artifactType: 'content',
    stepKey: 'blog_research',
  });

  assert.ok(resolved);
  assert.match(resolved.filePath, /prompt_blog_research\.md$/);
  assert.match(resolved.prompt, /SEO Structure Reference/i);
  assert.match(resolved.prompt, /\{\{output_step_blog_seo_structure\}\}/);
});

test('resolveToolPrompt loads blog article prompt enforcing Italian content', () => {
  const resolved = resolveToolPrompt({
    toolKey: 'blog-article-generator',
    workflowType: 'blog_article_generator',
    artifactType: 'content',
    stepKey: 'blog_article',
  });

  assert.ok(resolved);
  assert.match(resolved.filePath, /prompt_blog_article\.md$/);
  assert.match(resolved.prompt, /professional copywriter/i);
  assert.match(resolved.prompt, /Write the article content in Italian/i);
  assert.match(resolved.prompt, /\{\{tone\}\}/);
});

test('resolveToolPrompt returns null for unknown blog-article-generator step', () => {
  const resolved = resolveToolPrompt({
    toolKey: 'blog-article-generator',
    workflowType: 'blog_article_generator',
    artifactType: 'content',
    stepKey: 'unknown-step',
  });

  assert.equal(resolved, null);
});
