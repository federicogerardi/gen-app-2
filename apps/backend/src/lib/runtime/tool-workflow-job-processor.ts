import { createActor, waitFor } from 'xstate';
import type { Job } from 'bullmq';
import type Redis from 'ioredis';
import { randomUUID } from 'node:crypto';

import type { ArtifactType, ToolKey, ToolStep, ToolWorkflowType } from '@gen-app-2/contracts';
import { TOOL_WORKFLOW_BY_TOOL_KEY } from '@gen-app-2/contracts';
import type { GenerationAdapters } from '../adapters';
import type { ToolWorkflowJobRepository } from '../adapters/postgres-redis.interfaces';
import { generationSystemMachine } from '../machines';
import type { WorkflowStepType } from '../types/xstate';
import {
  buildAuthOkEvent,
  buildRequestReceivedEvent,
  buildValidationOkEvent,
  type BackendGenerationRequest,
} from './request-contract';
import { createJobEventPublisher } from './job-event-bridge';
import { createJobProgressSerializer } from './job-progress-serializer';
import { createComponentLogger, LogComponent } from './log-components';
import {
  TOOL_WORKFLOW_REGISTRY,
  toolWorkflowStepOrder,
  resolveStepDependencyIds,
  isSupportedToolWorkflow,
  type ToolWorkflowPlan,
} from './tool-workflow-registry';
import type { ToolWorkflowJobData } from './tool-workflow-job-queue';

const log = createComponentLogger(LogComponent.TOOL_WORKFLOW_JOB_PROCESSOR);

const CANCEL_KEY_PREFIX = 'tool-job-cancel:';
const ACTIVE_LOCK_PREFIX = 'tool-job-active:';

type StepResult = { artifactId: string; content: string };

const buildBackendGenerationRequest = (
  jobData: ToolWorkflowJobData,
  stepKey: string,
  stepDependencyArtifactIds: string[],
  dependencyArtifactIdsByStep: Record<string, string>,
  sessionId: string,
  workflowType: ToolWorkflowType,
  stepDependencyArtifactContentsByStep?: Record<string, string>,
): BackendGenerationRequest => {
  const input: BackendGenerationRequest['input'] = {
    step: stepKey as ToolStep,
    intent: jobData.intent,
    extractionPayload: jobData.extractionPayload,
    stepDependencyArtifactIds,
    stepDependencyArtifactIdsByStep: dependencyArtifactIdsByStep as Record<string, string>,
    toolWorkflow: {
        toolKey: jobData.toolKey as ToolKey,
        workflowType,
        stepKey: stepKey as ToolStep,
        artifactRole: 'step' as const,
        runMode: jobData.intent,
        sessionId,
        dependsOnSteps: Object.keys(dependencyArtifactIdsByStep),
        dependencyArtifactIds: stepDependencyArtifactIds,
        dependencyArtifactIdsByStep: dependencyArtifactIdsByStep as Record<string, string>,
      },
  };

  if (stepDependencyArtifactContentsByStep) {
    input.stepDependencyArtifactContentsByStep = stepDependencyArtifactContentsByStep;
  }

  // Promote brandName and baseQuery from extractionPayload to top-level
  // so assembly functions (assembleStrategicReportingInput etc.) can find them.
  const ep = jobData.extractionPayload;
  if (typeof ep?.brandName === 'string' && (ep.brandName as string).trim().length > 0) {
    (input as Record<string, unknown>).brandName = ep.brandName;
  }
  if (typeof ep?.baseQuery === 'string' && (ep.baseQuery as string).trim().length > 0) {
    (input as Record<string, unknown>).baseQuery = ep.baseQuery;
  }
  if (typeof ep?.language === 'string' && (ep.language as string).trim().length > 0) {
    (input as Record<string, unknown>).language = ep.language;
  }
  if (typeof ep?.country === 'string' && (ep.country as string).trim().length > 0) {
    (input as Record<string, unknown>).country = ep.country;
  }

  return {
    requestId: `${jobData.jobId}:${stepKey}`,
    userId: jobData.userId,
    projectId: jobData.projectId,
    sessionId,
    artifactType: 'content' as ArtifactType,
    model: jobData.model as BackendGenerationRequest['model'],
    idempotencyKey: `${jobData.idempotencyKey}:${stepKey}`,
    toolKey: jobData.toolKey as ToolKey,
    workflowType,
    input,
  };
};

