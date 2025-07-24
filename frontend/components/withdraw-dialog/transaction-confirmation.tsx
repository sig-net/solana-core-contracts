'use client';

import { ArrowLeft, ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CryptoIcon } from '@/components/balance-display/crypto-icon';

import { WithdrawTransaction } from './index';

interface TransactionConfirmationProps {
  transaction: WithdrawTransaction;
  onConfirm: () => void;
  onBack: () => void;
}

export function TransactionConfirmation({
  transaction,
  onConfirm,
  onBack,
}: TransactionConfirmationProps) {
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatAmount = (amount: string) => {
    const num = parseFloat(amount);
    if (num === 0) return '0';
    if (num < 0.01) return '< 0.01';
    return num.toFixed(6).replace(/\.?0+$/, '');
  };

  return (
    <div className='space-y-4'>
      {/* Header */}
      <div className='flex items-center gap-3 pb-2'>
        <Button
          variant='ghost'
          size='icon'
          onClick={onBack}
          className='hover:bg-pastels-polar-100'
        >
          <ArrowLeft className='h-5 w-5' />
        </Button>
        <h3 className='text-tundora-300 text-xl font-semibold'>
          Review Transaction
        </h3>
      </div>

      {/* Transaction Summary Card */}
      <div className='bg-pastels-polar-200 border-dark-neutral-50 space-y-4 rounded-sm border p-4'>
        {/* Token and Amount */}
        <div className='space-y-2 text-center'>
          <div className='flex justify-center'>
            <CryptoIcon
              chain={transaction.token.chain}
              token={transaction.token.symbol}
              className='h-12 w-12'
            />
          </div>
          <div>
            <div className='text-tundora-300 mb-1 text-xl font-semibold'>
              {formatAmount(transaction.amount)} {transaction.token.symbol}
            </div>
            <div className='text-dark-neutral-400 text-sm font-medium'>
              {transaction.token.name} • {transaction.token.chainName}
            </div>
          </div>
        </div>

        {/* Transaction Flow */}
        <div className='flex items-center gap-4 py-3'>
          <div className='flex-1 text-center'>
            <div className='text-dark-neutral-400 mb-2 text-xs font-semibold tracking-wide uppercase'>
              FROM
            </div>
            <div className='border-dark-neutral-50 rounded-sm border bg-white px-4 py-3 shadow-sm'>
              <div className='text-tundora-300 text-sm font-semibold'>
                Your Wallet
              </div>
            </div>
          </div>

          <div className='border-dark-neutral-50 rounded-full border bg-white p-2'>
            <ArrowRight className='text-dark-neutral-400 h-4 w-4' />
          </div>

          <div className='flex-1 text-center'>
            <div className='text-dark-neutral-400 mb-2 text-xs font-semibold tracking-wide uppercase'>
              TO
            </div>
            <div className='border-dark-neutral-50 rounded-sm border bg-white px-4 py-3 shadow-sm'>
              <div className='text-tundora-300 font-mono text-sm font-semibold'>
                {formatAddress(transaction.receiverAddress)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className='flex gap-3 pt-2'>
        <Button
          variant='outline'
          onClick={onBack}
          className='h-12 flex-1 cursor-pointer text-base font-semibold'
          size='lg'
        >
          Back
        </Button>
        <Button
          onClick={onConfirm}
          className='h-12 flex-1 cursor-pointer text-base font-semibold'
          size='lg'
        >
          Confirm & Send
        </Button>
      </div>
    </div>
  );
}
