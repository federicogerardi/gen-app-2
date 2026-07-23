import { createActor, waitFor } from 'xstate';
import type { Job } from 'bullmq';
import type Redis from 'ioredis';

import type { ArtifactType, ToolKey, ToolStep, ToolWorkflowType } from '@gen-app-2/contracts';
import type { GenerationAdapters } from '../adapters';
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
): BackendGenerationRequest => ({
  requestId: `${jobData.jobId}:${stepKey}`,
  userId: jobData.userId,
  projectId: jobData.projectId,
  sessionId: jobData.jobId,
  artifactType: 'content' as ArtifactType,
  model: jobData.model as BackendGenerationRequest['model'],
  idempotencyKey: `${jobData.idempotencyKey}:${stepKey}`,
  toolKey: jobData.toolKey as ToolKey,
  workflowType: 'funnel_pages' as ToolWorkflowType,
  input: {
    step: stepKey as ToolStep,
    intent: jobData.intent,
    extractionPayload: jobData.extractionPayload,
    stepDependencyArtifactIds,
    stepDependencyArtifactIdsByStep: dependencyArtifactIdsByStep as Record<string, string>,
    toolWorkflow: {
        toolKey: jobData.toolKey as ToolKey,
        workflowType: 'funnel_pages' as ToolWorkflowType,
        stepKey: stepKey as ToolStep,
        artifactRole: 'step' as const,
        runMode: jobData.intent,
        sessionId: jobData.jobId,
        dependsOnSteps: Object.keys(dependencyArtifactIdsByStep),
        dependencyArtifactIds: stepDependencyArtifactIds,
        dependencyArtifactIdsByStep: dependencyArtifactIdsByStep as Record<string, string>,
      },
  },
});

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

  return {
    artifactId: doneSnapshot.context.artifactId ?? '',
    content: doneSnapshot.context.contentBuffer ?? '',
  };
};

const runCrawlingStep = async (
  jobData: ToolWorkflowJobData,
  stepKey: string,
  adapters: GenerationAdapters,
): Promise<StepResult> => {
  const request: BackendGenerationRequest = {
    requestId: `${jobData.jobId}:${stepKey}`,
    userId: jobData.userId,
    projectId: jobData.projectId,
    sessionId: jobData.jobId,
    artifactType: 'crawl' as ArtifactType,
    model: jobData.model as BackendGenerationRequest['model'],
    toolKey: jobData.toolKey as ToolKey,
    workflowType: 'funnel_pages' as ToolWorkflowType,
    input: {
      step: stepKey as ToolStep,
      intent: jobData.intent,
      extractionPayload: jobData.extractionPayload,
      toolWorkflow: {
        toolKey: jobData.toolKey as ToolKey,
        workflowType: 'funnel_pages' as ToolWorkflowType,
        stepKey: stepKey as ToolStep,
        artifactRole: 'step' as const,
        runMode: jobData.intent,
        sessionId: jobData.jobId,
      },
    },
  };

  return runSingleStepGeneration(request, adapters);
};

