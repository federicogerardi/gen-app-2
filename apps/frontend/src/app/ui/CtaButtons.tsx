import { Button } from '@mui/material';
import type { ButtonProps } from '@mui/material';
import type { ElementType } from 'react';
import { cx, uiPrimitives } from './primitives';

type CtaButtonProps<C extends ElementType = 'button'> = Omit<ButtonProps<C, { component?: C }>, 'variant'>;

export const PrimaryCtaButton = <C extends ElementType = 'button'>({ className, ...props }: CtaButtonProps<C>) => {
  return <Button {...props} className={cx(uiPrimitives.button, className)} variant="contained" />;
};

export const SecondaryCtaButton = <C extends ElementType = 'button'>({ className, ...props }: CtaButtonProps<C>) => {
  return <Button {...props} className={cx('ui-button-secondary', className)} variant="outlined" />;
};

export const SoftCtaButton = <C extends ElementType = 'button'>({ className, ...props }: CtaButtonProps<C>) => {
  return <Button {...props} className={cx('ui-button-soft', className)} variant="text" />;
};