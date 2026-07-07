import { describe, it } from 'node:test';
import assert from 'node:assert';

import { StepLlmModelResolverImpl, createStepLlmModelResolver } from '../runtime/step-llm-model-resolver';

describe('StepLlmModelResolver', () => {
  const createMockChecker = (enabledModels: Set<string>) => {
    return (modelKey: string): boolean => enabledModels.has(modelKey);
  };

  describe('resolveEffectiveModel', () => {
    it('should use user selection when no override configured', () => {
      const checker = createMockChecker(new Set(['openrouter/auto', 'openrouter/gpt-4']));
      const resolver = new StepLlmModelResolverImpl(checker);

      const result = resolver.resolveEffectiveModel(
        'funnel-pages',
        'optin',
        'openrouter/gpt-4' as `${string}/${string}`,
      );

      assert.strictEqual(result.effectiveModel, 'openrouter/gpt-4');
      assert.strictEqual(result.source, 'user-selection');
      assert.strictEqual(result.overrideReason, undefined);
      assert.strictEqual(result.originalUserModel, undefined);
    });

    it('should fallback to openrouter/auto when user model is disabled', () => {
      const checker = createMockChecker(new Set(['openrouter/auto']));
      const resolver = new StepLlmModelResolverImpl(checker);

      const result = resolver.resolveEffectiveModel(
        'funnel-pages',
        'optin',
        'openrouter/gpt-4' as `${string}/${string}`,
      );

      assert.strictEqual(result.effectiveModel, 'openrouter/auto');
      assert.strictEqual(result.source, 'user-selection');
    });

    it('should handle openrouter/auto as valid user model', () => {
      const checker = createMockChecker(new Set(['openrouter/auto']));
      const resolver = new StepLlmModelResolverImpl(checker);

      const result = resolver.resolveEffectiveModel(
        'funnel-pages',
        'optin',
        'openrouter/auto' as `${string}/${string}`,
      );

      assert.strictEqual(result.effectiveModel, 'openrouter/auto');
      assert.strictEqual(result.source, 'user-selection');
    });

    it('should fallback to openrouter/auto when both models are disabled', () => {
      const checker = createMockChecker(new Set());
      const resolver = new StepLlmModelResolverImpl(checker);

      const result = resolver.resolveEffectiveModel(
        'funnel-pages',
        'optin',
        'openrouter/gpt-4' as `${string}/${string}`,
      );

      assert.strictEqual(result.effectiveModel, 'openrouter/auto');
      assert.strictEqual(result.source, 'user-selection');
    });
  });
});

describe('createStepLlmModelResolver', () => {
  it('should create a resolver instance', () => {
    const checker = (modelKey: string) => modelKey === 'openrouter/auto';
    const resolver = createStepLlmModelResolver(checker);

    assert.ok(resolver instanceof StepLlmModelResolverImpl);
  });

  it('should resolve models using the provided checker', () => {
    const checker = (modelKey: string) => modelKey === 'openrouter/auto';
    const resolver = createStepLlmModelResolver(checker);

    const result = resolver.resolveEffectiveModel(
      'funnel-pages',
      'optin',
      'openrouter/gpt-4' as `${string}/${string}`,
    );

    assert.strictEqual(result.effectiveModel, 'openrouter/auto');
    assert.strictEqual(result.source, 'user-selection');
  });
});