const runSingleStepGeneration = async (
  request: BackendGenerationRequest,
  adapters: GenerationAdapters,
): Promise<StepResult> => {
  const actor = createActor(generationSystemMachine, {
    input: { adapters },
  });

  actor.start();
  actor.send(buildRequestReceivedEvent(request));
  actor.send(buildAuthOkEvent(request));
  actor.send(buildValidationOkEvent(request));

  const doneSnapshot = await waitFor(actor, (snapshot) => {
    const stateValue = String(snapshot.value);
    return stateValue === 'completed' || stateValue === 'failed';
  });

  actor.stop();

  const stateValue = String(doneSnapshot.value);
  if (stateValue === 'failed') {
    throw new Error(doneSnapshot.context.failureReason ?? 'generation step failed');
  }

  // Extract structured crawling/scoring content from the actor's requestInput.
  // contentBuffer is empty for crawl/scoring steps because those steps don't
  // stream text — the real data lives in requestInput after the machine's
  // mergeCrawlingIntoGenerationInput / cacheScoringResult actions.
  let effectiveContent: string = doneSnapshot.context.contentBuffer ?? '';
  if (effectiveContent.trim().length === 0) {
    const ri = doneSnapshot.context.requestInput as Record<string, unknown> | undefined;
    if (ri) {
      const crawling = ri.crawling as Record<string, unknown> | undefined;
      const scoring = ri.scoring as Record<string, unknown> | undefined;
      const parts: string[] = [];
      if (typeof crawling?.snippets === 'string' && (crawling.snippets as string).trim().length > 0) {
        parts.push(`## SERP Crawling Snippets\n\n${crawling.snippets}`);
      }
      if (Array.isArray(crawling?.sources) && (crawling.sources as unknown[]).length > 0) {
        parts.push(`## Sources (${(crawling.sources as unknown[]).length} total)\n\n` +
          (crawling.sources as Array<Record<string, unknown>>)
            .map((s) => `- ${s.title ?? s.url ?? ''} ${s.url ? `<${s.url}>` : ''}`)
            .join('\n'));
      }
      if (Array.isArray(crawling?.paaQueries) && (crawling.paaQueries as unknown[]).length > 0) {
        parts.push(`## PAA Queries\n\n${(crawling.paaQueries as string[]).join('\n')}`);
      }
      if (scoring && typeof scoring === 'object' && !Array.isArray(scoring) && Object.keys(scoring).length > 0) {
        parts.push(`## Competitor Ranking\n\n${JSON.stringify(scoring, null, 2)}`);
      }
      if (parts.length > 0) {
        effectiveContent = parts.join('\n\n');
      }
    }
  }

  return {
    artifactId: doneSnapshot.context.artifactId ?? '',
    content: effectiveContent,
  };
};

const runCrawlingStep = async (
  jobData: ToolWorkflowJobData,
  stepKey: string,
  adapters: GenerationAdapters,
  sessionId: string,
  workflowType: ToolWorkflowType,
): Promise<StepResult> => {
  const baseInput: Record<string, unknown> = {
    step: stepKey as ToolStep,
    intent: jobData.intent,
    extractionPayload: jobData.extractionPayload,
    toolWorkflow: {
      toolKey: jobData.toolKey as ToolKey,
      workflowType,
      stepKey: stepKey as ToolStep,
      artifactRole: 'step' as const,
      runMode: jobData.intent,
      sessionId,
    },
  };
  // Promote extraction payload fields so assembly functions can read them
  const ep = jobData.extractionPayload;
  if (typeof ep?.brandName === 'string') baseInput.brandName = ep.brandName;
  if (typeof ep?.baseQuery === 'string') baseInput.baseQuery = ep.baseQuery;
  if (typeof ep?.language === 'string') baseInput.language = ep.language;
  if (typeof ep?.country === 'string') baseInput.country = ep.country;

  const request: BackendGenerationRequest = {
    requestId: `${jobData.jobId}:${stepKey}`,
    userId: jobData.userId,
    projectId: jobData.projectId,
    sessionId,
    artifactType: 'crawl' as ArtifactType,
    model: jobData.model as BackendGenerationRequest['model'],
    toolKey: jobData.toolKey as ToolKey,
    workflowType,
    input: baseInput as BackendGenerationRequest['input'],
  };

  return runSingleStepGeneration(request, adapters);
};

