import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { TextField, Button as MuiButton } from '@mui/material';
import { appCopy } from '../../../app/copy/system';
import { useApiConfig } from '../../../app/providers/AuthSessionProvider';
import { useFeedbackMessage } from '../../../app/providers/FeedbackMessageProvider';
import { Surface, TopBar, uiPrimitives } from '../../../app/ui/primitives';
import { createProject } from '../runtime/projects-client';

const newProjectSchema = z.object({
  name: z.string().min(1, appCopy.ui.toolPage.runtimeErrors.projectRequired),
  description: z.string().optional(),
});

type NewProjectFormValues = z.infer<typeof newProjectSchema>;

export const NewProjectPage = () => {
  const { apiBaseUrl, capabilities } = useApiConfig();
  const navigate = useNavigate();
  const { publishSuccess } = useFeedbackMessage();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<NewProjectFormValues>({
    resolver: zodResolver(newProjectSchema),
    defaultValues: { name: '', description: '' },
  });

  const onSubmit = async (data: NewProjectFormValues) => {
    try {
      const created = await createProject(
        { name: data.name, description: data.description ?? '' },
        {
          apiBaseUrl,
          capabilities,
        },
      );
      publishSuccess(appCopy.ui.feedback.projectsCreated, { dedupeKey: 'projects:create:success' });
      navigate(`/dashboard/projects/${created.id}`);
    } catch (submitError) {
      setError('root', {
        message: submitError instanceof Error ? submitError.message : appCopy.ui.fallbackErrors.createProject,
      });
    }
  };

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <TopBar>
        <h2>{appCopy.editorial.projects.newTitle}</h2>
        <Link to="/dashboard/projects" className={uiPrimitives.inlineLink}>{appCopy.ui.actions.backToList}</Link>
      </TopBar>

      <form className={uiPrimitives.grid} onSubmit={handleSubmit(onSubmit)}>
        <TextField
          label={appCopy.ui.labels.projectName}
          {...register('name')}
          error={!!errors.name}
          helperText={errors.name?.message}
          fullWidth
          required
        />

        <TextField
          label={appCopy.ui.labels.projectDescription}
          {...register('description')}
          multiline
          rows={5}
          fullWidth
        />

        {errors.root ? <p className={uiPrimitives.error} role="alert">{errors.root.message}</p> : null}

        <MuiButton type="submit" variant="contained" disabled={isSubmitting}>
          {appCopy.ui.actions.createProject}
        </MuiButton>
      </form>
    </Surface>
  );
};
