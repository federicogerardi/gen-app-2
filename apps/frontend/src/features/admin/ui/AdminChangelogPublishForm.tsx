import { Button as MuiButton, TextField } from '@mui/material';

import { AdminChangelogFormShell } from './AdminChangelogFormShell';

type AdminChangelogPublishFormProps = {
  title: string;
  body: string;
  isAdmin: boolean;
  isPublishing: boolean;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onPublish: () => void;
};

export const AdminChangelogPublishForm = ({
  title,
  body,
  isAdmin,
  isPublishing,
  onTitleChange,
  onBodyChange,
  onPublish,
}: AdminChangelogPublishFormProps) => {
  return (
    <AdminChangelogFormShell
      title="Nuova voce changelog"
      subtitle="Componi titolo e contenuto, quindi pubblica."
      onSubmit={(event) => {
        event.preventDefault();
        void onPublish();
      }}
      actions={(
        <MuiButton
          type="submit"
          variant="contained"
          disabled={!isAdmin || isPublishing}
        >
          {isPublishing ? 'Pubblicazione...' : 'Pubblica changelog'}
        </MuiButton>
      )}
    >
      <TextField
        label="Titolo"
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        fullWidth
        required
        disabled={!isAdmin || isPublishing}
      />

      <TextField
        label="Contenuto"
        value={body}
        onChange={(event) => onBodyChange(event.target.value)}
        fullWidth
        required
        multiline
        minRows={5}
        disabled={!isAdmin || isPublishing}
      />
    </AdminChangelogFormShell>
  );
};