const runScoringStep = async (
  jobData: ToolWorkflowJobData,
  stepKey: string,
  adapters: GenerationAdapters,
  sessionId: string,
  workflowType: ToolWorkflowType,
): Promise<StepResult> => {
  const baseInput: Record<string, unknown> = {
    step: stepKey as ToolStep,
    intent: jobData.intent,
    extractionPayload: jobData.extractionPayload,
    toolWorkflow: {
      toolKey: jobData.toolKey as ToolKey,
      workflowType,
      stepKey: stepKey as ToolStep,
      artifactRole: 'step' as const,
      runMode: jobData.intent,
      sessionId,
    },
  };
  // Promote extraction payload fields so assembly functions can read them
  const ep = jobData.extractionPayload;
  if (typeof ep?.brandName === 'string') baseInput.brandName = ep.brandName;
  if (typeof ep?.baseQuery === 'string') baseInput.baseQuery = ep.baseQuery;
  if (typeof ep?.language === 'string') baseInput.language = ep.language;
  if (typeof ep?.country === 'string') baseInput.country = ep.country;

  const request: BackendGenerationRequest = {
    requestId: `${jobData.jobId}:${stepKey}`,
    userId: jobData.userId,
    projectId: jobData.projectId,
    sessionId,
    artifactType: 'analysis' as ArtifactType,
    model: jobData.model as BackendGenerationRequest['model'],
    toolKey: jobData.toolKey as ToolKey,
    workflowType,
    input: baseInput as BackendGenerationRequest['input'],
  };

  return runSingleStepGeneration(request, adapters);
};

const runStepByType = async (
  stepType: WorkflowStepType,
  jobData: ToolWorkflowJobData,
  stepKey: string,
  stepDependencyArtifactIds: string[],
  dependencyArtifactIdsByStep: Record<string, string>,
  adapters: GenerationAdapters,
  sessionId: string,
  workflowType: ToolWorkflowType,
  stepDependencyArtifactContentsByStep?: Record<string, string>,
): Promise<StepResult> => {
  switch (stepType) {
    case 'crawling':
      return runCrawlingStep(jobData, stepKey, adapters, sessionId, workflowType);
    case 'scoring':
      return runScoringStep(jobData, stepKey, adapters, sessionId, workflowType);
    case 'generation':
    case 'extraction':
    case 'acquisition':
    default: {
      const request = buildBackendGenerationRequest(
        jobData, stepKey, stepDependencyArtifactIds, dependencyArtifactIdsByStep,
        sessionId, workflowType, stepDependencyArtifactContentsByStep,
      );
      return runSingleStepGeneration(request, adapters);
    }
  }
};

export type ProcessToolWorkflowJobContext = {
  adapters: GenerationAdapters;
  redis: Redis;
  toolWorkflowJob?: ToolWorkflowJobRepository | null;
};

