'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CryptoIcon } from '@/components/balance-display/crypto-icon';
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
  const [selectedToken, setSelectedToken] = useState<WithdrawToken | null>(
    preSelectedToken || availableTokens[0] || null,
  );
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
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

  const handleMaxClick = () => {
    if (selectedToken) {
      setValue('amount', selectedToken.balance);
    }
  };

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    if (num === 0) return '0';
    if (num < 0.01) return '< 0.01';
    return num.toFixed(6).replace(/\.?0+$/, '');
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className='space-y-4'>
      {/* Token Selection */}
      <div className='relative'>
        <button
          type='button'
          onClick={() => setShowTokenDropdown(!showTokenDropdown)}
          className='bg-pastels-polar-200 border-dark-neutral-50 hover:border-dark-neutral-200 hover:bg-pastels-polar-100/30 focus-visible:ring-dark-neutral-200 flex w-full cursor-pointer items-center justify-between rounded-sm border p-3 transition-all focus-visible:ring-2 focus-visible:ring-offset-2'
        >
          {selectedToken ? (
            <div className='flex items-center gap-3'>
              <CryptoIcon
                chain={selectedToken.chain}
                token={selectedToken.symbol}
                className='h-8 w-8'
              />
              <div className='text-left'>
                <div className='text-tundora-300 font-semibold'>
                  {selectedToken.symbol}
                </div>
                <div className='text-dark-neutral-400 text-sm'>
                  Balance: {formatBalance(selectedToken.balance)}
                </div>
              </div>
            </div>
          ) : (
            <span className='text-dark-neutral-400'>Select token</span>
          )}
          <ChevronDown
            className={cn(
              'text-dark-neutral-400 h-4 w-4 transition-transform',
              showTokenDropdown && 'rotate-180',
            )}
          />
        </button>

        {/* Token Dropdown */}
        {showTokenDropdown && (
          <div className='border-dark-neutral-50 absolute top-full right-0 left-0 z-10 mt-2 max-h-48 overflow-y-auto rounded-sm border bg-white shadow-xl'>
            {availableTokens.map((token, index) => {
              const isSelected =
                selectedToken?.symbol === token.symbol &&
                selectedToken?.chain === token.chain;
              return (
                <button
                  key={`${token.chain}-${token.address}-${index}`}
                  type='button'
                  onClick={() => {
                    setSelectedToken(token);
                    setShowTokenDropdown(false);
                    setValue('amount', '');
                    setError('');
                  }}
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-3 p-4 text-left transition-all',
                    isSelected
                      ? 'bg-brand-100/20 border-brand-950 border-l-2'
                      : 'hover:bg-pastels-polar-100/30',
                  )}
                >
                  <CryptoIcon
                    chain={token.chain}
                    token={token.symbol}
                    className='h-10 w-10 shrink-0'
                  />
                  <div className='min-w-0 flex-1'>
                    <div className='flex items-center justify-between gap-3'>
                      <div>
                        <div className='text-tundora-300 text-base font-semibold'>
                          {token.symbol}
                        </div>
                        <div className='text-tundora-50 text-sm font-medium'>
                          {token.name}
                        </div>
                      </div>
                      <span className='text-dark-neutral-400 bg-pastels-polar-200 border-dark-neutral-50 shrink-0 rounded-sm border px-2.5 py-1.5 text-xs font-medium'>
                        {token.chainName}
                      </span>
                    </div>
                    <div className='text-dark-neutral-400 mt-1 text-xs'>
                      Balance: {formatBalance(token.balance)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Amount Input */}
      <div className='space-y-3'>
        <Label className='text-tundora-300 text-sm font-medium'>Amount</Label>
        <div className='relative'>
          <Input
            placeholder='0.00'
            {...register('amount')}
            className='h-12 pr-20 text-lg font-medium'
          />
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={handleMaxClick}
            className='text-dark-neutral-400 hover:text-tundora-300 hover:bg-brand-100/20 border-dark-neutral-50 absolute top-1/2 right-3 h-7 -translate-y-1/2 cursor-pointer rounded border px-3 text-xs font-semibold'
          >
            MAX
          </Button>
        </div>
        {selectedToken && watchedAmount && (
          <div className='bg-pastels-polar-100 border-dark-neutral-50 flex items-center gap-2 rounded-sm border p-3'>
            <div className='bg-success-500 h-2 w-2 shrink-0 rounded-full'></div>
            <p className='text-dark-neutral-400 text-xs font-medium'>
              Available: {formatBalance(selectedToken.balance)}{' '}
              <span className='text-tundora-300 font-semibold'>
                {selectedToken.symbol}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Receiver Address */}
      <div className='space-y-3'>
        <Label className='text-tundora-300 text-sm font-medium'>
          Receiver Address
        </Label>
        <Input
          placeholder='0x1234567890abcdef1234567890abcdef12345678'
          {...register('receiverAddress')}
          className='h-12 font-mono text-sm'
        />
        {watchedAddress && (
          <div className='bg-pastels-polar-100 border-dark-neutral-50 flex items-center gap-2 rounded-sm border p-3'>
            <div className='bg-success-500 h-2 w-2 shrink-0 rounded-full'></div>
            <p className='text-dark-neutral-400 text-xs font-medium'>
              Ethereum address entered
            </p>
          </div>
        )}
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
        disabled={!selectedToken || !watchedAmount || !watchedAddress}
        className={cn(
          'h-12 w-full text-base font-semibold',
          !selectedToken || !watchedAmount || !watchedAddress
            ? 'cursor-not-allowed'
            : 'cursor-pointer',
        )}
        size='lg'
      >
        Continue
      </Button>
    </form>
  );
}
