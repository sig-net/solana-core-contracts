import { ArrowRight, WalletIcon } from 'lucide-react';

import { TruncatedText } from '@/components/ui/truncated-text';

import { TokenDisplay } from './token-display';

import { ActivityTransaction } from './index';

interface DetailsCellProps {
  transaction: ActivityTransaction;
}

export function DetailsCell({ transaction }: DetailsCellProps) {
  const isSwap = transaction.type === 'Swap';
  const isDeposit = transaction.type === 'Deposit';

  return (
    <div className='flex max-w-full min-w-0 items-center gap-2 sm:gap-4'>
      <div className='flex-shrink-0'>
        <TokenDisplay token={transaction.fromToken} />
      </div>

      <ArrowRight className='text-tundora-50 h-4 w-4 shrink-0 sm:h-5 sm:w-5' />

      {isSwap || isDeposit ? (
        <div className='flex-shrink-0'>
          <TokenDisplay token={transaction.toToken} />
        </div>
      ) : (
        <div className='flex min-w-0 items-center gap-1 sm:gap-2'>
          <WalletIcon className='text-tundora-50 h-4 w-4 shrink-0 sm:h-5 sm:w-5' />
          <div className='min-w-0 text-xs font-medium text-stone-600 sm:text-sm'>
            {transaction.address ? (
              <TruncatedText
                text={transaction.address}
                prefixLength={4}
                suffixLength={3}
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
