import type { ReactNode } from 'react';
import { Button } from '@mui/material';

type UploadFieldButtonProps = {
  label: string;
  disabled?: boolean;
  accept?: string;
  onFileSelected: (file: File | null) => void;
  icon?: ReactNode;
  fullWidth?: boolean;
  minHeight?: number;
};

export const UploadFieldButton = ({
  label,
  disabled = false,
  accept,
  onFileSelected,
  icon,
  fullWidth = true,
  minHeight = 56,
}: UploadFieldButtonProps) => {
  return (
    <Button
      component="label"
      variant="outlined"
      startIcon={icon}
      fullWidth={fullWidth}
      sx={{ minHeight, whiteSpace: 'nowrap' }}
      disabled={disabled}
    >
      {label}
      <input
        type="file"
        hidden
        accept={accept}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          onFileSelected(file);
        }}
      />
    </Button>
  );
};