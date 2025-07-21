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
        <h3 className='text-xl font-semibold text-tundora-300'>
          Review Transaction
        </h3>
      </div>

      {/* Transaction Summary Card */}
      <div className='bg-pastels-polar-200 border border-dark-neutral-50 rounded-sm p-4 space-y-4'>
        {/* Token and Amount */}
        <div className='text-center space-y-2'>
          <div className='flex justify-center'>
            <CryptoIcon
              chain={transaction.token.chain}
              token={transaction.token.symbol}
              className='w-12 h-12'
            />
          </div>
          <div>
            <div className='text-xl font-semibold text-tundora-300 mb-1'>
              {formatAmount(transaction.amount)} {transaction.token.symbol}
            </div>
            <div className='text-sm text-dark-neutral-400 font-medium'>
              {transaction.token.name} • {transaction.token.chainName}
            </div>
          </div>
        </div>

        {/* Transaction Flow */}
        <div className='flex items-center gap-4 py-3'>
          <div className='flex-1 text-center'>
            <div className='text-xs font-semibold text-dark-neutral-400 mb-2 uppercase tracking-wide'>
              FROM
            </div>
            <div className='bg-white border border-dark-neutral-50 rounded-sm px-4 py-3 shadow-sm'>
              <div className='text-sm font-semibold text-tundora-300'>
                Your Wallet
              </div>
            </div>
          </div>

          <div className='bg-white border border-dark-neutral-50 rounded-full p-2'>
            <ArrowRight className='h-4 w-4 text-dark-neutral-400' />
          </div>

          <div className='flex-1 text-center'>
            <div className='text-xs font-semibold text-dark-neutral-400 mb-2 uppercase tracking-wide'>
              TO
            </div>
            <div className='bg-white border border-dark-neutral-50 rounded-sm px-4 py-3 shadow-sm'>
              <div className='text-sm font-mono font-semibold text-tundora-300'>
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
          className='flex-1 h-12 text-base font-semibold cursor-pointer'
          size='lg'
        >
          Back
        </Button>
        <Button
          onClick={onConfirm}
          className='flex-1 h-12 text-base font-semibold cursor-pointer'
          size='lg'
        >
          Confirm & Send
        </Button>
      </div>
    </div>
  );
}
