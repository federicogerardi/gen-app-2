import { useMachine } from '@xstate/react';
import { useMemo } from 'react';
import { toolFlowMachine } from '../../machines/tool-flow.machine';

export const NextlandToolPage = () => {
  const [snapshot, send] = useMachine(toolFlowMachine, {
    input: { tool: 'nextland' },
  });

  const currentStep = useMemo(() => snapshot.context.steps[snapshot.context.currentIndex], [snapshot.context.currentIndex, snapshot.context.steps]);

  return (
    <section className="panel page-stack">
      <h2>Nextland Tool</h2>
      <p className="meta-line">Ordine step obbligatorio: landing -&gt; thank_you</p>

      <ul className="list-clean">
        {snapshot.context.steps.map((step) => (
          <li key={step} className="panel">
            <p><strong>{step}</strong> | {snapshot.context.stepStatus[step]}</p>
            <p className="meta-line">retry: {snapshot.context.retriesByStep[step]}/3</p>
          </li>
        ))}
      </ul>

      <p className="meta-line">state: {String(snapshot.value)}</p>
      <p className="meta-line">current step: {currentStep ?? '-'}</p>

      <div className="actions">
        <button type="button" onClick={() => send({ type: 'START' })} disabled={!snapshot.matches('idle')}>
          Start workflow
        </button>
        <button
          type="button"
          onClick={() => currentStep && send({ type: 'STEP_DONE', step: currentStep })}
          disabled={!snapshot.matches('running') || !currentStep}
        >
          Complete current step
        </button>
        <button
          type="button"
          onClick={() => currentStep && send({ type: 'STEP_FAILED', step: currentStep, message: `Failure on ${currentStep}` })}
          disabled={!snapshot.matches('running') || !currentStep}
        >
          Fail current step
        </button>
        <button type="button" onClick={() => send({ type: 'RETRY_STEP' })} disabled={!snapshot.matches('error')}>
          Retry step
        </button>
        <button type="button" onClick={() => send({ type: 'RESET' })}>
          Reset
        </button>
      </div>
    </section>
  );
};
