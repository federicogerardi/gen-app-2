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