export const processToolWorkflowJob = async (
  job: Job<ToolWorkflowJobData>,
  ctx: ProcessToolWorkflowJobContext,
): Promise<void> => {
  const { adapters, redis, toolWorkflowJob: jobRepo } = ctx;
  const data = job.data;
  const { jobId, toolKey, userId, projectId } = data;

  const jobLog = log.child({ jobId, toolKey, userId, projectId });
  const publisher = createJobEventPublisher(redis);
  const progressSerializer = createJobProgressSerializer(redis);

  if (!isSupportedToolWorkflow(toolKey)) {
    throw new Error(`unsupported tool key: ${toolKey}`);
  }

  const sessionId = randomUUID();
  const workflowType = TOOL_WORKFLOW_BY_TOOL_KEY[toolKey].workflowType;
  const plan: ToolWorkflowPlan = TOOL_WORKFLOW_REGISTRY[toolKey];
  const stepOrder = toolWorkflowStepOrder[toolKey];
  const totalSteps = plan.steps.length;

  const startTime = Date.now();
  jobLog.info({ totalSteps, steps: stepOrder, sessionId, workflowType, startTime: new Date(startTime).toISOString() }, 'tool workflow job starting');

  const completedStepArtifacts: Record<string, string> = {};
  const completedSteps: string[] = [];
  const stepStatuses: Record<string, 'idle' | 'running' | 'done' | 'error'> = {};

  // Phase 2: Track artifact content per step for cross-step context propagation.
  // completedStepContents maps stepKey → StepResult (artifactId + content).
  // completedStepContentsByType maps stepType → first StepResult of that type,
  // used to skip redundant crawling/scoring steps when prior data exists.
  const completedStepContents = new Map<string, StepResult>();
  const completedStepContentsByType = new Map<string, StepResult>();

  // Phase 2: Dual-write to Postgres tool_jobs table (B.2)
  if (jobRepo) {
    try {
      await jobRepo.create({
        jobId,
        userId,
        projectId,
        toolKey,
        workflowType,
        totalSteps,
        model: data.model,
      });
    } catch (err) {
      jobLog.warn({ err }, 'tool_jobs.create failed (non-fatal, BullMQ state is primary)');
    }
  }

  for (const stepKey of stepOrder) {
    stepStatuses[stepKey] = 'idle';
  }

  // Transition job status: queued → running
  if (jobRepo) {
    try { await jobRepo.updateStatus(jobId, 'running'); } catch { /* best-effort */ }
  }

  for (let i = 0; i < plan.steps.length; i++) {
    const stepDescriptor = plan.steps[i]!;
    const stepKey = stepDescriptor.key;

    const cancelFlag = await redis.get(`${CANCEL_KEY_PREFIX}${jobId}`);
    if (cancelFlag) {
      jobLog.info({ stepKey, completedSteps: completedSteps.length }, 'job cancelled by user');
      if (jobRepo) {
        try { await jobRepo.markCancelled(jobId); } catch { /* best-effort */ }
      }
      await publisher.publish({
        type: 'workflow_failed',
        jobId,
        timestamp: new Date().toISOString(),
        errorMessage: 'cancelled',
      });
      const activeLockKey = `${ACTIVE_LOCK_PREFIX}${userId}:${projectId}:${toolKey}`;
      await redis.del(activeLockKey);
      return;
    }

    stepStatuses[stepKey] = 'running';
    await publisher.publish({
      type: 'step_started',
      jobId,
      timestamp: new Date().toISOString(),
      stepKey,
      stepIndex: i,
      totalSteps,
      status: 'running',
    });

    const { stepDependencyArtifactIds, dependencyArtifactIdsByStep } = resolveStepDependencyIds(
      toolKey, stepKey, completedStepArtifacts,
    );

    const stepType: WorkflowStepType = stepDescriptor.type ?? 'generation';

    // Phase 2 A.3: Build stepDependencyArtifactContentsByStep for generation steps.
    // This populates {{output_step_xxx}} placeholders in prompt templates.
    let stepDependencyArtifactContentsByStep: Record<string, string> | undefined;
    if (stepType === 'generation' || stepType === 'extraction' || stepType === 'acquisition') {
      const contentsByStep: Record<string, string> = {};
      for (const [depStepKey, content] of completedStepContents) {
        if (content.content && content.content.trim().length > 0) {
          contentsByStep[depStepKey] = content.content;
        }
      }
      if (Object.keys(contentsByStep).length > 0) {
        stepDependencyArtifactContentsByStep = contentsByStep;
        jobLog.info({
          stepKey,
          depContentKeys: Object.keys(contentsByStep),
          depContentSizes: Object.fromEntries(
            Object.entries(contentsByStep).map(([k, v]) => [k, v.length]),
          ),
          depContentPreviews: Object.fromEntries(
            Object.entries(contentsByStep).map(([k, v]) => [k, v.substring(0, 200)]),
          ),
        }, 'stepDependencyArtifactContentsByStep populated for generation step');
      }
    }

    // Phase 2 A.2: Skip redundant crawling/scoring steps.
    // If a prior step of the same type already completed, reuse its result
    // instead of re-executing (e.g., avoiding duplicate SerpApi calls).
    const priorOfSameType = (stepType === 'crawling' || stepType === 'scoring')
      ? completedStepContentsByType.get(stepType)
      : undefined;

    const stepStartTime = Date.now();
    jobLog.info({
      stepKey,
      stepIndex: i,
      stepType,
      dependencyCount: stepDependencyArtifactIds.length,
      skippedByPriorData: !!priorOfSameType,
      extractionPayloadKeys: Object.keys(data.extractionPayload ?? {}),
    }, 'step starting');

    try {
      let result: StepResult;

      if (priorOfSameType) {
        // A.2: Reuse prior step result of the same type (skip API call).
        result = priorOfSameType;
        jobLog.info({
          stepKey,
          stepType,
          reusedArtifactId: result.artifactId,
        }, 'step skipped — reusing prior step result of same type');
      } else {
        result = await runStepByType(
          stepType, data, stepKey, stepDependencyArtifactIds, dependencyArtifactIdsByStep, adapters,
          sessionId, workflowType, stepDependencyArtifactContentsByStep,
        );
      }

      completedStepArtifacts[stepKey] = result.artifactId;
      completedSteps.push(stepKey);
      stepStatuses[stepKey] = 'done';

      // A.1: Preserve content for cross-step propagation.
      completedStepContents.set(stepKey, result);
      if (stepType === 'crawling' || stepType === 'scoring') {
        if (!completedStepContentsByType.has(stepType)) {
          completedStepContentsByType.set(stepType, result);
        }
      }

      // Phase 2 B.2: Dual-write progress to Postgres.
      if (jobRepo) {
        try {
          await jobRepo.updateProgress(jobId, {
            completedSteps: completedSteps.length,
            progress: { lastStep: stepKey, lastArtifactId: result.artifactId },
          });
        } catch (err) {
          jobLog.warn({ err, stepKey }, 'tool_jobs.updateProgress failed (non-fatal)');
        }
      }

      await publisher.publish({
        type: 'step_completed',
        jobId,
        timestamp: new Date().toISOString(),
        stepKey,
        artifactId: result.artifactId,
        stepIndex: i,
        totalSteps,
        status: 'done',
      });

      await progressSerializer.save(jobId, {
        completedSteps: completedSteps.map((k) => ({
          key: k,
          status: 'done' as const,
          retryCount: 0,
          errorMessage: null,
        })),
        currentStepIndex: i + 1,
      });

      const stepDurationMs = Date.now() - stepStartTime;
      jobLog.info({ stepKey, artifactId: result.artifactId, stepDurationMs, reused: !!priorOfSameType }, 'step completed');
    } catch (error) {
      stepStatuses[stepKey] = 'error';
      const errorMessage = error instanceof Error ? error.message : 'unknown error';

      jobLog.error({ stepKey, err: error }, 'step failed');

      // Release idempotency lock on failure so BullMQ retries can re-attempt
      // the same step without hitting idempotency_conflict.
      try {
        await adapters.idempotency.markFailed({
          requestId: `${jobId}:${stepKey}`,
          userId,
          projectId,
          workflowType,
          idempotencyKey: `${data.idempotencyKey}:${stepKey}`,
          registrySnapshotRef: 'snapshot:default',
        });
      } catch { /* best-effort */ }

      // Phase 2 B.2: Dual-write failure to Postgres.
      if (jobRepo) {
        try { await jobRepo.markFailed(jobId, { errorMessage }); } catch { /* best-effort */ }
      }

      await publisher.publish({
        type: 'step_failed',
        jobId,
        timestamp: new Date().toISOString(),
        stepKey,
        stepIndex: i,
        totalSteps,
        status: 'error',
        errorMessage,
      });

      throw error;
    }
  }

  const artifactIds = stepOrder.map((k) => completedStepArtifacts[k]).filter((id): id is string => typeof id === 'string');

  // Phase 2 B.2 + B.3: Dual-write completion to Postgres with cost/token aggregation.
  if (jobRepo) {
    try {
      const { costUsd, inputTokens, outputTokens } = await jobRepo.aggregateSessionCostAndTokens(sessionId);
      await jobRepo.markCompleted(jobId, {
        sessionId,
        artifactIds,
        costUsd,
        inputTokens,
        outputTokens,
      });
    } catch (err) {
      jobLog.warn({ err }, 'tool_jobs.markCompleted failed (non-fatal)');
    }
  }

  await publisher.publish({
    type: 'workflow_completed',
    jobId,
    timestamp: new Date().toISOString(),
    totalSteps,
    result: {
      sessionId,
      artifactIds,
    },
  });

  await progressSerializer.clear(jobId);

  const activeLockKey = `${ACTIVE_LOCK_PREFIX}${userId}:${projectId}:${toolKey}`;
  await redis.del(activeLockKey);

  const durationMs = Date.now() - startTime;
  jobLog.info({
    completedSteps: completedSteps.length,
    totalSteps,
    artifactIds: artifactIds.length,
    durationMs,
    artifacts: artifactIds,
  }, 'tool workflow job completed');
};
