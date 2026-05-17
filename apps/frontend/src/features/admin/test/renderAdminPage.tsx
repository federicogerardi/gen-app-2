import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

export const renderAdminPage = (ui: ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};