import * as React from 'react';
import TextField from '@mui/material/TextField';
import { TextFieldProps } from '@mui/material/TextField';

/**
 * AppInput - wrapper per TextField MUI, per sostituire i custom Input legacy.
 * Accetta tutte le props di MUI TextField.
 */
export const AppInput: React.FC<TextFieldProps> = (props) => {
  return <TextField variant="outlined" fullWidth {...props} />;
};
