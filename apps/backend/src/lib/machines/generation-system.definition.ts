import { setup } from 'xstate';

import { generationSystemActions } from './generation-system.actions';
import { generationSystemActors } from './generation-system.actors';
import { generationSystemExecutionStates } from './generation-system.execution.states';
import { generationSystemGuards } from './generation-system.guards';
import { generationSystemPersistenceStates } from './generation-system.persistence.states';
import { generationSystemRequestStates } from './generation-system.request.states';
import {
  buildGenerationCoreDefaults,
  buildGenerationRuntimeDefaults,
  buildGenerationMetricsDefaults,
  buildGenerationInfraContext,
} from './generation-system.runtime';
import type {
  GenerationMachineContext,
  GenerationSystemInput,
} from './generation-system.types';

import type {
  GenerationSystemEvent,
} from '../types/xstate';

/**
 * Aggregate Root: GenerationSystem
 *
 * Questa macchina a stati è l'Aggregate Root del Generation bounded context.
 * Tutti i Domain Event (WORKFLOW_STEP_UNLOCKED, WORKFLOW_STEP_COMPLETED, etc.)
 * sono transizioni interne all'actor tree — non esiste un event bus inter-processo
 * (vedi RISK-2 per il bridge Redis pub/sub introdotto con BullMQ).
 *
 * @ddd AggregateRoot GenerationSystem
 * @ddd BoundedContext Generation
 * @ddd Related DDD-167 DDD-168 DDD-037
 */
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
    ...buildGenerationCoreDefaults(),
    ...buildGenerationRuntimeDefaults(),
    ...buildGenerationMetricsDefaults(),
    ...buildGenerationInfraContext(input.adapters, input.runtime),
    ...input.initialContext,
  }),
  states: {
    ...generationSystemRequestStates,
    ...generationSystemExecutionStates,
    ...generationSystemPersistenceStates,
  },
});
