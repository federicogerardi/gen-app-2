import { fromPromise } from 'xstate';

import type { LlmUsageMetrics } from '../adapters/generation.adapters';
import type { GenerationMachineContext } from './generation-system.types';
import type { AssetReferenceInput } from '../runtime/asset-injection-resolver';
import { resolveAssetInjectedPrompt } from '../runtime/asset-injection-resolver';

export type GenerateDoneOutput =
  | { type: 'GENERATE_TERMINATED_SUCCESS'; content: string; metrics?: LlmUsageMetrics }
  | { type: 'GENERATE_TERMINATED_FAILURE'; reason: string };

const isAssetReferenceArray = (value: unknown): value is AssetReferenceInput[] =>
  Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null && ('assetId' in value[0] || 'assetGroupId' in value[0]);

export const generationActor = fromPromise(
  async ({ input }: { input: { context: GenerationMachineContext } }): Promise<GenerateDoneOutput> => {
    const { context } = input;

    let effectiveRequestInput = context.requestInput;

    // ═══════════════════════════════════════════════════════════════
    // Asset injection (DDD-189, DDD-193, DDD-196)
    // ═══════════════════════════════════════════════════════════════
    const rawAssetRefs = (effectiveRequestInput as Record<string, unknown>).assetReferences;

    if (isAssetReferenceArray(rawAssetRefs)) {
      const snapshotResolver = context.adapters.assetSnapshotResolver;
      const stepKey = typeof (effectiveRequestInput as Record<string, unknown>).step === 'string'
        ? ((effectiveRequestInput as Record<string, unknown>).step as string).trim()
        : '-';
      const toolKey = typeof (effectiveRequestInput as Record<string, unknown>).toolKey === 'string'
        ? ((effectiveRequestInput as Record<string, unknown>).toolKey as string).trim()
        : 'unknown';

      console.info('[generation-actor] asset injection start', {
        requestId: context.requestId,
        toolKey,
        stepKey,
        assetRefCount: rawAssetRefs.length,
        assetRefs: rawAssetRefs,
      });

      const resolvedAssets: Awaited<ReturnType<typeof snapshotResolver.getAssetSnapshot>>[] = [];

      for (const ref of rawAssetRefs) {
        if (ref.assetId) {
          const snapshot = await snapshotResolver.getAssetSnapshot(ref.assetId);
          if (snapshot) {
            resolvedAssets.push(snapshot);
          }
        } else if (ref.assetGroupId) {
          const groupSnapshots = await snapshotResolver.getGroupAssetSnapshots(ref.assetGroupId);
          for (const gs of groupSnapshots) {
            resolvedAssets.push(gs);
          }
        }
      }

      const validSnapshots = resolvedAssets.filter((s): s is NonNullable<typeof s> => s !== null);

      console.info('[generation-actor] asset resolution result', {
        requestId: context.requestId,
        resolvedCount: validSnapshots.length,
        assets: validSnapshots.map((s) => ({ id: s.assetId, type: s.assetType, contentLen: s.content.length })),
      });

      if (validSnapshots.length > 0) {
        const directives = validSnapshots.map((asset) => ({
          assetId: asset.assetId,
          stepKey,
          injectionMode: 'prepend' as const,
          fieldMappingKey: `${asset.assetType}→${toolKey}`,
        }));

        const basePrompt = typeof (effectiveRequestInput as Record<string, unknown>).prompt === 'string'
          ? ((effectiveRequestInput as Record<string, unknown>).prompt as string)
          : '';

        const injectedPrompt = resolveAssetInjectedPrompt(basePrompt, validSnapshots, directives, stepKey);

        if (injectedPrompt !== basePrompt) {
          console.info('[generation-actor] asset prompt injected', {
            requestId: context.requestId,
            basePromptLen: basePrompt.length,
            injectedPromptLen: injectedPrompt.length,
            delta: injectedPrompt.length - basePrompt.length,
          });
          effectiveRequestInput = {
            ...effectiveRequestInput,
            prompt: injectedPrompt,
          };
        } else {
          console.info('[generation-actor] asset prompt NOT injected (no change)', {
            requestId: context.requestId,
            basePromptLen: basePrompt.length,
          });
        }
      }
    }
    // ═══════════════════════════════════════════════════════════════

    if (!isAssetReferenceArray(rawAssetRefs)) {
      console.info('[generation-actor] no asset references found', {
        requestId: context.requestId,
        inputKeys: Object.keys(effectiveRequestInput as Record<string, unknown>),
        rawAssetRefsType: typeof rawAssetRefs,
        isArray: Array.isArray(rawAssetRefs),
      });
    }

    // Diagnostic: log the model and prompt summary before calling generateText
    const promptStr = typeof (effectiveRequestInput as Record<string, unknown>).prompt === 'string'
      ? ((effectiveRequestInput as Record<string, unknown>).prompt as string)
      : '';
    console.info('[generation-actor] calling generateText', {
      requestId: context.requestId,
      model: context.model,
      promptLen: promptStr.length,
      promptPreview: promptStr.substring(0, 200),
      inputKeys: Object.keys(effectiveRequestInput as Record<string, unknown>),
    });

    let result: Awaited<ReturnType<typeof context.adapters.generate.generateText>>;
    try {
      result = await context.adapters.generate.generateText({
        requestId: context.requestId,
        model: context.model,
        requestInput: effectiveRequestInput,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[generation-actor] generateText threw error', {
        requestId: context.requestId,
        model: context.model,
        error: errorMessage,
        errorName: error instanceof Error ? error.name : typeof error,
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      return {
        type: 'GENERATE_TERMINATED_FAILURE',
        reason: `generate_throw:${errorMessage}`,
      };
    }

    console.info('[generation-actor] generateText result', {
      requestId: context.requestId,
      contentLen: result.content?.length ?? 0,
      hasUsage: !!result.usage,
    });

    if (!result.content || result.content.length === 0) {
      return {
        type: 'GENERATE_TERMINATED_FAILURE',
        reason: 'generate_empty_output',
      };
    }

    return {
      type: 'GENERATE_TERMINATED_SUCCESS',
      content: result.content,
      ...(result.usage ? { metrics: result.usage } : {}),
    };
  },
);
