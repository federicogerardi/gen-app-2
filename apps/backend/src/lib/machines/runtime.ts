import { createActor, type Actor } from 'xstate';

import {
  createPostgresRedisProductionGenerationAdapters,
  type PostgresRedisProductionClients,
  type PostgresRedisProductionOptions,
} from '../adapters';
import { generationSystemMachine } from './generation-system.machine';

export type GenerationRuntimeOptions = {
  adapterOptions?: PostgresRedisProductionOptions;
  machineRuntime?: {
    now?: () => Date;
    artifactIdFactory?: () => string;
  };
};

export const createProductionGenerationRootActor = (
  clients: PostgresRedisProductionClients,
  options: GenerationRuntimeOptions = {},
): Actor<typeof generationSystemMachine> => {
  const adapters = createPostgresRedisProductionGenerationAdapters(
    clients,
    options.adapterOptions,
  );

  return createActor(generationSystemMachine, {
    input: options.machineRuntime
      ? {
        adapters,
        runtime: options.machineRuntime,
      }
      : {
        adapters,
      },
  });
};
