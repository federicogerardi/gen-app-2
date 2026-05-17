import { describe, expect, it } from 'vitest';

import {
  buildLatestArtifactByStep,
  collectCompletedStepsBySession,
} from './step-hydration';
import type { GenerationArtifact } from '../ui/artifact-history';

const createArtifact = (
  partial: Partial<GenerationArtifact> & {
    artifactId: string;
    requestId: string;
    updatedAt: string;
    step: string;
  },
): GenerationArtifact => ({
  artifactId: partial.artifactId,
  requestId: partial.requestId,
  projectId: partial.projectId ?? 'project-001',
  sessionId: partial.sessionId ?? null,
  stepKey: partial.stepKey ?? null,
  artifactRole: partial.artifactRole ?? 'step',
  runMode: partial.runMode ?? 'new',
  artifactType: partial.artifactType ?? 'content',
  status: partial.status ?? 'completed',
  model: partial.model ?? 'openrouter:auto',
  toolKey: partial.toolKey ?? 'funnel-pages',
  workflowType: partial.workflowType ?? 'funnel-pages',
  content: partial.content ?? 'content',
  createdAt: partial.createdAt ?? partial.updatedAt,
  updatedAt: partial.updatedAt,
  sourceRequest: partial.sourceRequest ?? {
    requestId: partial.requestId,
    userId: 'user-001',
    projectId: partial.projectId ?? 'project-001',
    ...(partial.sessionId ? { sessionId: partial.sessionId } : {}),
    artifactType: partial.artifactType ?? 'content',
    model: 'openrouter:auto',
    toolKey: 'funnel-pages',
    workflowType: 'funnel_pages',
    input: {
      step: partial.step,
    },
  },
  failureReason: partial.failureReason ?? null,
  streamedAt: null,
  completedAt: null,
});

describe('step-hydration session-aware selectors', () => {
  it('collectCompletedStepsBySession returns only completed steps in target session', () => {
    const artifacts: GenerationArtifact[] = [
      createArtifact({ artifactId: 'a1', requestId: 'r1', sessionId: 'sess-1', step: 'optin', updatedAt: '2026-05-09T10:00:00.000Z' }),
      createArtifact({ artifactId: 'a2', requestId: 'r2', sessionId: 'sess-1', step: 'quiz', status: 'failed', updatedAt: '2026-05-09T10:01:00.000Z' }),
      createArtifact({ artifactId: 'a3', requestId: 'r3', sessionId: 'sess-2', step: 'vsl', updatedAt: '2026-05-09T10:02:00.000Z' }),
    ];

    const completed = collectCompletedStepsBySession(artifacts, 'funnel-pages', 'project-001', 'sess-1');

    expect([...completed]).toEqual(['optin']);
  });

  it('buildLatestArtifactByStep prioritizes target session in concurrent runs', () => {
    const artifacts: GenerationArtifact[] = [
      createArtifact({ artifactId: 'sess2-latest-optin', requestId: 'r-s2', sessionId: 'sess-2', step: 'optin', updatedAt: '2026-05-09T10:03:00.000Z' }),
      createArtifact({ artifactId: 'sess1-optin', requestId: 'r-s1-1', sessionId: 'sess-1', step: 'optin', updatedAt: '2026-05-09T10:02:00.000Z' }),
      createArtifact({ artifactId: 'sess1-quiz', requestId: 'r-s1-2', sessionId: 'sess-1', step: 'quiz', updatedAt: '2026-05-09T10:04:00.000Z' }),
    ];

    const byStep = buildLatestArtifactByStep(artifacts, 'funnel-pages', 'project-001', 'sess-1');

    expect(byStep.optin?.artifactId).toBe('sess1-optin');
    expect(byStep.quiz?.artifactId).toBe('sess1-quiz');
  });

  it('buildLatestArtifactByStep keeps legacy fallback rows when session-tagged rows are missing', () => {
    const artifacts: GenerationArtifact[] = [
      createArtifact({ artifactId: 'legacy-optin', requestId: 'r-legacy', sessionId: null, step: 'optin', updatedAt: '2026-05-09T10:00:00.000Z' }),
      createArtifact({ artifactId: 'session-quiz', requestId: 'r-session', sessionId: 'sess-3', step: 'quiz', updatedAt: '2026-05-09T10:01:00.000Z' }),
    ];

    const byStep = buildLatestArtifactByStep(artifacts, 'funnel-pages', 'project-001', 'sess-3');

    expect(byStep.optin?.artifactId).toBe('legacy-optin');
    expect(byStep.quiz?.artifactId).toBe('session-quiz');
  });
});
