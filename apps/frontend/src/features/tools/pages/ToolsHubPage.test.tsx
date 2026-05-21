import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToolsHubPage } from './ToolsHubPage';

vi.mock('../runtime/tool-form-architecture', () => ({
  getEnabledToolNavigationItems: () => ([
    { toolKey: 'funnel-pages', to: '/tools/funnel-pages', label: 'Hotlead Funnel' },
    { toolKey: 'youtube-lf-script', to: '/tools/youtube-lf-script', label: 'YouTube LF Script' },
  ]),
  getToolFormConfig: (toolKey: string) => ({
    defaultPrompt: `Prompt for ${toolKey}`,
  }),
}));

describe('ToolsHubPage', () => {
  const renderPage = () => render(
    <MemoryRouter>
      <ToolsHubPage />
    </MemoryRouter>,
  );

  it('renders enabled tool links and excludes disabled tools', () => {
    renderPage();

    expect(screen.getAllByRole('link', { name: 'Apri workspace' })).toHaveLength(2);
    expect(screen.queryByText('Nextland')).toBeNull();
  });

  it('does not expose a Tools Console link', () => {
    renderPage();

    expect(screen.queryByRole('link', { name: 'Tools Console' })).toBeNull();
  });

  it('renders keyboard-focusable workspace actions', () => {
    renderPage();

    const workspaceLinks = screen.getAllByRole('link', { name: 'Apri workspace' });
    const firstWorkspaceLink = workspaceLinks[0];

    if (!firstWorkspaceLink) {
      throw new Error('Missing workspace link');
    }

    firstWorkspaceLink.focus();
    expect(firstWorkspaceLink).toHaveFocus();
    expect(firstWorkspaceLink).toHaveAttribute('href', '/tools/funnel-pages');
  });

  it('remains usable on mobile viewport baseline', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 375 });
    window.dispatchEvent(new Event('resize'));

    renderPage();

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Apri workspace' })).toHaveLength(2);
  });
});
