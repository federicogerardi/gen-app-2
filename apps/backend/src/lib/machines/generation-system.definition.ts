import { setup } from 'xstate';

import { generationSystemActions } from './generation-system.actions';
import { generationSystemActors } from './generation-system.actors';
import { generationSystemExecutionStates } from './generation-system.execution.states';
import { generationSystemGuards } from './generation-system.guards';
import { generationSystemPersistenceStates } from './generation-system.persistence.states';
import { generationSystemRequestStates } from './generation-system.request.states';
import {
  defaultArtifactIdFactory,
  defaultResponseBuilder,
  normalizeOutputFormat,
} from './generation-system.runtime';
import type {
  GenerationMachineContext,
  GenerationSystemInput,
} from './generation-system.types';

import type {
  GenerationSystemEvent,
} from '../types/xstate';


export const generationSystemMachine = setup({
  types: {
    context: {} as GenerationMachineContext,
    input: {} as GenerationSystemInput,
    events: {} as GenerationSystemEvent,
  },
  actions: generationSystemActions,
  guards: generationSystemGuards,
  actors: generationSystemActors,
}).createMachine({
  id: 'generationSystemMachine',
  initial: 'idle',
  context: ({ input }) => ({
    requestId: '',
    userId: null,
    projectId: null,
    sessionId: null,
    toolKey: null,
    registryVersion: null,
    registrySnapshotRef: null,
    workflowType: null,
    artifactType: 'content',
    model: 'unknown',
    requestInput: {},
    idempotencyKey: null,
    outputFormat: 'plain',
    artifactId: null,
    contentBuffer: '',
    failureReason: null,
    syntheticResponse: '',
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    routeType: null,
    pendingFallback: null,
    adapters: input.adapters,
    runtimeNow: input.runtime?.now ?? (() => new Date()),
    artifactIdFactory: input.runtime?.artifactIdFactory ?? defaultArtifactIdFactory,
    responseBuilder: input.runtime?.responseBuilder ?? defaultResponseBuilder,
    ...input.initialContext,
  }),
  states: {
    ...generationSystemRequestStates,
    ...generationSystemExecutionStates,
    ...generationSystemPersistenceStates,
  },
});
