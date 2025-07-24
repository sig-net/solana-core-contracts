import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  validateTokenAmount,
  formatTokenAmount,
} from '@/lib/validations/token-amount';

interface TokenAmountInputProps {
  amount: string;
  onAmountChange: (amount: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

export function TokenAmountInput({
  amount,
  onAmountChange,
  placeholder = '0',
  className,
  inputClassName,
}: TokenAmountInputProps) {
  const [error, setError] = useState<string | undefined>();

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const validation = validateTokenAmount(value);

    if (validation.isValid) {
      setError(undefined);
      const formattedValue = formatTokenAmount(value);
      onAmountChange(formattedValue);
    } else {
      setError(validation.error);
    }
  };

  return (
    <div className={cn('min-w-0 flex-1', className)}>
      <Input
        type='text'
        value={amount}
        onChange={handleAmountChange}
        placeholder={placeholder}
        className={cn(
          inputClassName,
          'text-dark-neutral-500 placeholder:text-dark-neutral-500 border-0 bg-transparent p-0',
          'focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0',
          'font-mono text-base leading-normal font-light',
          error && 'text-destructive',
        )}
      />
      {error && <p className='text-destructive mt-1 text-xs'>{error}</p>}
    </div>
  );
}
