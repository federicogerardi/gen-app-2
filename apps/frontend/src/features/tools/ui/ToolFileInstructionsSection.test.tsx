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
});