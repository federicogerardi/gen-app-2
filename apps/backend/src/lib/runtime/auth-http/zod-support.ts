import { z, type ZodIssue } from 'zod';

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const formatPath = (issue: ZodIssue): string => {
  if (issue.path.length === 0) {
    return 'body';
  }

  return issue.path
    .map((segment) => typeof segment === 'number' ? `[${segment}]` : String(segment))
    .join('.');
};

export const formatZodIssuesForBadRequest = (issues: ZodIssue[]): string => {
  const messages = issues.map((issue) => {
    const path = formatPath(issue);
    return path === 'body' ? issue.message : `${path}: ${issue.message}`;
  });

  return messages.join('; ');
};

export const nonEmptyTrimmedString = (fieldName: string) => {
  return z.string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, {
      message: `${fieldName} is required`,
    });
};

export const optionalTrimmedString = () => {
  return z.string()
    .transform((value) => value.trim())
    .optional();
};

export const boundedInteger = (
  fieldName: string,
  min: number,
  max: number,
) => {
  return z.number()
    .int(`${fieldName} must be an integer`)
    .min(min, `${fieldName} must be >= ${min}`)
    .max(max, `${fieldName} must be <= ${max}`);
};

export const enumValue = <const TValue extends readonly [string, ...string[]]>(
  values: TValue,
  fieldName: string,
) => {
  return z.enum(values, {
    error: () => ({ message: `${fieldName} must be one of ${values.join(', ')}` }),
  });
};

export const objectPayload = (fieldName: string) => {
  return z.custom<Record<string, unknown>>((value) => isPlainRecord(value), {
    message: `${fieldName} must be an object`,
  });
};

export const arrayPayload = (fieldName: string) => {
  return z.array(z.unknown(), {
    error: () => ({ message: `${fieldName} must be an array` }),
  });
};

export const authHttpBodySchema = z.unknown();