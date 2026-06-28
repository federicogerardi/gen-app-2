import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { appCopy } from '../../../app/copy/system';
import { SessionArtifactTabs } from './SessionArtifactTabs';
import type { SessionArtifactGroup } from '../machines/session-artifact-group';

vi.mock('../../tools/runtime/tool-step-display-config', async () => {
  const actual = await vi.importActual('../../tools/runtime/tool-step-display-config') as Record<string, unknown>;
  return {
    ...actual,
    isStepVisible: vi.fn().mockImplementation(actual.isStepVisible as (...args: unknown[]) => boolean),
    isStepIncludedInDownload: vi.fn().mockImplementation(actual.isStepIncludedInDownload as (...args: unknown[]) => boolean),
    getVisibleSteps: vi.fn().mockImplementation(actual.getVisibleSteps as (...args: unknown[]) => string[]),
    getIncludedSteps: vi.fn().mockImplementation(actual.getIncludedSteps as (...args: unknown[]) => string[]),
  };
});

import { isStepVisible } from '../../tools/runtime/tool-step-display-config';

const mockedIsStepVisible = vi.mocked(isStepVisible);

const group: SessionArtifactGroup = {
  sessionId: 'sess_demo',
  toolKey: 'funnel-pages',
  status: 'completed',
  artifacts: [
    {
      artifactId: 'a-1',
      requestId: 'r-1',
      projectId: 'p-1',
      stepKey: 'optin',
      artifactRole: 'step',
      status: 'completed',
      content: '# Optin\n\nFirst artifact',
      updatedAt: '2026-05-09T10:00:00.000Z',
      failureReason: null,
    },
    {
      artifactId: 'a-2',
      requestId: 'r-2',
      projectId: 'p-1',
      stepKey: 'quiz',
      artifactRole: 'final',
      status: 'completed',
      content: 'Second artifact',
      updatedAt: '2026-05-09T10:01:00.000Z',
      failureReason: null,
    },
  ],
};

describe('SessionArtifactTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders step tabs separately from markdown/raw content controls', () => {
    render(<SessionArtifactTabs group={group} fallbackToolKey="funnel-pages" />);

    expect(screen.getByRole('tablist', { name: 'Session steps' })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Modalita visualizzazione contenuto artifact di sessione' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'optin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: appCopy.ui.actions.viewMarkdown })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: appCopy.ui.actions.viewRaw })).toBeInTheDocument();
  });

  it('switches selected artifact when a step tab is clicked', () => {
    render(<SessionArtifactTabs group={group} fallbackToolKey="funnel-pages" />);

    expect(screen.getByText('First artifact')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'quiz' }));
    expect(screen.getByText('Second artifact')).toBeInTheDocument();
  });

  it('supports angle-generator canonical step rendering', () => {
    const angleGroup: SessionArtifactGroup = {
      ...group,
      toolKey: 'angle-generator',
      artifacts: [
        {
          artifactId: 'a-creative',
          requestId: 'r-creative',
          projectId: 'p-1',
          stepKey: 'creative-activation',
          artifactRole: 'final',
          status: 'completed',
          content: 'Creative activation content',
          updatedAt: '2026-05-09T10:01:00.000Z',
          failureReason: null,
        },
        {
          artifactId: 'a-context',
          requestId: 'r-context',
          projectId: 'p-1',
          stepKey: 'context-and-angle-matrix',
          artifactRole: 'step',
          status: 'completed',
          content: 'Context and angle matrix content',
          updatedAt: '2026-05-09T10:00:00.000Z',
          failureReason: null,
        },
      ],
    };

    render(<SessionArtifactTabs group={angleGroup} fallbackToolKey="angle-generator" />);

    expect(screen.getByRole('tab', { name: 'context-and-angle-matrix' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'creative-activation' })).toBeInTheDocument();
    expect(screen.getByText('Context and angle matrix content')).toBeInTheDocument();
  });

  it('renders canonical meta-ads 2-step workflow tabs', () => {
    const metaAdsGroup: SessionArtifactGroup = {
      ...group,
      toolKey: 'meta-ads',
      artifacts: [
        {
          artifactId: 'a-meta-context',
          requestId: 'r-meta-context',
          projectId: 'p-1',
          stepKey: 'context-generation',
          artifactRole: 'step',
          status: 'completed',
          content: 'Meta context content',
          updatedAt: '2026-05-09T10:00:00.000Z',
          failureReason: null,
        },
        {
          artifactId: 'a-meta-ads',
          requestId: 'r-meta-ads',
          projectId: 'p-1',
          stepKey: 'ads-generation',
          artifactRole: 'final',
          status: 'completed',
          content: 'Meta ads content',
          updatedAt: '2026-05-09T10:01:00.000Z',
          failureReason: null,
        },
      ],
    };

    render(<SessionArtifactTabs group={metaAdsGroup} fallbackToolKey="meta-ads" />);

    expect(screen.queryByRole('tab', { name: 'context-generation' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'ads-generation' })).toBeInTheDocument();
    expect(screen.getByText('Meta ads content')).toBeInTheDocument();
  });

  it('renders all steps by default (default config is all visible)', () => {
    render(<SessionArtifactTabs group={group} fallbackToolKey="funnel-pages" />);

    expect(screen.getByRole('tab', { name: 'optin' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'quiz' })).toBeInTheDocument();
  });

  it('hides step tabs when step is configured as not visible', () => {
    mockedIsStepVisible.mockImplementation((stepKey: string) => stepKey !== 'quiz');

    render(<SessionArtifactTabs group={group} fallbackToolKey="funnel-pages" />);

    expect(screen.getByRole('tab', { name: 'optin' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'quiz' })).not.toBeInTheDocument();
  });

  it('shows empty state message when all steps are hidden', () => {
    mockedIsStepVisible.mockReturnValue(false);

    render(<SessionArtifactTabs group={group} fallbackToolKey="funnel-pages" />);

    expect(screen.getByText('All steps are hidden by configuration.')).toBeInTheDocument();
  });
});