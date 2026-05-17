import type { ReactElement } from 'react';
import type { InitialEntry } from 'react-router-dom';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig } from 'swr';

type RenderProjectPageOptions = Omit<RenderOptions, 'wrapper'> & {
  initialEntries?: InitialEntry[];
};

export const renderProjectPage = (
  ui: ReactElement,
  { initialEntries, ...options }: RenderProjectPageOptions = {},
) => {
  const memoryRouterProps = initialEntries ? { initialEntries } : {};
  return render(ui, {
    ...options,
    wrapper: ({ children }) => (
      <SWRConfig value={{ provider: () => new Map() }}>
        <MemoryRouter {...memoryRouterProps}>
          {children}
        </MemoryRouter>
      </SWRConfig>
    ),
  });
};
