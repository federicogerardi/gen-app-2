import * as React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { DialogProps } from '@mui/material/Dialog';

/**
 * AppModal - wrapper per Dialog MUI, per sostituire i custom Modal legacy.
 * Accetta tutte le props di MUI Dialog.
 */
export const AppModal: React.FC<DialogProps & { title?: string; actions?: React.ReactNode }> = ({ title, actions, children, ...props }) => (
  <Dialog {...props}>
    {title && <DialogTitle>{title}</DialogTitle>}
    <DialogContent>{children}</DialogContent>
    {actions && <DialogActions>{actions}</DialogActions>}
  </Dialog>
);
