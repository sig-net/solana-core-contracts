'use client';

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CryptoIcon } from '@/components/balance-display/crypto-icon';
import { DepositToken } from '@/lib/constants/deposit-tokens';
import { cn } from '@/lib/utils';

interface AmountInputProps {
  token: DepositToken;
  depositAddress: string;
  onBack: () => void;
  onProceed: (amount: string) => void;
}

export function AmountInput({
  token,
  depositAddress,
  onBack,
  onProceed,
}: AmountInputProps) {
  const [amount, setAmount] = useState('');
  const [isValid, setIsValid] = useState(false);

  const handleAmountChange = (value: string) => {
    setAmount(value);
    // Basic validation - check if it's a valid number and > 0
    const numValue = parseFloat(value);
    setIsValid(!isNaN(numValue) && numValue > 0);
  };

  const handleProceed = () => {
    if (isValid) {
      onProceed(amount);
    }
  };

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-3'>
        <Button
          onClick={onBack}
          variant='ghost'
          size='sm'
          className='h-auto cursor-pointer p-1.5'
        >
          <ArrowLeft className='h-4 w-4' />
        </Button>
        <h2 className='text-dark-neutral-900 text-xl font-semibold'>
          Deposit {token.symbol}
        </h2>
      </div>

      {/* Token Info */}
      <div className='bg-pastels-polar-100/30 border-dark-neutral-50 flex items-center gap-3 rounded-lg border p-4'>
        <CryptoIcon
          chain={token.chain}
          token={token.symbol}
          className='h-10 w-10'
        />
        <div>
          <p className='text-dark-neutral-900 font-semibold'>{token.symbol}</p>
          <p className='text-dark-neutral-600 text-sm'>{token.name}</p>
        </div>
        <div className='ml-auto'>
          <span className='text-dark-neutral-400 bg-pastels-polar-200 border-dark-neutral-50 rounded-sm border px-2.5 py-1.5 text-xs font-medium'>
            {token.chainName}
          </span>
        </div>
      </div>

      {/* Amount Input */}
      <div className='space-y-2'>
        <Label
          htmlFor='amount'
          className='text-dark-neutral-900 text-sm font-medium'
        >
          Amount to deposit
        </Label>
        <div className='relative'>
          <Input
            id='amount'
            type='number'
            placeholder='0.00'
            value={amount}
            onChange={e => handleAmountChange(e.target.value)}
            className='pr-16 text-right'
            step='any'
            min='0'
          />
          <div className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3'>
            <span className='text-dark-neutral-600 text-sm font-medium'>
              {token.symbol}
            </span>
          </div>
        </div>
        <p className='text-dark-neutral-500 text-xs'>
          Enter the amount you want to bridge to Solana
        </p>
      </div>

      {/* Deposit Address Info */}
      <div className='rounded-lg border border-blue-200 bg-blue-50 p-4'>
        <h4 className='mb-2 text-sm font-medium text-blue-900'>
          Your Deposit Address
        </h4>
        <div className='rounded border bg-white p-3 font-mono text-sm break-all text-blue-800'>
          {depositAddress}
        </div>
        <p className='mt-2 text-xs text-blue-700'>
          You'll need to send {token.symbol} to this address first, then
          continue with the deposit process.
        </p>
      </div>

      {/* Action Buttons */}
      <div className='flex gap-3 pt-4'>
        <Button
          onClick={onBack}
          variant='outline'
          className='flex-1 cursor-pointer'
        >
          Back
        </Button>
        <Button
          onClick={handleProceed}
          disabled={!isValid}
          className={cn(
            'flex-1',
            isValid ? 'cursor-pointer' : 'cursor-not-allowed',
          )}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
