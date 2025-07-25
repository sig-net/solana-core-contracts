import { ArrowRight, WalletIcon } from 'lucide-react';

import { TruncatedAddress } from '@/components/ui/truncated-text';

import { TokenDisplay } from './token-display';

import { ActivityTransaction } from './index';

interface DetailsCellProps {
  transaction: ActivityTransaction;
}

export function DetailsCell({ transaction }: DetailsCellProps) {
  const isSwap = transaction.type === 'Swap';
  const isDeposit = transaction.type === 'Deposit';

  return (
    <div className='flex items-center gap-4'>
      <TokenDisplay token={transaction.fromToken} />

      <ArrowRight className='text-tundora-50 h-5 w-5 shrink-0' />

      {isSwap || isDeposit ? (
        <TokenDisplay token={transaction.toToken} />
      ) : (
        <div className='flex items-center gap-2'>
          <WalletIcon className='text-tundora-50 h-5 w-5' />
          <div className='text-sm leading-6 font-medium text-stone-600'>
            {transaction.address ? (
              <TruncatedAddress
                address={transaction.address}
                copyable={true}
                className='transition-colors hover:text-blue-600'
              />
            ) : (
              'Unknown'
            )}
          </div>
        </div>
      )}
    </div>
  );
}
