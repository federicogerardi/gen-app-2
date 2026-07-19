import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  it('shows zod validation errors when fields are invalid', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <LoginForm
        onSubmit={onSubmit}
        oauthStartUrl="/auth/google/start"
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /enter workspace/i }));

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /email/i })).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText(/password/i)).toHaveAttribute('aria-invalid', 'true');
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits valid credentials', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <LoginForm
        onSubmit={onSubmit}
        oauthStartUrl="/auth/google/start"
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'StrongPassword1!' } });
    fireEvent.click(screen.getByRole('button', { name: /enter workspace/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('test@example.com', 'StrongPassword1!');
    });
  });
});
