import { z } from 'zod';

export const adminModelFormSchema = z.object({
  key: z.string().min(1, 'Key richiesta'),
  label: z.string().min(1, 'Label richiesta'),
  status: z.enum(['enabled', 'disabled']),
});

export type AdminModelFormValues = z.infer<typeof adminModelFormSchema>;
