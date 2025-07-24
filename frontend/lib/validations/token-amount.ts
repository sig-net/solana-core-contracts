import { z } from 'zod';

export const tokenAmountSchema = z
  .string()
  .refine(val => val === '' || /^\d*\.?\d*$/.test(val), {
    message: 'Invalid amount format',
  })
  .refine(
    val => {
      if (val === '' || val === '.') return true;
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0;
    },
    {
      message: 'Amount must be a positive number',
    },
  )
  .refine(
    val => {
      if (val === '' || val === '.') return true;
      const parts = val.split('.');
      return parts.length <= 2 && (parts[1]?.length || 0) <= 18;
    },
    {
      message: 'Too many decimal places (max 18)',
    },
  );

export const validateTokenAmount = (value: string) => {
  const result = tokenAmountSchema.safeParse(value);
  return {
    isValid: result.success,
    error: result.error?.errors[0]?.message,
  };
};

export const formatTokenAmount = (value: string): string => {
  // Remove leading zeros except for decimal numbers
  if (value.startsWith('0') && value.length > 1 && value[1] !== '.') {
    return value.substring(1);
  }
  return value;
};
