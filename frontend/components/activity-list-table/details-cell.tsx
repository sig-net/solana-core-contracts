import { ArrowRight, WalletIcon } from 'lucide-react';
import { TokenDisplay } from './token-display';
import { ActivityTransaction } from './index';

interface DetailsCellProps {
  transaction: ActivityTransaction;
}

export function DetailsCell({ transaction }: DetailsCellProps) {
  const isSwap = transaction.type === 'Swap';

  return (
    <div className='flex gap-4 items-center'>
      <TokenDisplay token={transaction.fromToken} />

      <ArrowRight className='w-5 h-5 text-tundora-50 shrink-0' />

      {isSwap ? (
        <TokenDisplay token={transaction.toToken} />
      ) : (
        <div className='flex gap-2 items-center'>
          <WalletIcon className='h-5 w-5 text-tundora-50' />
          <div className=' font-medium text-sm leading-6 text-stone-600'>
            {transaction.address}
          </div>
        </div>
      )}
    </div>
  );
}
