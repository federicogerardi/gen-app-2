import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToolFileInstructionsSection } from './ToolFileInstructionsSection';
import { selectToolFileInstructions } from '../runtime/tool-page-selectors';

describe('ToolFileInstructionsSection', () => {
  it('renders only required extraction fields inside the instructions card', () => {
    render(<ToolFileInstructionsSection instructions={selectToolFileInstructions('funnel-pages')} />);

    const accordion = screen.getByTestId('tool-file-instructions-accordion');
    expect(accordion).not.toHaveAttribute('open');
    expect(screen.getByText('File compilation instructions')).toBeInTheDocument();

    fireEvent.click(screen.getByText('File compilation instructions'));

    expect(accordion).toHaveAttribute('open');
    expect(screen.getByRole('heading', { name: 'Required fields' })).toBeInTheDocument();
    expect(screen.getByText('Funnel goal')).toBeInTheDocument();
    expect(screen.getByText('Proof')).toBeInTheDocument();
    expect(screen.getByText('Primary CTA')).toBeInTheDocument();
    expect(screen.queryByText('BriefingFile (.docx, .txt, .md)')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'File sempre richiesti' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'File richiesti dalla configurazione tool' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'File opzionali dalla configurazione tool' })).toBeNull();
    expect(screen.queryByText('Tone of voice')).toBeNull();
  });

  it('keeps meta-ads required fields focused on core marketing brief information', () => {
    const instructions = selectToolFileInstructions('meta-ads');
    expect(instructions?.requiredFields).toEqual([
      'Product or service',
      'Target',
      'Campaign objective',
      'Primary offer',
      'Proof points',
      'Dominant pain points',
      'Objections',
    ]);

    render(<ToolFileInstructionsSection instructions={instructions} />);

    fireEvent.click(screen.getByText('File compilation instructions'));

    expect(screen.getByText('Product or service')).toBeInTheDocument();
    expect(screen.getByText('Target')).toBeInTheDocument();
    expect(screen.getByText('Campaign objective')).toBeInTheDocument();
    expect(screen.getByText('Primary offer')).toBeInTheDocument();
    expect(screen.getByText('Proof points')).toBeInTheDocument();
    expect(screen.getByText('Dominant pain points')).toBeInTheDocument();
    expect(screen.getByText('Objections')).toBeInTheDocument();

    expect(screen.queryByText('LF8 priority')).toBeNull();
    expect(screen.queryByText('Awareness priority')).toBeNull();
    expect(screen.queryByText('Unique mechanism')).toBeNull();
    expect(screen.queryByText('Angle candidates')).toBeNull();
  });
});