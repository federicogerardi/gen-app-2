import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  GenerationWorkspaceProvider,
  useGenerationArtifactsWorkspace,
} from './GenerationWorkspaceProvider';

const mockListArtifactsPaginated = vi.fn();
const mockUseMachine = vi.fn();

vi.mock('../../artifacts/runtime/artifacts-client', () => ({
  listArtifactsPaginated: (...args: unknown[]) => mockListArtifactsPaginated(...args),
}));

vi.mock('../../../app/providers/AuthSessionProvider', async () => {
  const { createMockAuthSessionProvider } = await import('../../../test/mocks/auth-session-provider.mock');
  return createMockAuthSessionProvider({ userId: 'user-001', capabilities: { artifacts: true } });
});

vi.mock('@xstate/react', () => ({
  useMachine: (...args: unknown[]) => mockUseMachine(...args),
}));

const TestConsumer = () => {
  const { artifactsReloadError } = useGenerationArtifactsWorkspace();
  return <p data-testid="artifacts-reload-error">{artifactsReloadError ?? 'none'}</p>;
};

const createMachineSnapshot = () => ({
  matches: () => false,
  context: {
    artifactId: null,
    content: '',
    lastRequest: null,
    checkpoints: [],
    terminalCompletedStep: null,
    terminalFailedStep: null,
    extractionByProject: {},
  },
});

describe('GenerationWorkspaceProvider', () => {
  it('surfaces persisted artifacts reload errors instead of silently swallowing them', async () => {
    mockUseMachine.mockReturnValue([createMachineSnapshot(), vi.fn()]);
    mockListArtifactsPaginated.mockRejectedValue(new Error('Unable to list artifacts (HTTP 503)'));

    render(
      <GenerationWorkspaceProvider>
        <TestConsumer />
      </GenerationWorkspaceProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('artifacts-reload-error')).toHaveTextContent(
        'Unable to list artifacts (HTTP 503)',
      );
    });
  });

  it('clears reload error after a successful persisted artifacts refresh', async () => {
    mockUseMachine.mockReturnValue([createMachineSnapshot(), vi.fn()]);
    mockListArtifactsPaginated
      .mockRejectedValueOnce(new Error('Unable to list artifacts (HTTP 503)'))
      .mockResolvedValue({ artifacts: [], totalResults: 0 });

    const ReloadProbe = () => {
      const { artifactsReloadError, reloadArtifacts } = useGenerationArtifactsWorkspace();
      return (
        <>
          <p data-testid="artifacts-reload-error">{artifactsReloadError ?? 'none'}</p>
          <button type="button" onClick={reloadArtifacts}>reload</button>
        </>
      );
    };

    render(
      <GenerationWorkspaceProvider>
        <ReloadProbe />
      </GenerationWorkspaceProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('artifacts-reload-error')).toHaveTextContent(
        'Unable to list artifacts (HTTP 503)',
      );
    });

    screen.getByRole('button', { name: 'reload' }).click();

    await waitFor(() => {
      expect(screen.getByTestId('artifacts-reload-error')).toHaveTextContent('none');
    });
  });
});
