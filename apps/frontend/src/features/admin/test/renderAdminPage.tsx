import type { ReactElement } from 'react';
import type { InitialEntry } from 'react-router-dom';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig } from 'swr';

type RenderAdminPageOptions = Omit<RenderOptions, 'wrapper'> & {
  initialEntries?: InitialEntry[];
};

export const renderAdminPage = (
  ui: ReactElement,
  { initialEntries, ...options }: RenderAdminPageOptions = {},
) => {
  const memoryRouterProps = initialEntries ? { initialEntries } : {};
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <MemoryRouter {...memoryRouterProps}>
        {ui}
      </MemoryRouter>
    </SWRConfig>,
    options,
  );
};