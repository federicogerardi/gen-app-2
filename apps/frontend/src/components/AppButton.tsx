import * as React from 'react';
import Button from '@mui/material/Button';
import { ButtonProps } from '@mui/material/Button';

/**
 * AppButton - wrapper per il bottone MUI, per sostituire i custom Button legacy.
 * Accetta tutte le props di MUI Button.
 */
export const AppButton: React.FC<ButtonProps> = (props) => {
  return <Button variant="contained" color="primary" {...props} />;
};
