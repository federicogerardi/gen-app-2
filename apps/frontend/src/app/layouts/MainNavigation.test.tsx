import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MainNavigation } from './MainNavigation';

describe('MainNavigation', () => {
  it('does not render feedback entry for member navigation', () => {
    render(
      <MemoryRouter>
        <MainNavigation
          isCollapsed={false}
          isMobileOpen={false}
          isAdmin={false}
          onToggleCollapsed={vi.fn()}
          onCloseMobile={vi.fn()}
          onLogout={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: 'Feedback' })).toBeNull();
  });
});
