import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button as MuiButton, TextField } from '@mui/material';
import { appCopy } from '../../../app/copy/system';
import { Surface, uiPrimitives } from '../../../app/ui/primitives';

type LoginFormProps = {
  onSubmit: (email: string, password: string) => Promise<void>;
  oauthStartUrl: string;
  hasExternalError?: boolean;
};

const loginSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(1, 'Password richiesta'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const LoginForm = ({ onSubmit, oauthStartUrl, hasExternalError = false }: LoginFormProps) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleLoginSubmit = async (data: LoginFormValues): Promise<void> => {
    setPending(true);
    setError(null);

    try {
      await onSubmit(data.email, data.password);
      reset({ email: data.email, password: '' });
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : appCopy.ui.fallbackErrors.loginFailed);
    } finally {
      setPending(false);
    }
  };

  return (
    <Surface as="section" className={uiPrimitives.loginPanel}>
      <form className={uiPrimitives.grid} noValidate onSubmit={handleSubmit((data) => void handleLoginSubmit(data))}>
        <TextField
          label={appCopy.ui.labels.email}
          type="email"
          required
          {...register('email')}
          error={!!errors.email}
          helperText={errors.email?.message}
          fullWidth
        />

        <TextField
          label={appCopy.ui.labels.password}
          type="password"
          required
          {...register('password')}
          error={!!errors.password}
          helperText={errors.password?.message}
          fullWidth
        />

        {error || hasExternalError ? <p className={uiPrimitives.error} role="alert">{error ?? appCopy.ui.fallbackErrors.loginFailed}</p> : null}

        <MuiButton type="submit" variant="contained" disabled={pending}>
          {pending ? appCopy.editorial.auth.pendingAccess : appCopy.ui.actions.enterWorkspace}
        </MuiButton>
      </form>

      <a className={uiPrimitives.oauthLink} href={oauthStartUrl}>
        {appCopy.ui.actions.continueWithGoogleWorkspace}
      </a>
    </Surface>
  );
};
