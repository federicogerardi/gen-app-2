import { setup } from 'xstate';

export type AcquisitionChainInput = {
  requestId: string;
  stepKey: string;
  apiServiceId: string;
  payload: Record<string, unknown>;
};

export type AcquisitionChainOutput = {
  type: 'ACQUISITION_COMPLETED';
  requestId: string;
  stepKey: string;
  apiServiceId: string;
  payload: Record<string, unknown>;
};

type AcquisitionChainContext = {
  input: AcquisitionChainInput;
};

export const acquisitionChainMachine = setup({
  types: {
    context: {} as AcquisitionChainContext,
    input: {} as AcquisitionChainInput,
    output: {} as AcquisitionChainOutput,
  },
}).createMachine({
  id: 'acquisitionChainMachine',
  initial: 'done',
  context: ({ input }) => ({ input }),
  states: {
    done: {
      type: 'final',
      output: ({ context }) => ({
        type: 'ACQUISITION_COMPLETED',
        requestId: context.input.requestId,
        stepKey: context.input.stepKey,
        apiServiceId: context.input.apiServiceId,
        payload: context.input.payload,
      }),
    },
  },
});