const runScoringStep = async (
  jobData: ToolWorkflowJobData,
  stepKey: string,
  adapters: GenerationAdapters,
): Promise<StepResult> => {
  const request: BackendGenerationRequest = {
    requestId: `${jobData.jobId}:${stepKey}`,
    userId: jobData.userId,
    projectId: jobData.projectId,
    sessionId: jobData.jobId,
    artifactType: 'analysis' as ArtifactType,
    model: jobData.model as BackendGenerationRequest['model'],
    toolKey: jobData.toolKey as ToolKey,
    workflowType: 'funnel_pages' as ToolWorkflowType,
    input: {
      step: stepKey as ToolStep,
      intent: jobData.intent,
      extractionPayload: jobData.extractionPayload,
      toolWorkflow: {
        toolKey: jobData.toolKey as ToolKey,
        workflowType: 'funnel_pages' as ToolWorkflowType,
        stepKey: stepKey as ToolStep,
        artifactRole: 'step' as const,
        runMode: jobData.intent,
        sessionId: jobData.jobId,
      },
    },
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
): Promise<StepResult> => {
  switch (stepType) {
    case 'crawling':
      return runCrawlingStep(jobData, stepKey, adapters);
    case 'scoring':
      return runScoringStep(jobData, stepKey, adapters);
    case 'generation':
    case 'extraction':
    case 'acquisition':
    default: {
      const request = buildBackendGenerationRequest(
        jobData, stepKey, stepDependencyArtifactIds, dependencyArtifactIdsByStep,
      );
      return runSingleStepGeneration(request, adapters);
    }
  }
};

export type ProcessToolWorkflowJobContext = {
  adapters: GenerationAdapters;
  redis: Redis;
};

export const processToolWorkflowJob = async (
  job: Job<ToolWorkflowJobData>,
  ctx: ProcessToolWorkflowJobContext,
): Promise<void> => {
  const { adapters, redis } = ctx;
  const data = job.data;
  const { jobId, toolKey, userId, projectId } = data;

  const jobLog = log.child({ jobId, toolKey, userId, projectId });
  const publisher = createJobEventPublisher(redis);
  const progressSerializer = createJobProgressSerializer(redis);

  if (!isSupportedToolWorkflow(toolKey)) {
    throw new Error(`unsupported tool key: ${toolKey}`);
  }

  const plan: ToolWorkflowPlan = TOOL_WORKFLOW_REGISTRY[toolKey];
  const stepOrder = toolWorkflowStepOrder[toolKey];
  const totalSteps = plan.steps.length;

  jobLog.info({ totalSteps, steps: stepOrder }, 'tool workflow job starting');

  const completedStepArtifacts: Record<string, string> = {};
  const completedSteps: string[] = [];
  const stepStatuses: Record<string, 'idle' | 'running' | 'done' | 'error'> = {};

  for (const stepKey of stepOrder) {
    stepStatuses[stepKey] = 'idle';
  }

  for (let i = 0; i < plan.steps.length; i++) {
    const stepDescriptor = plan.steps[i]!;
    const stepKey = stepDescriptor.key;

    const cancelFlag = await redis.get(`${CANCEL_KEY_PREFIX}${jobId}`);
    if (cancelFlag) {
      jobLog.info({ stepKey, completedSteps: completedSteps.length }, 'job cancelled by user');
      await publisher.publish({
        type: 'workflow_failed',
        jobId,
        timestamp: new Date().toISOString(),
        errorMessage: 'cancelled',
      });
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

    jobLog.info({
      stepKey,
      stepIndex: i,
      stepType,
      dependencyCount: stepDependencyArtifactIds.length,
    }, 'step starting');

    try {
      const result = await runStepByType(
        stepType, data, stepKey, stepDependencyArtifactIds, dependencyArtifactIdsByStep, adapters,
      );

      completedStepArtifacts[stepKey] = result.artifactId;
      completedSteps.push(stepKey);
      stepStatuses[stepKey] = 'done';

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

      jobLog.info({ stepKey, artifactId: result.artifactId }, 'step completed');
    } catch (error) {
      stepStatuses[stepKey] = 'error';
      const errorMessage = error instanceof Error ? error.message : 'unknown error';

      jobLog.error({ stepKey, err: error }, 'step failed');

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

  await publisher.publish({
    type: 'workflow_completed',
    jobId,
    timestamp: new Date().toISOString(),
    totalSteps,
    result: {
      sessionId: jobId,
      artifactIds,
    },
  });

  await progressSerializer.clear(jobId);

  const activeLockKey = `${ACTIVE_LOCK_PREFIX}${userId}:${projectId}:${toolKey}`;
  await redis.del(activeLockKey);

  jobLog.info({ completedSteps: completedSteps.length, artifactIds: artifactIds.length }, 'tool workflow job completed');
};
