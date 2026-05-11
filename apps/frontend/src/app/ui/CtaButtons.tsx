import { Button } from '@mui/material';
import type { ButtonProps } from '@mui/material';
import type { ElementType } from 'react';

type CtaButtonProps<C extends ElementType = 'button'> = Omit<ButtonProps<C, { component?: C }>, 'variant'>;

export const PrimaryCtaButton = <C extends ElementType = 'button'>(props: CtaButtonProps<C>) => {
  return <Button {...props} variant="contained" />;
};

export const SecondaryCtaButton = <C extends ElementType = 'button'>(props: CtaButtonProps<C>) => {
  return <Button {...props} variant="outlined" />;
};

export const SoftCtaButton = <C extends ElementType = 'button'>(props: CtaButtonProps<C>) => {
  return <Button {...props} variant="text" />;
};