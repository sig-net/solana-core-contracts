'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { SendIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TokenAmountDisplay } from '@/components/ui/token-amount-display';
import { cn } from '@/lib/utils';

import { WithdrawToken } from './index';

interface FormData {
  amount: string;
  receiverAddress: string;
}

interface AmountInputProps {
  availableTokens: WithdrawToken[];
  onSubmit: (data: {
    token: WithdrawToken;
    amount: string;
    receiverAddress: string;
  }) => void;
  preSelectedToken?: WithdrawToken | null;
}

export function AmountInput({
  availableTokens,
  onSubmit,
  preSelectedToken,
}: AmountInputProps) {
  const [selectedToken, setSelectedToken] = useState<WithdrawToken | undefined>(
    preSelectedToken || availableTokens[0] || undefined,
  );
  const [error, setError] = useState<string>('');

  const { register, handleSubmit, setValue, watch } = useForm<FormData>({
    defaultValues: {
      amount: '',
      receiverAddress: '',
    },
  });

  const watchedAmount = watch('amount');
  const watchedAddress = watch('receiverAddress');

  // Update selected token when preSelectedToken changes
  useEffect(() => {
    if (preSelectedToken) {
      setSelectedToken(preSelectedToken);
    }
  }, [preSelectedToken]);

  const onFormSubmit = (data: FormData) => {
    if (!selectedToken) {
      setError('Please select a token');
      return;
    }

    setError('');
    onSubmit({
      token: selectedToken,
      amount: data.amount,
      receiverAddress: data.receiverAddress,
    });
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className='space-y-4'>
      {/* Token Selection */}
      <div>
        <TokenAmountDisplay
          value={watchedAmount}
          onChange={value => setValue('amount', value)}
          tokens={availableTokens}
          selectedToken={selectedToken}
          onTokenSelect={token => {
            setSelectedToken(token as WithdrawToken);
            setValue('amount', '');
            setError('');
          }}
          usdValue={`≈ $${watchedAmount ? (parseFloat(watchedAmount) * 113718.77).toFixed(2) : '0.00'}`}
          placeholder='0.00'
        />
      </div>

      {/* Receiver Address */}
      <div className='space-y-2'>
        <Label className='text-tundora-300 text-sm font-medium'>
          Receiver Address
        </Label>
        <Input
          placeholder='Recipient address'
          {...register('receiverAddress')}
          className='h-12 font-mono text-sm'
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className='flex items-center gap-2 rounded-sm border border-red-200 bg-red-50 p-3'>
          <div className='h-2 w-2 shrink-0 rounded-full bg-red-500'></div>
          <p className='text-xs font-medium text-red-800'>{error}</p>
        </div>
      )}

      {/* Continue Button */}
      <Button
        type='submit'
        variant='secondary'
        disabled={!selectedToken || !watchedAmount || !watchedAddress}
        className={cn(
          'h-12 w-full text-base font-semibold',
          !selectedToken || !watchedAmount || !watchedAddress
            ? 'cursor-not-allowed'
            : 'cursor-pointer',
        )}
        size='lg'
      >
        <SendIcon className='size-4' />
        Send
      </Button>
    </form>
  );
}
