import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToolActionButtons } from './ToolActionButtons';

describe('ToolActionButtons visual snapshot', () => {
  it('matches the canonical CTA label layout', () => {
    render(
      <ToolActionButtons
        primaryPolicy="start-generation"
        secondaryFlags={{
          canRetry: true,
          canSkipStep: true,
          canCancelGeneration: true,
          canOpenPreviousArtifact: true,
        }}
        onPrimaryAction={vi.fn()}
        onRetry={vi.fn()}
        onSkipStep={vi.fn()}
        onCancelGeneration={vi.fn()}
        onOpenPreviousArtifact={vi.fn()}
      />,
    );

    const labels = screen.getAllByRole('button').map((button) => button.textContent?.trim());

    expect(labels).toMatchInlineSnapshot(`
      [
        "Avvia la generazione",
        "Riprova",
        "Salta step",
        "Annulla",
        "Artefatto precedente",
      ]
    `);
  });
});
