/**
 * Copy Length Validation for Meta Ads (Frontend)
 * Validates that generated copy respects character count limits for selected format
 */

export type CopyLengthFormat = 'short-form' | 'medium-form' | 'long-form';

export type CopyLengthValidationResult = {
  valid: boolean;
  format: CopyLengthFormat;
  actualLength: number;
  expectedMin: number;
  expectedMax: number;
  message: string;
};

const COPY_LENGTH_RANGES: Record<CopyLengthFormat, { min: number; max: number }> = {
  'short-form': { min: 400, max: 600 },
  'medium-form': { min: 800, max: 1000 },
  'long-form': { min: 1200, max: 2000 },
};

/**
 * Validate that a copy text respects the character count limits for the selected format
 */
export const validateCopyLength = (
  copyText: string,
  format: CopyLengthFormat,
): CopyLengthValidationResult => {
  const range = COPY_LENGTH_RANGES[format];
  const actualLength = copyText.length;

  if (actualLength < range.min) {
    return {
      valid: false,
      format,
      actualLength,
      expectedMin: range.min,
      expectedMax: range.max,
      message: `Copy troppo corto: ${actualLength} caratteri (minimo ${range.min} per ${format})`,
    };
  }

  if (actualLength > range.max) {
    return {
      valid: false,
      format,
      actualLength,
      expectedMin: range.min,
      expectedMax: range.max,
      message: `Copy troppo lungo: ${actualLength} caratteri (massimo ${range.max} per ${format})`,
    };
  }

  return {
    valid: true,
    format,
    actualLength,
    expectedMin: range.min,
    expectedMax: range.max,
    message: `Copy valido: ${actualLength} caratteri (range ${range.min}-${range.max} per ${format})`,
  };
};

/**
 * Get the character range for a specific format
 */
export const getCopyLengthRange = (format: CopyLengthFormat): { min: number; max: number } => {
  return COPY_LENGTH_RANGES[format];
};

/**
 * Check if a copy text is within the acceptable range for the selected format
 */
export const isCopyLengthValid = (copyText: string, format: CopyLengthFormat): boolean => {
  return validateCopyLength(copyText, format).valid;
};
