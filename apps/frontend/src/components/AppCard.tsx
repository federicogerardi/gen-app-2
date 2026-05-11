import * as React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import { CardProps } from '@mui/material/Card';

/**
 * AppCard - wrapper per Card MUI, per sostituire i custom Card legacy.
 * Accetta tutte le props di MUI Card.
 */
export const AppCard: React.FC<CardProps & { title?: string }> = ({ title, children, ...props }) => (
  <Card {...props}>
    {title && <CardHeader title={title} />}
    <CardContent>{children}</CardContent>
  </Card>
);
