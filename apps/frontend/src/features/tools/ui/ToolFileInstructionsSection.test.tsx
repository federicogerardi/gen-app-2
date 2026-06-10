import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToolFileInstructionsSection } from './ToolFileInstructionsSection';
import { selectToolFileInstructions } from '../runtime/tool-page-selectors';

describe('ToolFileInstructionsSection', () => {
  it('renders only required extraction fields inside the instructions card', () => {
    render(<ToolFileInstructionsSection instructions={selectToolFileInstructions('funnel-pages')} />);

    const accordion = screen.getByTestId('tool-file-instructions-accordion');
    expect(accordion).not.toHaveAttribute('open');
    expect(screen.getByText('Istruzioni compilazione file')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Istruzioni compilazione file'));

    expect(accordion).toHaveAttribute('open');
    expect(screen.getByRole('heading', { name: 'Campi obbligatori' })).toBeInTheDocument();
    expect(screen.getByText('Obiettivo del funnel')).toBeInTheDocument();
    expect(screen.getByText('Proof')).toBeInTheDocument();
    expect(screen.getByText('CTA principale')).toBeInTheDocument();
    expect(screen.queryByText('BriefingFile (.docx, .txt, .md)')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'File sempre richiesti' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'File richiesti dalla configurazione tool' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'File opzionali dalla configurazione tool' })).toBeNull();
    expect(screen.queryByText('Tone of voice')).toBeNull();
  });

  it('keeps meta-ads required fields focused on core marketing brief information', () => {
    const instructions = selectToolFileInstructions('meta-ads');
    expect(instructions?.requiredFields).toEqual([
      'Prodotto o servizio',
      'Target',
      'Obiettivo campagna',
      'Offerta principale',
      'Proof points',
      'Pain point dominanti',
      'Obiezioni',
    ]);

    render(<ToolFileInstructionsSection instructions={instructions} />);

    fireEvent.click(screen.getByText('Istruzioni compilazione file'));

    expect(screen.getByText('Prodotto o servizio')).toBeInTheDocument();
    expect(screen.getByText('Target')).toBeInTheDocument();
    expect(screen.getByText('Obiettivo campagna')).toBeInTheDocument();
    expect(screen.getByText('Offerta principale')).toBeInTheDocument();
    expect(screen.getByText('Proof points')).toBeInTheDocument();
    expect(screen.getByText('Pain point dominanti')).toBeInTheDocument();
    expect(screen.getByText('Obiezioni')).toBeInTheDocument();

    expect(screen.queryByText('Priorita LF8')).toBeNull();
    expect(screen.queryByText('Awareness priority')).toBeNull();
    expect(screen.queryByText('Meccanismo unico')).toBeNull();
    expect(screen.queryByText('Angle candidates')).toBeNull();
  });
});